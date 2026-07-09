"""Initial schema — all tables for the full agentic platform.

Revision ID: 0001
Revises:
Create Date: 2025-06-27

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import TIMESTAMP

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── platform_core ─────────────────────────────────────────────────────────
    op.create_table(
        "tenants",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("plan", sa.String(), nullable=False, server_default="free"),
        sa.Column("cost_cap_usd", sa.Double(), nullable=False, server_default="5.0"),
        sa.Column("job_cap", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="creator"),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "api_keys",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("secret_hash", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="creator"),
        sa.Column("last_used", sa.Double(), nullable=False, server_default="0.0"),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "usage_events",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("qty", sa.Double(), nullable=False, server_default="1.0"),
        sa.Column("cost_usd", sa.Double(), nullable=False, server_default="0.0"),
        sa.Column("ts", sa.Double(), nullable=False),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("usage_events_tenant_idx", "usage_events", ["tenant_id"])

    op.create_table(
        "refresh_tokens",
        sa.Column("token", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("expires_at", sa.Double(), nullable=False),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("refresh_tokens_user_idx", "refresh_tokens", ["user_id"])

    # ── model_gateway ─────────────────────────────────────────────────────────
    op.create_table(
        "routing_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("config_json", sa.Text(), nullable=False),
        sa.Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── agent_runtime ─────────────────────────────────────────────────────────
    op.create_table(
        "agent_runs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("run_json", sa.Text(), nullable=False),
        sa.Column("tenant_id", sa.String()),
        sa.Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "agent_memory",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("namespace", sa.String(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("meta_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("agent_memory_ns_idx", "agent_memory", ["namespace"])

    # ── video_studio / audio_studio ───────────────────────────────────────────
    op.create_table(
        "projects",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_json", sa.Text(), nullable=False),
        sa.Column("tenant_id", sa.String()),
        sa.Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── lead_gen ──────────────────────────────────────────────────────────────
    op.create_table(
        "leads",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String()),
        sa.Column("lead_json", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="sourced"),
        sa.Column("dedupe_key", sa.String()),
        sa.Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("leads_dedupe_idx", "leads", ["dedupe_key"])
    op.create_index("leads_tenant_idx", "leads", ["tenant_id"])

    op.create_table(
        "suppression_list",
        sa.Column("email", sa.String(), primary_key=True),
        sa.Column("reason", sa.String(), nullable=False, server_default="unsubscribed"),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "outreach_records",
        sa.Column("run_id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String()),
        sa.Column("record_json", sa.Text(), nullable=False),
        sa.Column("updated_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("outreach_records")
    op.drop_table("suppression_list")
    op.drop_index("leads_tenant_idx", "leads")
    op.drop_index("leads_dedupe_idx", "leads")
    op.drop_table("leads")
    op.drop_table("projects")
    op.drop_index("agent_memory_ns_idx", "agent_memory")
    op.drop_table("agent_memory")
    op.drop_table("agent_runs")
    op.drop_table("routing_config")
    op.drop_index("refresh_tokens_user_idx", "refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index("usage_events_tenant_idx", "usage_events")
    op.drop_table("usage_events")
    op.drop_table("api_keys")
    op.drop_table("users")
    op.drop_table("tenants")
