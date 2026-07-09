"""Platform facade + FastAPI surface that ties the pillars together and shows
how a product API (here a stub studio-run) is guarded, metered, and observed.

Request lifecycle:
  middleware: assign request id -> time the request -> emit access log
  dependency: authenticate (bearer or API key) -> rate-limit -> set tenant
              context -> check the route's required permission
  handler:    check quota -> do work -> meter usage
"""
from __future__ import annotations

import hmac
import os
import time

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .metering import QuotaExceeded, UsageMeter
from .observability import EventLog, context, new_request_id, set_tenant
from .ratelimit import RateLimited, RateLimiter
from .rbac import Perm
from .tenancy import AuthError, Principal, TenantStore, issue_token


class Platform:
    def __init__(self):
        self.store = TenantStore()
        self.meter = UsageMeter()
        self.limiter = RateLimiter(rate_per_s=5, burst=8)
        self.log = EventLog()

    def authenticate(self, request: Request) -> Principal:
        auth = request.headers.get("authorization", "")
        api_key = request.headers.get("x-api-key", "")
        try:
            if auth.lower().startswith("bearer "):
                return self.store.auth_bearer(auth[7:].strip())
            if api_key:
                return self.store.auth_api_key(api_key.strip())
        except AuthError as e:
            raise HTTPException(401, str(e))
        raise HTTPException(401, "missing credentials (Bearer token or X-API-Key)")


platform = Platform()
app = FastAPI(title="Platform", version="0.1.0")


# --- middleware: request body size limit -------------------------------------
@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 10 * 1024 * 1024:
        return JSONResponse({"detail": "Request body too large (max 10MB)"}, status_code=413)
    return await call_next(request)


# --- CORS middleware ----------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:5174"
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- metrics endpoint --------------------------------------------------------
try:
    from shared.metrics import add_metrics_endpoint
    add_metrics_endpoint(app, "platform")
except Exception:
    pass


# --- startup event -----------------------------------------------------------
@app.on_event("startup")
async def _startup():
    try:
        from shared.logging_config import configure_logging
        configure_logging()
    except Exception:
        pass


# --- dependency factory: auth -> rate limit -> tenant ctx -> permission ------
class Require:
    def __init__(self, perm: str | None = None):
        self.perm = perm

    def __call__(self, request: Request) -> Principal:
        principal = platform.authenticate(request)
        set_tenant(principal.tenant_id)
        try:
            platform.limiter.check(principal.tenant_id)
        except RateLimited as e:
            platform.log.emit("rate_limited", subject=principal.subject)
            raise HTTPException(429, str(e), headers={"Retry-After": str(int(e.retry_after) + 1)})
        if self.perm and not principal.can(self.perm):
            platform.log.emit("forbidden", subject=principal.subject, perm=self.perm)
            raise HTTPException(403, f"missing permission: {self.perm}")
        return principal


# --- middleware: request id + access log -------------------------------------
@app.middleware("http")
async def observe(request: Request, call_next):
    rid = new_request_id()
    start = time.perf_counter()
    response = await call_next(request)
    platform.log.emit("http_access", method=request.method, path=request.url.path,
                      status=response.status_code,
                      ms=round((time.perf_counter() - start) * 1000, 2))
    response.headers["X-Request-Id"] = rid
    return response


# --- bootstrap / auth --------------------------------------------------------
class NewTenant(BaseModel):
    name: str
    admin_email: str
    admin_password: str
    plan: str = "free"


def _check_bootstrap(request: Request) -> None:
    """Validate the ADMIN_BOOTSTRAP_TOKEN. Raises 403 if wrong or unset."""
    token = os.environ.get("ADMIN_BOOTSTRAP_TOKEN", "").strip()
    if not token:
        raise HTTPException(403, "tenant bootstrap is disabled — set ADMIN_BOOTSTRAP_TOKEN")
    provided = request.headers.get("authorization", "")
    if provided.lower().startswith("bearer "):
        provided = provided[7:].strip()
    if not provided or not hmac.compare_digest(provided, token):
        raise HTTPException(403, "invalid ADMIN_BOOTSTRAP_TOKEN")


