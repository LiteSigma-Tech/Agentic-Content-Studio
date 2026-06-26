# Platform Pillars (B0–B1)

The cross-cutting foundation that makes the six product slices deployable at
scale: **multi-tenancy + auth, RBAC, usage metering + quotas, rate limiting, and
observability** — built as reusable services and FastAPI dependencies that any
product API mounts. Runs fully offline.

## What's here

- **Multi-tenancy + auth** (`tenancy.py`) — tenants, users, and API keys. Every
  principal is tenant-scoped, so all data access is isolated by tenant.
  - Passwords and API-key secrets are stored only as **PBKDF2-HMAC-SHA256**
    hashes with per-secret salts; verification is constant-time.
  - Bearer tokens are **HMAC-SHA256 signed** with an expiry; tampered or expired
    tokens are rejected (constant-time signature check).
- **RBAC** (`rbac.py`) — roles (`viewer`, `creator`, `operator`, `admin`) map to
  named permissions (`studio.run`, `outreach.approve`, `usage.read`, …). Routes
  declare the permission they need.
- **Usage metering + quotas** (`metering.py`) — records every billable action
  with its cost, keeps per-tenant totals, and enforces spend/job quotas. This is
  where the gateway's per-call cost and the agent runtime's spend caps roll up to
  a tenant bill.
- **Rate limiting** (`ratelimit.py`) — a refilling token bucket per tenant.
- **Observability** (`observability.py`) — request id + tenant context, a
  structured event log, and timed spans.

## The request lifecycle (wired in `app.py`)

```
middleware:  assign request id → time the request → emit access log (+ X-Request-Id)
dependency:  authenticate (Bearer | X-API-Key) → rate-limit → set tenant context
             → check the route's required permission
handler:     check quota → do work → meter usage
```

Each step returns the right signal at the edge: **401** no/invalid credentials,
**403** missing permission, **429** rate limited, **402** quota exceeded.

## Run it

```bash
pip install -r ../requirements.txt
python tests_platform.py                      # 10 offline tests
uvicorn platform_core.app:app --reload        # from repo root; docs at /docs
```

```bash
# bootstrap a tenant (returns an API key once)
KEY=$(curl -s localhost:8000/admin/tenants -H 'content-type: application/json' \
  -d '{"name":"Helios","admin_email":"ops@helios.co","admin_password":"pw"}' | jq -r .api_key)
curl -s localhost:8000/v1/whoami      -H "X-API-Key: $KEY"
curl -s localhost:8000/v1/studio/run  -H "X-API-Key: $KEY" -H 'content-type: application/json' -d '{"est_cost_usd":0.25}'
curl -s localhost:8000/v1/usage       -H "X-API-Key: $KEY"
```

## How the product slices mount this

The studio, lead-gen, agent, and gateway APIs each replace their open endpoints
with `Depends(Require("<perm>"))`, call `meter.check_quota(...)` before work and
`meter.record(...)` after, and inherit the request-id + access-log middleware.
The per-job cost they already compute (gateway cost capture, agent spend) is what
gets metered here.

## Production notes (flags, not the real thing)

- Auth here is a minimal, correct implementation for a self-contained build. In
  production use a vetted IdP / OAuth + a managed secrets store, and a real JWT
  library — not hand-rolled token code.
- Tenant/user/key/usage data is in-memory; production is Postgres (tenant-scoped
  rows) + a metering table with billing reconciliation.
- Rate limiting is in-process; production is Redis-backed so it holds across
  instances. Observability maps onto OpenTelemetry + a tracing backend.
- The **durable queue** pillar from the plan is already embodied by each slice's
  checkpoint/resume store (video/audio pipeline, agent runs); production swaps
  those onto **Temporal** workflows/activities — same logic, durable infra.

## Where this leaves the build

This completes the backend foundation. The full system now stands as:

```
platform_core   auth · tenancy · RBAC · metering · quotas · rate limit · observability
model_gateway   config-driven, swappable, free-first models
agent_runtime   tools · HITL · memory · guardrails · durable runs        (B2)
video_studio    concept → silent episode                                 (B4)
audio_studio    + voices, music, ducked mix → final A/V                  (B5)
lead_gen        compliant funnel + approval-gated outreach (on B2)        (B3)
frontend        operator console over all of it
```

**41 tests across the six backend slices, all green.** Remaining productionization
is infrastructure, not new logic: real model backends behind the gateway,
Temporal, Postgres/Redis, a managed IdP, and building out the production Next.js
frontend from the prototype.
