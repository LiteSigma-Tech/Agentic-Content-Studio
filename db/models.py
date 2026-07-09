"""SQLAlchemy ORM models — single source of truth for the database schema.

These models are used by Alembic to autogenerate and apply migrations.
The runtime stores use raw asyncpg queries for performance; the models
here define *what* the schema looks like, not how it is queried.

To generate a new migration after changing a model:
    alembic revision --autogenerate -m "describe your change"

To apply pending migrations:
    alembic upgrade head
"""
from __future__ import annotations

from sqlalchemy import (
    BigInteger, Double, Float, ForeignKey, Index, Integer, String, Text,
)
from sqlalchemy.dialects.postgresql import DOUBLE_PRECISION, TIMESTAMP
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


# ── platform_core ─────────────────────────────────────────────────────────────

class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str]           = mapped_column(String, primary_key=True)
    name: Mapped[str]         = mapped_column(String, nullable=False)
    plan: Mapped[str]         = mapped_column(String, nullable=False, default="free")
    cost_cap_usd: Mapped[float] = mapped_column(Double, nullable=False, default=5.0)
    job_cap: Mapped[int]      = mapped_column(Integer, nullable=False, default=100)
    created_at                = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str]            = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str]     = mapped_column(String, ForeignKey("tenants.id"), nullable=False)
    email: Mapped[str]         = mapped_column(String, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str]          = mapped_column(String, nullable=False, default="creator")
    created_at                 = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str]          = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str]   = mapped_column(String, ForeignKey("tenants.id"), nullable=False)
    secret_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str]        = mapped_column(String, nullable=False, default="creator")
    last_used: Mapped[float] = mapped_column(Double, nullable=False, default=0.0)
    created_at               = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class UsageEvent(Base):
    __tablename__ = "usage_events"
    __table_args__ = (Index("usage_events_tenant_idx", "tenant_id"),)

    id: Mapped[int]            = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str]     = mapped_column(String, nullable=False)
    kind: Mapped[str]          = mapped_column(String, nullable=False)
    qty: Mapped[float]         = mapped_column(Double, nullable=False, default=1.0)
    cost_usd: Mapped[float]    = mapped_column(Double, nullable=False, default=0.0)
    ts: Mapped[float]          = mapped_column(Double, nullable=False)
    created_at                 = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = (Index("refresh_tokens_user_idx", "user_id"),)

    token: Mapped[str]      = mapped_column(String, primary_key=True)
    user_id: Mapped[str]    = mapped_column(String, nullable=False)
    tenant_id: Mapped[str]  = mapped_column(String, nullable=False)
    role: Mapped[str]       = mapped_column(String, nullable=False)
    expires_at: Mapped[float] = mapped_column(Double, nullable=False)
    created_at              = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


# ── model_gateway ─────────────────────────────────────────────────────────────

class RoutingConfig(Base):
    __tablename__ = "routing_config"

    id: Mapped[int]          = mapped_column(Integer, primary_key=True, default=1)
    config_json: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at               = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


# ── agent_runtime ─────────────────────────────────────────────────────────────

class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str]        = mapped_column(String, primary_key=True)
    run_json: Mapped[str]  = mapped_column(Text, nullable=False)
    tenant_id: Mapped[str | None] = mapped_column(String)
    updated_at             = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    created_at             = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class AgentMemory(Base):
    __tablename__ = "agent_memory"
    __table_args__ = (Index("agent_memory_ns_idx", "namespace"),)

    id: Mapped[int]           = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    namespace: Mapped[str]    = mapped_column(String, nullable=False)
    text: Mapped[str]         = mapped_column(Text, nullable=False)
    meta_json: Mapped[str]    = mapped_column(Text, nullable=False, default="{}")
    created_at                = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


# ── video_studio / audio_studio ───────────────────────────────────────────────

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str]              = mapped_column(String, primary_key=True)
    project_json: Mapped[str]    = mapped_column(Text, nullable=False)
    tenant_id: Mapped[str | None] = mapped_column(String)
    updated_at                   = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    created_at                   = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


# ── lead_gen ──────────────────────────────────────────────────────────────────

class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (
        Index("leads_dedupe_idx", "dedupe_key"),
        Index("leads_tenant_idx", "tenant_id"),
    )

    id: Mapped[str]               = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str | None] = mapped_column(String)
    lead_json: Mapped[str]        = mapped_column(Text, nullable=False)
    status: Mapped[str]           = mapped_column(String, nullable=False, default="sourced")
    dedupe_key: Mapped[str | None] = mapped_column(String)
    updated_at                    = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    created_at                    = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class SuppressionList(Base):
    __tablename__ = "suppression_list"

    email: Mapped[str]  = mapped_column(String, primary_key=True)
    reason: Mapped[str] = mapped_column(String, nullable=False, default="unsubscribed")
    created_at          = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())


class OutreachRecord(Base):
    __tablename__ = "outreach_records"

    run_id: Mapped[str]           = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str | None] = mapped_column(String)
    record_json: Mapped[str]      = mapped_column(Text, nullable=False)
    updated_at                    = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    created_at                    = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