@app.post("/admin/tenants")
def create_tenant(req: NewTenant, request: Request):
    """Bootstrap a tenant with an admin user + API key.

    Requires ``Authorization: Bearer <ADMIN_BOOTSTRAP_TOKEN>`` — a static secret
    set via the environment variable.  Set it to a strong random value in
    production (e.g. ``openssl rand -hex 32``) and keep it out of logs.
    """
    _check_bootstrap(request)
    t = platform.store.create_tenant(req.name, plan=req.plan)
    platform.store.create_user(t.id, req.admin_email, req.admin_password, role="admin")
    _, key = platform.store.issue_api_key(t.id, role="admin")
    platform.log.emit("tenant_created", tenant_id=t.id)
    return {"tenant_id": t.id, "api_key": key,
            "note": "store this key now — it is not shown again"}


@app.get("/admin/tenants")
def list_tenants(p: Principal = Depends(Require(Perm.ADMIN))):
    """List all tenants (admin only). Includes in-memory tenants; DB is source of
    truth when DATABASE_URL is set."""
    tenants = [
        {"id": t.id, "name": t.name, "plan": t.plan,
         "cost_cap_usd": t.cost_cap_usd, "job_cap": t.job_cap}
        for t in platform.store.tenants.values()
    ]
    return {"tenants": tenants, "total": len(tenants)}


class Login(BaseModel):
    email: str
    password: str


@app.post("/v1/login")
async def login(req: Login):
    try:
        token, refresh = await platform.store.alogin(req.email, req.password)
        return {"token": token, "refresh_token": refresh, "token_type": "bearer"}
    except AuthError as e:
        raise HTTPException(401, str(e))


class RefreshReq(BaseModel):
    refresh_token: str


@app.post("/v1/refresh")
async def refresh_token_endpoint(req: RefreshReq):
    try:
        claims = await platform.store.ause_refresh_token(req.refresh_token)
        new_token = issue_token(
            {"sub": claims["user_id"], "tid": claims["tenant_id"],
             "role": claims["role"], "kind": "user"},
            platform.store.signing_key
        )
        new_refresh = await platform.store.aissue_refresh_token(
            claims["user_id"], claims["tenant_id"], claims["role"]
        )
        return {"token": new_token, "refresh_token": new_refresh, "token_type": "bearer"}
    except AuthError as e:
        raise HTTPException(401, str(e))


class LogoutReq(BaseModel):
    refresh_token: str = ""


@app.post("/v1/logout")
async def logout_endpoint(req: LogoutReq):
    if req.refresh_token:
        try:
            await platform.store.ause_refresh_token(req.refresh_token)
        except Exception:
            pass
    return {"status": "logged_out"}


@app.get("/v1/whoami")
def whoami(p: Principal = Depends(Require())):
    return {"tenant_id": p.tenant_id, "subject": p.subject, "role": p.role,
            "kind": p.kind, "permissions": sorted(p.permissions)}


# --- a guarded, metered product action --------------------------------------
class RunReq(BaseModel):
    concept: str = "A shy turtle learns to share"
    est_cost_usd: float = 0.0          # a real run would carry gateway cost


@app.post("/v1/studio/run")
def studio_run(req: RunReq, p: Principal = Depends(Require(Perm.STUDIO_RUN))):
    tenant = platform.store.tenants[p.tenant_id]
    try:
        platform.meter.check_quota(tenant, add_cost=req.est_cost_usd, add_jobs=1)
    except QuotaExceeded as e:
        platform.log.emit("quota_exceeded", tenant_id=tenant.id, detail=str(e))
        raise HTTPException(402, str(e))   # 402 Payment Required
    with platform.log.span("studio.run", concept=req.concept[:40]):
        platform.meter.record(tenant.id, "job", 1, req.est_cost_usd)
    return {"status": "queued", "request_id": context()["request_id"],
            "metered_cost_usd": req.est_cost_usd}


@app.get("/v1/usage")
def usage(p: Principal = Depends(Require(Perm.USAGE_READ))):
    return platform.meter.summary(platform.store.tenants[p.tenant_id])


@app.get("/v1/observability/tail")
def tail(p: Principal = Depends(Require(Perm.ADMIN))):
    return {"events": platform.log.tail(40)}


@app.get("/healthz")
def healthz():
    return {"status": "ok", "tenants": len(platform.store.tenants)}
