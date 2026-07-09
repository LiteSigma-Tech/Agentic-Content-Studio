"""FastAPI surface for Lead Generation.

  POST /v1/icp                       -> set the Ideal Customer Profile
  POST /v1/leads/source {n}          -> source + enrich + dedupe
  POST /v1/leads/qualify             -> score + qualify against the ICP
  POST /v1/leads/compliance          -> apply compliance gate (contactable vs blocked)
  GET  /v1/leads                     -> list leads with score/status/reasons (paginated)
  POST /v1/outreach/propose {lead_id}-> draft + create an approval-gated send (B2)
  POST /v1/outreach/{run_id}/approve -> approve/reject the send (human-in-the-loop)
  POST /v1/unsubscribe {email}       -> add to suppression
  POST /v1/leads/export              -> write CRM CSV + JSON
  GET  /healthz
"""
from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .models import ICP
from .service import LeadGenService

app = FastAPI(title="Lead Generation", version="0.1.0")
service = LeadGenService(runs_root=os.getenv("LEADGEN_RUNS_ROOT", "/tmp/leadgen_runs"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:5174",
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    from shared.metrics import add_metrics_endpoint
    add_metrics_endpoint(app, "leads")
except Exception:
    pass


@app.on_event("startup")
async def _startup():
    try:
        from shared.logging_config import configure_logging
        configure_logging()
    except Exception:
        pass
    # Hydrate state from DB
    try:
        await service.aload_leads()
        await service.aload_suppression()
    except Exception:
        pass


class SourceReq(BaseModel):
    n: int = 20


class ProposeReq(BaseModel):
    lead_id: str


class ApproveReq(BaseModel):
    approved: bool
    note: str = ""


class UnsubReq(BaseModel):
    email: str


class ExportReq(BaseModel):
    out_dir: str = "/tmp/leadgen_export"
    qualified_only: bool = True


@app.post("/v1/icp")
def set_icp(icp: ICP):
    service.set_icp(icp)
    return {"status": "ok", "icp": icp.model_dump()}


@app.post("/v1/leads/source")
async def source(req: SourceReq):
    result = service.source(req.n)
    # Persist to DB
    try:
        await service.asave_all_leads()
    except Exception:
        pass
    return {"unique_leads": result}


@app.post("/v1/leads/qualify")
async def qualify_leads():
    result = service.score_and_qualify()
    # Persist to DB
    try:
        await service.asave_all_leads()
    except Exception:
        pass
    return result


@app.post("/v1/leads/compliance")
async def compliance():
    result = service.apply_compliance()
    # Persist to DB
    try:
        await service.asave_all_leads()
    except Exception:
        pass
    return result


@app.get("/v1/leads")
async def list_leads(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None),
):
    all_leads = list(service.leads.values())
    if status:
        all_leads = [l for l in all_leads
                     if (l.status.value if hasattr(l.status, 'value') else str(l.status)) == status]
    total = len(all_leads)
    page = all_leads[offset:offset + limit]
    return {"items": [l.model_dump() for l in page], "total": total, "limit": limit, "offset": offset}


@app.post("/v1/outreach/propose")
def propose(req: ProposeReq):
    try:
        return service.propose_outreach(req.lead_id)
    except (KeyError, ValueError) as e:
        raise HTTPException(409, str(e))


@app.post("/v1/outreach/{run_id}/approve")
def approve(run_id: str, req: ApproveReq):
    if run_id not in service.outreach:
        raise HTTPException(404, "outreach run not found")
    return service.approve_outreach(run_id, req.approved, req.note)


@app.post("/v1/unsubscribe")
async def unsubscribe(req: UnsubReq):
    await service.asave_suppression(req.email)
    return {"unsubscribed": req.email}


@app.post("/v1/leads/export")
def export(req: ExportReq):
    return service.export(req.out_dir, req.qualified_only)


@app.get("/healthz")
def healthz():
    return {"status": "ok", "leads": len(service.leads)}
