"""Runs fully offline. Verifies auth (token + API key, tamper/expiry), RBAC,
tenant isolation, usage metering + quota enforcement, rate limiting, and that
requests get a request id + structured access logs.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from platform_core.metering import QuotaExceeded, UsageMeter  # noqa: E402
from platform_core.ratelimit import RateLimited, RateLimiter  # noqa: E402
from platform_core.rbac import Perm, role_can  # noqa: E402
from platform_core.tenancy import (AuthError, TenantStore, TokenError,  # noqa: E402
                              hash_secret, issue_token, verify_secret, verify_token)


# --- hashing + tokens --------------------------------------------------------
def test_secret_hashing_roundtrip():
    h = hash_secret("hunter2")
    assert verify_secret("hunter2", h)
    assert not verify_secret("wrong", h)
    assert h != hash_secret("hunter2")        # salted -> different each time


def test_token_sign_verify_tamper_expiry():
    key = b"k" * 32
    tok = issue_token({"sub": "u1", "tid": "t1", "role": "admin"}, key, ttl_s=60)
    assert verify_token(tok, key)["sub"] == "u1"
    # tampered signature rejected
    bad = tok[:-2] + ("aa" if not tok.endswith("aa") else "bb")
    try:
        verify_token(bad, key); assert False
    except TokenError:
        pass
    # expired rejected
    exp = issue_token({"sub": "u1"}, key, ttl_s=-1)
    try:
        verify_token(exp, key); assert False
    except TokenError as e:
        assert "expired" in str(e)


# --- auth + rbac -------------------------------------------------------------
def test_login_token_and_api_key_auth():
    s = TenantStore()
    t = s.create_tenant("Acme")
    s.create_user(t.id, "a@acme.com", "pw", role="creator")
    p = s.auth_bearer(s.login("a@acme.com", "pw"))
    assert p.tenant_id == t.id and p.role == "creator"
    assert p.can(Perm.STUDIO_RUN) and not p.can(Perm.OUTREACH_APPROVE)
    _, key = s.issue_api_key(t.id, role="operator")
    pk = s.auth_api_key(key)
    assert pk.kind == "api_key" and pk.can(Perm.OUTREACH_APPROVE)


def test_invalid_credentials_rejected():
    s = TenantStore()
    t = s.create_tenant("Acme")
    s.create_user(t.id, "a@acme.com", "pw")
    for bad in [lambda: s.login("a@acme.com", "nope"),
                lambda: s.auth_api_key("ak_x.deadbeef"),
                lambda: s.auth_bearer("not.a.token")]:
        try:
            bad(); assert False, "should reject"
        except AuthError:
            pass


def test_rbac_role_matrix():
    assert role_can("viewer", Perm.STUDIO_READ)
    assert not role_can("viewer", Perm.STUDIO_RUN)
    assert role_can("operator", Perm.OUTREACH_APPROVE)
    assert role_can("admin", Perm.ADMIN)


def test_tenant_isolation():
    s = TenantStore()
    t1, t2 = s.create_tenant("One"), s.create_tenant("Two")
    _, k1 = s.issue_api_key(t1.id)
    p1 = s.auth_api_key(k1)
    assert p1.tenant_id == t1.id and p1.tenant_id != t2.id


# --- metering + quota --------------------------------------------------------
def test_metering_accumulates_and_summarizes():
    m = UsageMeter()
    s = TenantStore(); t = s.create_tenant("Acme", cost_cap_usd=10.0)
    m.record(t.id, "llm", 1, 0.01)
    m.record(t.id, "video", 1, 0.50)
    m.record(t.id, "job", 1, 0.0)
    summ = m.summary(t)
    assert abs(summ["total_cost_usd"] - 0.51) < 1e-9
    assert summ["jobs"] == 1
    assert summ["by_kind"]["video"]["cost_usd"] == 0.50


def test_quota_blocks_over_cap():
    m = UsageMeter()
    s = TenantStore(); t = s.create_tenant("Acme", cost_cap_usd=1.0, job_cap=2)
    m.record(t.id, "job", 1, 0.80)
    m.check_quota(t, add_cost=0.10, add_jobs=1)        # ok, under caps
    try:
        m.check_quota(t, add_cost=0.50, add_jobs=1)     # would exceed cost cap
        assert False
    except QuotaExceeded as e:
        assert "spend quota" in str(e)
    m.record(t.id, "job", 1, 0.0)
    try:
        m.check_quota(t, add_jobs=1)                    # would exceed job cap (2)
        assert False
    except QuotaExceeded as e:
        assert "job quota" in str(e)


# --- rate limit --------------------------------------------------------------
def test_rate_limit_trips_then_refills():
    rl = RateLimiter(rate_per_s=100, burst=3)
    for _ in range(3):
        rl.check("t1")
    try:
        rl.check("t1"); assert False
    except RateLimited:
        pass
    time.sleep(0.05)            # refills ~5 tokens at 100/s
    rl.check("t1")             # allowed again


# --- HTTP end-to-end (auth -> rbac -> quota -> meter -> observe) -------------
def test_http_flow_with_testclient():
    from fastapi.testclient import TestClient
    from platform_core.app import app, platform
    c = TestClient(app)

    # unauthenticated is rejected
    assert c.get("/v1/whoami").status_code == 401

    boot = c.post("/admin/tenants", json={"name": "Acme", "admin_email": "a@acme.com",
                                          "admin_password": "pw"}).json()
    key = boot["api_key"]
    h = {"X-API-Key": key}

    who = c.get("/v1/whoami", headers=h).json()
    assert who["role"] == "admin" and "admin" in who["permissions"]

    run = c.post("/v1/studio/run", headers=h, json={"est_cost_usd": 0.25})
    assert run.status_code == 200 and "X-Request-Id" in run.headers
    assert run.json()["metered_cost_usd"] == 0.25

    usage = c.get("/v1/usage", headers=h).json()
    assert usage["total_cost_usd"] == 0.25 and usage["jobs"] == 1

    # a creator (no outreach.approve) is forbidden from an admin-only endpoint
    tid = boot["tenant_id"]
    _, ckey = platform.store.issue_api_key(tid, role="creator")
    assert c.get("/v1/observability/tail", headers={"X-API-Key": ckey}).status_code == 403

    # access logs were recorded with a request id
    assert any(e["event"] == "http_access" for e in platform.log.events)


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(fns)} tests passed.")
