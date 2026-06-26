"""Platform facade + FastAPI surface that ties the pillars together and shows
how a product API (here a stub studio-run) is guarded, metered, and observed.

Request lifecycle:
  middleware: assign request id -> time the request -> emit access log
  dependency: authenticate (bearer or API key) -> rate-limit -> set tenant
              context -> check the route's required permission
  handler:    check quota -> do work -> meter usage
"""
from __future__ import annotations

import time

from fastapi import Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel

from .metering import QuotaExceeded, UsageMeter
from .observability import EventLog, context, new_request_id, set_tenant
from .ratelimit import RateLimited, RateLimiter
from .rbac import Perm
from .tenancy import AuthError, Principal, TenantStore


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


@app.post("/admin/tenants")
def create_tenant(req: NewTenant):
    """Bootstrap a tenant with an admin user + API key. In production this sits
    behind platform-admin auth / a signup flow."""
    t = platform.store.create_tenant(req.name, plan=req.plan)
    platform.store.create_user(t.id, req.admin_email, req.admin_password, role="admin")
    _, key = platform.store.issue_api_key(t.id, role="admin")
    platform.log.emit("tenant_created", tenant_id=t.id)
    return {"tenant_id": t.id, "api_key": key,
            "note": "store this key now — it is not shown again"}


class Login(BaseModel):
    email: str
    password: str


@app.post("/v1/login")
def login(req: Login):
    try:
        return {"token": platform.store.login(req.email, req.password), "token_type": "bearer"}
    except AuthError as e:
        raise HTTPException(401, str(e))


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
