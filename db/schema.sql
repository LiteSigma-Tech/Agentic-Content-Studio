-- platform_core
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    cost_cap_usd DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    job_cap INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'creator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    secret_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'creator',
    last_used DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_events (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    qty DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    ts DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_events_tenant_idx ON usage_events(tenant_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    role TEXT NOT NULL,
    expires_at DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);

-- model_gateway
CREATE TABLE IF NOT EXISTS routing_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    config_json TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- agent_runtime
CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    run_json TEXT NOT NULL,
    tenant_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_memory (
    id BIGSERIAL PRIMARY KEY,
    namespace TEXT NOT NULL,
    text TEXT NOT NULL,
    meta_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_memory_ns_idx ON agent_memory(namespace);

-- video_studio / audio_studio
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    project_json TEXT NOT NULL,
    tenant_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- lead_gen
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    lead_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sourced',
    dedupe_key TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_dedupe_idx ON leads(dedupe_key);
CREATE INDEX IF NOT EXISTS leads_tenant_idx ON leads(tenant_id);

CREATE TABLE IF NOT EXISTS suppression_list (
    email TEXT PRIMARY KEY,
    reason TEXT NOT NULL DEFAULT 'unsubscribed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outreach_records (
    run_id TEXT PRIMARY KEY,
    tenant_id TEXT,
    record_json TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
