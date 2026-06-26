"""Multi-tenancy + authentication.

Security notes (this is a minimal, correct-by-construction implementation for a
self-contained build; production would use a vetted IdP/OAuth and a managed
secrets store):
  - passwords and API-key secrets are stored only as PBKDF2-HMAC-SHA256 hashes
    with per-secret salts; verification is constant-time.
  - bearer tokens are HMAC-SHA256 signed (header-free compact form) with an
    expiry; signatures are compared in constant time.
  - every principal carries a tenant id; all data access is tenant-scoped.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import uuid
from dataclasses import dataclass, field

from .rbac import ROLE_PERMS, permissions_for

_ITER = 100_000


# --- hashing -----------------------------------------------------------------
def hash_secret(secret: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", secret.encode(), salt, _ITER)
    return f"{salt.hex()}${dk.hex()}"


def verify_secret(secret: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", secret.encode(), bytes.fromhex(salt_hex), _ITER)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


# --- signed tokens (compact HMAC) -------------------------------------------
def _b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _b64u_dec(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


class TokenError(Exception):
    pass


def issue_token(claims: dict, signing_key: bytes, ttl_s: int = 3600) -> str:
    now = int(time.time())
    body = {**claims, "iat": now, "exp": now + ttl_s}
    payload = _b64u(json.dumps(body, separators=(",", ":")).encode())
    sig = _b64u(hmac.new(signing_key, payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def verify_token(token: str, signing_key: bytes) -> dict:
    try:
        payload, sig = token.split(".")
    except ValueError:
        raise TokenError("malformed token")
    expected = _b64u(hmac.new(signing_key, payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        raise TokenError("bad signature")
    body = json.loads(_b64u_dec(payload))
    if int(body.get("exp", 0)) < int(time.time()):
        raise TokenError("token expired")
    return body


# --- models ------------------------------------------------------------------
@dataclass
class Tenant:
    id: str
    name: str
    plan: str = "free"
    cost_cap_usd: float = 5.0          # per-period spend quota
    job_cap: int = 100                 # per-period job quota


@dataclass
class User:
    id: str
    tenant_id: str
    email: str
    password_hash: str
    role: str = "creator"


@dataclass
class ApiKey:
    id: str
    tenant_id: str
    secret_hash: str
    role: str = "creator"
    last_used: float = 0.0


@dataclass
class Principal:
    """Resolved, authenticated context. The tenant scope for the request."""
    tenant_id: str
    subject: str                       # user id or api-key id
    role: str
    kind: str                          # "user" | "api_key"
    permissions: set = field(default_factory=set)

    def can(self, perm: str) -> bool:
        return perm in self.permissions


# --- store + auth ------------------------------------------------------------
class AuthError(Exception):
    pass


class TenantStore:
    """In-memory for a runnable build; Postgres (tenant-scoped rows) in prod."""

    def __init__(self, signing_key: bytes | None = None):
        self.signing_key = signing_key or os.environ.get(
            "PLATFORM_SIGNING_KEY", secrets.token_hex(32)).encode()
        self.tenants: dict[str, Tenant] = {}
        self.users: dict[str, User] = {}
        self.keys: dict[str, ApiKey] = {}

    # tenant + user + key creation
    def create_tenant(self, name: str, plan: str = "free", **quotas) -> Tenant:
        t = Tenant(id="t_" + uuid.uuid4().hex[:10], name=name, plan=plan,
                   **{k: v for k, v in quotas.items() if k in ("cost_cap_usd", "job_cap")})
        self.tenants[t.id] = t
        return t

    def create_user(self, tenant_id: str, email: str, password: str,
                    role: str = "creator") -> User:
        if role not in ROLE_PERMS:
            raise AuthError(f"unknown role: {role}")
        u = User(id="u_" + uuid.uuid4().hex[:10], tenant_id=tenant_id, email=email,
                 password_hash=hash_secret(password), role=role)
        self.users[u.id] = u
        return u

    def issue_api_key(self, tenant_id: str, role: str = "creator") -> tuple[ApiKey, str]:
        """Returns (record, plaintext_key). The plaintext is shown ONCE."""
        kid = "ak_" + uuid.uuid4().hex[:10]
        secret = secrets.token_urlsafe(24)
        rec = ApiKey(id=kid, tenant_id=tenant_id, secret_hash=hash_secret(secret), role=role)
        self.keys[kid] = rec
        return rec, f"{kid}.{secret}"

    # authentication
    def login(self, email: str, password: str) -> str:
        user = next((u for u in self.users.values() if u.email == email), None)
        if not user or not verify_secret(password, user.password_hash):
            raise AuthError("invalid credentials")
        return issue_token({"sub": user.id, "tid": user.tenant_id, "role": user.role,
                            "kind": "user"}, self.signing_key)

    def _principal(self, tenant_id, subject, role, kind) -> Principal:
        return Principal(tenant_id=tenant_id, subject=subject, role=role, kind=kind,
                         permissions=permissions_for(role))

    def auth_bearer(self, token: str) -> Principal:
        try:
            c = verify_token(token, self.signing_key)
        except TokenError as e:
            raise AuthError(str(e))
        return self._principal(c["tid"], c["sub"], c["role"], "user")

    def auth_api_key(self, key: str) -> Principal:
        try:
            kid, secret = key.split(".", 1)
        except ValueError:
            raise AuthError("malformed api key")
        rec = self.keys.get(kid)
        if not rec or not verify_secret(secret, rec.secret_hash):
            raise AuthError("invalid api key")
        rec.last_used = time.time()
        return self._principal(rec.tenant_id, rec.id, rec.role, "api_key")
