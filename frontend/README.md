# Frontend (F0–F5)

`PlatformConsole.jsx` is an interactive prototype of the platform's operator UI —
the surface that ties all five backend slices together. It renders live and is
clickable: run the studio pipeline, approve/reject outreach, and switch models.
It's a **design + UX reference wired to mock state that mirrors the real API
shapes**, not the production app (that's a Next.js project — see below).

## What it shows

- **Dashboard** — the active run as a live signal chain, the lead funnel
  snapshot, the "needs you" approval count, and the free-models cost meter.
- **Studio** — create an episode (concept + genre), run the 11-stage
  video+audio pipeline (animated), and see the shot list + voice casting. Picking
  `kids_cartoon` surfaces the moderation-gated routing note.
- **Leads** — the scored/qualified lead table with per-lead reasons, the
  compliance breakdown (qualified vs blocked, with why), and the **approval
  inbox**: every outreach send pauses here (the human-in-the-loop gate from the
  agent runtime). Approve → sent; reject → not sent.
- **Models** — the routing config: a model picker per task, the **free-only**
  toggle (which disables paid providers and drops the cost ceiling to 0), and the
  provider catalogue with capability flags. This is the gateway's §2.3 made
  visual.

## Design

A broadcast/control-room direction: pipelines are **signal chains** that light up
as a run flows through them, an amber **ON AIR** lamp marks active work, and the
three-accent palette is semantic — amber = running, teal = done/safe, clay =
needs you / blocked. Warm-dark console panels and mono data readouts, rather than
a generic dashboard look.

## How it maps to the backend

| Screen | Real endpoints |
|---|---|
| Studio run | `POST /v1/projects`, `POST /v1/projects/{id}/run`, `GET /v1/projects/{id}` (audio_studio API) |
| Leads + funnel | `POST /v1/leads/source\|qualify\|compliance`, `GET /v1/leads` (lead_gen API) |
| Approval inbox | `POST /v1/outreach/propose`, `POST /v1/outreach/{run_id}/approve` (lead_gen → agent_runtime HITL) |
| Models | `GET /v1/providers`, `GET\|PUT /v1/config/routing` (gateway API) |
| ON AIR / cost | derived from run status + per-job cost metering |

## Production wiring (F0–F5)

The real app is Next.js + React + TypeScript with TanStack Query for server
state, a WebSocket/SSE client for live job + run status (replacing the simulated
timers here), and shadcn/ui + Tailwind on these same design tokens. The phase
breakdown is in the implementation plan (F0 foundation → F1 dashboard/shared →
F2 leads → F3 studio → F4 audio → F5 polish).

## Run it

It renders inline as an artifact. To run standalone, drop the component into a
Vite/Next React app with `lucide-react` installed.
