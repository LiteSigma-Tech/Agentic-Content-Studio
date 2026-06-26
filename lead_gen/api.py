"""FastAPI surface for Lead Generation.

  POST /v1/icp                       -> set the Ideal Customer Profile
  POST /v1/leads/source {n}          -> source + enrich + dedupe
  POST /v1/leads/qualify             -> score + qualify against the ICP
  POST /v1/leads/compliance          -> apply compliance gate (contactable vs blocked)
  GET  /v1/leads                     -> list leads with score/status/reasons
  POST /v1/outreach/propose {lead_id}-> draft + create an approval-gated send (B2)
  POST /v1/outreach/{run_id}/approve -> approve/reject the send (human-in-the-loop)
  POST /v1/unsubscribe {email}       -> add to suppression
  POST /v1/leads/export              -> write CRM CSV + JSON
  GET  /healthz
"""
from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .models import ICP
from .service import LeadGenService

app = FastAPI(title="Lead Generation", version="0.1.0")
service = LeadGenService(runs_root=os.getenv("LEADGEN_RUNS_ROOT", "/tmp/leadgen_runs"))


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
def source(req: SourceReq):
    return {"unique_leads": service.source(req.n)}


@app.post("/v1/leads/qualify")
def qualify_leads():
    return service.score_and_qualify()


@app.post("/v1/leads/compliance")
def compliance():
    return service.apply_compliance()


@app.get("/v1/leads")
def list_leads():
    return {"leads": [l.model_dump(mode="json") for l in service.leads.values()]}


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
def unsubscribe(req: UnsubReq):
    service.unsubscribe(req.email)
    return {"status": "ok", "suppressed": req.email}


@app.post("/v1/leads/export")
def export(req: ExportReq):
    return service.export(req.out_dir, req.qualified_only)


@app.get("/healthz")
def healthz():
    return {"status": "ok", "leads": len(service.leads)}
