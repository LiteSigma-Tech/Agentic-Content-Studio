# Lead Generation (B3)

Autonomous lead generation built **on the Agent Runtime (B2)** — the funnel
runs source → enrich → dedupe → score/qualify → **compliance gate** → outreach →
export, and every outreach send goes through the runtime's human-in-the-loop
approval gate. This is the third product surface, alongside the Video and Audio
studios, all sharing the platform's gateway + agent runtime.

Runs fully offline (deterministic mock data provider + scripted outreach agent);
swap in a licensed data API and a real LLM policy and the same funnel runs live.

## The funnel

```
source  → enrich → dedupe → score/qualify → compliance gate → outreach (HITL) → export
(licensed                   (vs the ICP)     (who may be       (every send is
 provider)                                    contacted)         human-approved)
```

## Compliance is a gate, not an afterthought

`apply_compliance()` decides contactability with conservative defaults:

- suppressed / previously unsubscribed → never contact
- invalid or missing email → not contactable
- EU/EEA/UK regions → require explicit **opt-in** consent
- other regions → opt-in or legitimate-interest, but the sequence body must carry
  a working **opt-out** (the send tool refuses a body without a STOP/unsubscribe line)
- unknown consent basis → not contactable anywhere

**Defense-in-depth:** outreach is filtered to contactable leads upstream, *and*
the send tool re-checks the suppression list at execution time — so a lead who
unsubscribes after a draft is proposed can never be emailed even if a human
clicks approve (covered by a test).

> Lead sourcing and automated outreach are heavily regulated (GDPR/CCPA,
> CAN-SPAM, and local equivalents) and vary by jurisdiction. The rules here are
> sensible defaults to build on — **not legal advice.** Have counsel review your
> data sourcing, consent model, and outreach before going live. And prefer
> licensed data providers over scraping.

## Outreach reuses the Agent Runtime (B2)

Each proposed send is an agent run whose side-effecting `send_email` tool is
`requires_approval=True`, so the run pauses (`awaiting_approval`) until a human
approves. Approve → the compliance-checked send executes; reject → recorded, not
sent. The send tool is compliance-aware (suppression + opt-out checks). A real
`LLMPolicy` could research/personalize before drafting — the approval gate and
compliance checks are unchanged.

## Run it

```bash
pip install -r ../requirements.txt
python tests_lead_gen.py                     # 8 offline tests
uvicorn lead_gen.api:app --reload            # from repo root; docs at /docs
```

```bash
curl -s localhost:8000/v1/icp -H 'content-type: application/json' -d '{
  "industries":["Renewable Energy"],"regions":["US","IE","DE"],
  "titles":["vp","head","cmo","director","growth"],
  "keywords":["solar","wind","energy"],"qualify_threshold":50}'
curl -s localhost:8000/v1/leads/source  -d '{"n":20}' -H 'content-type: application/json'
curl -s localhost:8000/v1/leads/qualify -d '{}' -H 'content-type: application/json'
curl -s localhost:8000/v1/leads/compliance -d '{}' -H 'content-type: application/json'
# propose to a contactable lead -> awaiting_approval, then approve
curl -s localhost:8000/v1/outreach/propose -d '{"lead_id":"<id>"}' -H 'content-type: application/json'
curl -s localhost:8000/v1/outreach/<run_id>/approve -d '{"approved":true}' -H 'content-type: application/json'
```

## Files

```
lead_gen/
  models.py       # ICP, Lead (with source + consent_basis), statuses, outreach record
  providers.py    # LeadProvider interface + deterministic mock (licensed APIs in prod)
  scoring.py      # explainable ICP scoring + qualification (LLM-augmentable)
  compliance.py   # suppression list, consent/region rules, opt-out, email validation
  outreach.py     # compliance-aware approval-gated send tool + agent brain (on B2)
  service.py      # LeadGenService: orchestrates funnel, compliance, outreach, export
  api.py          # FastAPI: icp / source / qualify / compliance / outreach / export
  tests_lead_gen.py
demo_output/      # a sample CRM export (leads.csv + leads.json)
```

## Where this leaves the build

Five slices now compose on shared infrastructure:

- **Model Gateway** — config-driven, swappable, free-first models
- **Video Studio (B4)** + **Audio Studio (B5)** — concept → finished A/V episode
- **Agent Runtime (B2)** — tools, HITL, memory, guardrails, durable runs
- **Lead Generation (B3)** — compliant funnel + approval-gated outreach on B2

Still ahead: the platform pillars (auth/multi-tenancy, durable queue/Temporal,
usage metering, observability) and the **frontend** (dashboard, the two studio
UIs, the lead-gen UI with the approval inbox, and the model-settings screen).
