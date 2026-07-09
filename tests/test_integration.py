"""HTTP integration tests — exercise every service's FastAPI surface end-to-end.

All tests run fully offline (no real database, Redis, or LLM).  The stores fall
back to in-memory / tempdir when DATABASE_URL is not set.  Run with:

    python tests/test_integration.py
    # or:
    pytest tests/test_integration.py -v
"""
from __future__ import annotations

import sys
import tempfile
import os
from pathlib import Path

# Ensure project root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# ── helpers ───────────────────────────────────────────────────────────────────

_passed = _failed = 0


def _ok(name: str) -> None:
    global _passed
    _passed += 1
    print(f"  PASS  {name}")


def _fail(name: str, exc: BaseException) -> None:
    global _failed
    _failed += 1
    print(f"  FAIL  {name}")
    print(f"        {type(exc).__name__}: {exc}")


def check(name: str):
    """Decorator-style context manager for one test case."""
    import contextlib

    @contextlib.contextmanager
    def _ctx():
        try:
            yield
            _ok(name)
        except Exception as e:
            _fail(name, e)

    return _ctx()


# ── platform_core ─────────────────────────────────────────────────────────────

_BOOTSTRAP_TOKEN = "test-bootstrap-token-for-integration-tests"


def _platform_client():
    os.environ["ADMIN_BOOTSTRAP_TOKEN"] = _BOOTSTRAP_TOKEN
    from fastapi.testclient import TestClient
    from platform_core.app import app
    return TestClient(app)


def _bootstrap_headers():
    return {"Authorization": f"Bearer {_BOOTSTRAP_TOKEN}"}


def test_platform_create_tenant():
    c = _platform_client()
    with check("POST /admin/tenants creates tenant + api key"):
        r = c.post("/admin/tenants", json={
            "name": "Acme", "admin_email": "admin@acme.com",
            "admin_password": "s3cr3t", "plan": "paid"},
            headers=_bootstrap_headers())
        assert r.status_code == 200
        d = r.json()
        assert "tenant_id" in d
        assert d["api_key"].startswith("ak_")

    with check("POST /admin/tenants without token returns 403"):
        r = c.post("/admin/tenants", json={
            "name": "X", "admin_email": "x@x.com", "admin_password": "x"})
        assert r.status_code == 403

    with check("POST /admin/tenants with wrong token returns 403"):
        r = c.post("/admin/tenants", json={
            "name": "X", "admin_email": "x@x.com", "admin_password": "x"},
            headers={"Authorization": "Bearer wrong-token"})
        assert r.status_code == 403


def test_platform_login_and_whoami():
    c = _platform_client()
    # Create tenant first
    c.post("/admin/tenants", json={
        "name": "Login Corp", "admin_email": "login@corp.com",
        "admin_password": "pass123", "plan": "free"},
        headers=_bootstrap_headers())

    with check("POST /v1/login returns token"):
        r = c.post("/v1/login", json={"email": "login@corp.com", "password": "pass123"})
        assert r.status_code == 200
        token = r.json()["token"]
        assert token

    with check("GET /v1/whoami returns principal"):
        token = c.post("/v1/login", json={"email": "login@corp.com", "password": "pass123"}).json()["token"]
        r = c.get("/v1/whoami", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    with check("POST /v1/login bad creds returns 401"):
        r = c.post("/v1/login", json={"email": "login@corp.com", "password": "wrong"})
        assert r.status_code == 401


def test_platform_refresh_and_logout():
    c = _platform_client()
    c.post("/admin/tenants", json={
        "name": "Refresh Co", "admin_email": "refresh@co.com",
        "admin_password": "abc123", "plan": "free"},
        headers=_bootstrap_headers())

    with check("POST /v1/refresh issues new token"):
        login = c.post("/v1/login", json={"email": "refresh@co.com", "password": "abc123"}).json()
        r = c.post("/v1/refresh", json={"refresh_token": login["refresh_token"]})
        assert r.status_code == 200
        assert "token" in r.json()

    with check("POST /v1/logout succeeds"):
        login = c.post("/v1/login", json={"email": "refresh@co.com", "password": "abc123"}).json()
        r = c.post("/v1/logout", json={"refresh_token": login["refresh_token"]})
        assert r.status_code == 200


def test_platform_list_tenants():
    c = _platform_client()
    c.post("/admin/tenants", json={
        "name": "List Tenant", "admin_email": "list@t.com",
        "admin_password": "pw", "plan": "free"},
        headers=_bootstrap_headers())
    token = c.post("/v1/login", json={"email": "list@t.com", "password": "pw"}).json()["token"]

    with check("GET /admin/tenants returns tenant list for admin"):
        r = c.get("/admin/tenants", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert "tenants" in r.json()
        assert len(r.json()["tenants"]) >= 1

    with check("GET /admin/tenants returns 401 without auth"):
        r = c.get("/admin/tenants")
        assert r.status_code == 401


def test_platform_rbac_non_admin():
    c = _platform_client()
    # Create a creator-role user manually via the store directly
    from platform_core.app import platform
    t = platform.store.create_tenant("Creator Tenant", plan="free")
    platform.store.create_user(t.id, "creator@t.com", "pw", role="creator")

    with check("GET /admin/tenants returns 403 for non-admin"):
        token = c.post("/v1/login", json={"email": "creator@t.com", "password": "pw"}).json()["token"]
        r = c.get("/admin/tenants", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403


def test_platform_usage():
    c = _platform_client()
    c.post("/admin/tenants", json={
        "name": "Usage Co", "admin_email": "usage@co.com",
        "admin_password": "pw", "plan": "free"},
        headers=_bootstrap_headers())
    token = c.post("/v1/login", json={"email": "usage@co.com", "password": "pw"}).json()["token"]

    with check("GET /v1/usage returns usage summary"):
        r = c.get("/v1/usage", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert "total_cost_usd" in r.json()


def test_platform_healthz():
    c = _platform_client()
    with check("GET /healthz returns ok"):
        r = c.get("/healthz")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ── agent_runtime ─────────────────────────────────────────────────────────────

def test_agents_all():
    """All agent HTTP tests share one client + tempdir to avoid module-reload issues."""
    from pathlib import Path
    from fastapi.testclient import TestClient
    from agent_runtime.api import app, runtime, webhook_store

    with tempfile.TemporaryDirectory() as tmp:
        # Patch the module-level runtime's store to use the temp directory
        original_root = runtime.store.root
        runtime.store.root = Path(tmp)
        runtime.store.root.mkdir(parents=True, exist_ok=True)

        c = TestClient(app)

        # ---- create + run
        with check("POST /v1/agents/researcher/runs creates a run"):
            r = c.post("/v1/agents/researcher/runs", json={"goal": "research AI trends"})
            assert r.status_code == 200
            run_id = r.json()["id"]
            assert run_id

        with check("GET /v1/runs/{id} returns run status"):
            r = c.get(f"/v1/runs/{run_id}")
            assert r.status_code == 200
            assert r.json()["id"] == run_id

        with check("POST /v1/runs/{id}/run executes to a terminal state"):
            r = c.post(f"/v1/runs/{run_id}/run")
            assert r.status_code == 200
            assert r.json()["status"] in ("done", "failed", "aborted", "awaiting_approval")

        with check("GET /v1/runs/{id}/trace has trace entries"):
            r = c.get(f"/v1/runs/{run_id}/trace")
            assert r.status_code == 200
            assert len(r.json()["trace"]) > 0

        with check("GET /v1/runs lists runs"):
            r = c.get("/v1/runs")
            assert r.status_code == 200
            assert len(r.json()["items"]) >= 1

        # ---- 404 cases
        with check("POST /v1/agents/unknown/runs returns 404"):
            r = c.post("/v1/agents/nonexistent/runs", json={"goal": "test"})
            assert r.status_code == 404

        with check("GET /v1/runs/nonexistent returns 404"):
            r = c.get("/v1/runs/nonexistentid")
            assert r.status_code == 404

        with check("POST /v1/runs/nonexistent/run returns 404"):
            r = c.post("/v1/runs/nonexistentid/run")
            assert r.status_code == 404

        with check("POST /v1/runs/nonexistent/approve returns 404"):
            r = c.post("/v1/runs/nonexistentid/approve",
                       json={"approved": True, "note": ""})
            assert r.status_code == 404

        # ---- approve on non-awaiting run → 409
        with check("POST /v1/runs/{id}/approve on non-awaiting run returns 409"):
            r2 = c.post("/v1/agents/researcher/runs", json={"goal": "short"})
            rid2 = r2.json()["id"]
            c.post(f"/v1/runs/{rid2}/run")
            status2 = c.get(f"/v1/runs/{rid2}").json()["status"]
            if status2 != "awaiting_approval":
                r = c.post(f"/v1/runs/{rid2}/approve", json={"approved": True, "note": ""})
                assert r.status_code == 409

        # ---- healthz
        with check("GET /healthz returns ok"):
            r = c.get("/healthz")
            assert r.status_code == 200

        # ---- webhooks
        # Clear any leftover hooks from module-level state
        for h in list(webhook_store.list()):
            webhook_store.delete(h.id)

        with check("POST /v1/webhooks registers a webhook"):
            r = c.post("/v1/webhooks", json={
                "url": "https://example.com/hook",
                "events": ["run.done", "run.failed"],
                "secret": "mysecret"})
            assert r.status_code == 201
            hook_id = r.json()["id"]

        with check("GET /v1/webhooks lists registered webhooks"):
            r = c.get("/v1/webhooks")
            assert r.status_code == 200
            assert len(r.json()["webhooks"]) == 1

        with check("DELETE /v1/webhooks/{id} removes the webhook"):
            r = c.delete(f"/v1/webhooks/{hook_id}")
            assert r.status_code == 200

        with check("GET /v1/webhooks after delete returns empty list"):
            r = c.get("/v1/webhooks")
            assert len(r.json()["webhooks"]) == 0

        with check("DELETE /v1/webhooks/nonexistent returns 404"):
            r = c.delete("/v1/webhooks/nonexistent")
            assert r.status_code == 404

        with check("POST /v1/webhooks invalid URL returns 422"):
            r = c.post("/v1/webhooks", json={
                "url": "not-a-url", "events": ["run.done"]})
            assert r.status_code == 422

        # Restore original root
        runtime.store.root = original_root


# ── audio_studio ──────────────────────────────────────────────────────────────

def test_studio_all():
    """All studio HTTP tests share one client + tempdir."""
    from pathlib import Path
    from fastapi.testclient import TestClient
    from audio_studio.api import app, store as studio_store

    with tempfile.TemporaryDirectory() as tmp:
        original_root = studio_store.root
        studio_store.root = Path(tmp)
        studio_store.root.mkdir(parents=True, exist_ok=True)

        c = TestClient(app)

        with check("POST /v1/projects creates a project"):
            r = c.post("/v1/projects", json={
                "concept": "A turtle learns to share", "genre": "kids_cartoon"})
            assert r.status_code == 200
            pid = r.json()["id"]
            assert pid

        with check("GET /v1/projects/{id} returns project status"):
            r = c.get(f"/v1/projects/{pid}")
            assert r.status_code == 200

        with check("GET /v1/projects lists projects"):
            r = c.get("/v1/projects")
            assert r.status_code == 200
            assert len(r.json()["items"]) >= 1

        with check("GET /v1/projects/nonexistent returns 404"):
            r = c.get("/v1/projects/nonexistent")
            assert r.status_code == 404

        with check("POST /v1/projects/nonexistent/run returns 404"):
            r = c.post("/v1/projects/nonexistent/run", json={})
            assert r.status_code == 404

        with check("POST /v1/projects/{id}/run (sync) runs the pipeline"):
            r2 = c.post("/v1/projects", json={"concept": "Adventure", "genre": "drama"})
            pid2 = r2.json()["id"]
            r = c.post(f"/v1/projects/{pid2}/run", json={"background": False})
            assert r.status_code == 200
            assert "stages" in r.json()

        with check("GET /healthz returns ok"):
            r = c.get("/healthz")
            assert r.status_code == 200

        studio_store.root = original_root


# ── lead_gen ──────────────────────────────────────────────────────────────────

def _leads_client():
    os.environ.pop("GATEWAY_URL", None)
    from fastapi.testclient import TestClient
    from lead_gen.api import app
    return TestClient(app)


def test_leads_flow():
    c = _leads_client()

    with check("GET /v1/leads returns empty list initially"):
        r = c.get("/v1/leads")
        assert r.status_code == 200

    with check("POST /v1/icp sets ICP"):
        r = c.post("/v1/icp", json={
            "industry": "SaaS", "company_size": "50-500",
            "region": "US", "title_keywords": ["VP", "Head of"], "min_score": 60})
        assert r.status_code == 200

    with check("POST /v1/leads/source generates leads"):
        r = c.post("/v1/leads/source", json={"n": 5})
        assert r.status_code == 200

    with check("GET /v1/leads lists sourced leads"):
        r = c.get("/v1/leads")
        assert r.status_code == 200
        assert len(r.json()["items"]) > 0

    with check("POST /v1/leads/qualify scores leads"):
        r = c.post("/v1/leads/qualify")
        assert r.status_code == 200

    with check("POST /v1/leads/compliance applies compliance gate"):
        r = c.post("/v1/leads/compliance")
        assert r.status_code == 200

    with check("POST /v1/unsubscribe adds to suppression"):
        r = c.post("/v1/unsubscribe", json={"email": "test@example.com"})
        assert r.status_code == 200


def test_leads_healthz():
    c = _leads_client()
    with check("GET /healthz returns ok"):
        r = c.get("/healthz")
        assert r.status_code == 200


# ── webhook delivery ──────────────────────────────────────────────────────────

def test_webhook_delivery_unit():
    import asyncio
    from shared.webhooks import WebhookStore, deliver_event, _sign

    store = WebhookStore()

    with check("WebhookStore register + find_by_event"):
        h = store.register("https://example.com/hook", ["run.done"], "secret")
        found = store.find_by_event("run.done")
        assert len(found) == 1 and found[0].id == h.id
        assert len(store.find_by_event("run.failed")) == 0

    with check("WebhookStore delete removes hook"):
        h2 = store.register("https://x.com/h", ["run.done"], "")
        assert store.delete(h2.id)
        assert store.get(h2.id) is None

    with check("HMAC signature is non-empty and deterministic"):
        sig = _sign(b"payload", "mysecret")
        assert len(sig) == 64
        assert sig == _sign(b"payload", "mysecret")

    with check("deliver_event fires and swallows delivery failures"):
        # Unreachable URL — should not raise
        store2 = WebhookStore()
        store2.register("http://127.0.0.1:19999/nope", ["run.done"], "")
        asyncio.run(deliver_event(store2, "run.done", {"id": "abc"}))


# ── entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("─" * 66)
    print("  Integration tests")
    print("─" * 66)

    test_platform_create_tenant()
    test_platform_login_and_whoami()
    test_platform_refresh_and_logout()
    test_platform_list_tenants()
    test_platform_rbac_non_admin()
    test_platform_usage()
    test_platform_healthz()

    test_agents_all()

    test_studio_all()

    test_leads_flow()
    test_leads_healthz()

    test_webhook_delivery_unit()

    print("─" * 66)
    total = _passed + _failed
    if _failed == 0:
        print(f"  All {total} integration tests passed")
    else:
        print(f"  {_passed}/{total} passed · {_failed} failed")
        sys.exit(1)
