# BuildPath

**Turn a project idea into an agent-generated, phase-by-phase roadmap.**

BuildPath walks you through a chat-style onboarding flow, sends your answers to a
**Microsoft Foundry** agent grounded with **Foundry IQ**, and renders the result as an
animated vertical timeline: lit-up completed phases, a pulsing current phase with a
traveling light particle, expandable checkpoints/risks/tools, per-phase notes, and
one-click phase regeneration.

Built for a hackathon — fully functional, visually distinctive, and demoable end to end.

## Architecture

```
┌──────────────────────────┐         ┌────────────────────────┐         ┌──────────────────────────────┐
│        FRONTEND          │         │        BACKEND         │         │      MICROSOFT FOUNDRY       │
│   React 18 + Vite        │  fetch  │     Flask + CORS       │  Azure  │                              │
│                          │ ──────► │                        │ ──────► │  buildpath-agent             │
│  OnboardingChat          │  /api/* │  app.py                │   SDK   │   ├─ gpt-4o-mini deployment  │
│   └─ guided Q&A          │         │   ├─ POST /generate    │         │   └─ Foundry IQ grounding    │
│  SkeletonLoader          │ ◄────── │   ├─ POST /regenerate- │ ◄────── │      (web knowledge for      │
│   └─ shimmer + status    │  JSON   │   │        phase       │  JSON   │       tools, components,     │
│  RoadmapView             │         │   └─ GET  /health      │         │       frameworks)            │
│   ├─ TimelinePath (glow) │         │  agent.py              │         │                              │
│   ├─ PhaseCard × N       │         │   └─ AIProjectClient   │         │  Auth:                       │
│   └─ ProjectHeader       │         │      thread → run →    │         │   DefaultAzureCredential     │
└──────────────────────────┘         │      poll → parse JSON │         │   (az login)                 │
     localhost:5173                  └────────────────────────┘         └──────────────────────────────┘
     (Vite proxies /api → :5000)          localhost:5000
```

## How Foundry IQ is used

The roadmap agent runs in a Microsoft Foundry project with **Foundry IQ grounding**
enabled. When it plans a phase, it doesn't guess at tooling from stale training data —
it grounds its recommendations in current web knowledge:

- **`tools_required`** — concrete, currently-maintained libraries, components, and parts
  (e.g. a specific motor driver IC, a specific React state library) instead of generic
  categories.
- **`risks`** — informed by real-world failure modes and known issues with the
  recommended stack.
- **`confidence`** — the agent scores each phase, and grounded phases carry honest
  confidence values you can see on every card.

The backend simply sends a structured prompt (built from your onboarding answers) to the
agent and demands strict JSON back; all the knowledge work happens agent-side in Foundry.

## Setup

Prereqs: Python 3.10+, Node 18+, the Azure CLI, and access to the Foundry project.

```bash
# 1. Clone
git clone <repo-url> && cd buildpath-agent

# 2. Backend deps
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt

# 3. Frontend deps
npm install --prefix frontend

# 4. Authenticate to Azure (DefaultAzureCredential picks this up)
az login

# 5. Run both (two terminals)
python backend/app.py          # Flask on http://localhost:5000
npm run dev --prefix frontend  # Vite on http://localhost:5173
```

Open <http://localhost:5173>, answer the onboarding questions, hit
**Generate Roadmap →**.

> **macOS note:** if port 5000 is busy, turn off *AirPlay Receiver* in System Settings
> (it squats on 5000), or run `PORT=5001 python backend/app.py` and point the Vite proxy
> at it in `frontend/vite.config.js`.

## Environment variables

Read from `backend/.env` (already present; never hardcoded):

| Variable                 | Example                                            | Purpose                               |
| ------------------------ | -------------------------------------------------- | ------------------------------------- |
| `AZURE_PROJECT_ENDPOINT` | `https://buildpath-resource.services.ai.azure.com` | Foundry resource/project endpoint     |
| `AZURE_PROJECT_NAME`     | `buildpath`                                        | Foundry project name                  |
| `AZURE_AGENT_ID`         | `buildpath-agent`                                  | The roadmap agent to run              |
| `AZURE_MODEL_DEPLOYMENT` | `gpt-4o-mini`                                      | Model deployment (used as a fallback) |
| `PORT` *(optional)*      | `5000`                                             | Flask port                            |

Auth uses `DefaultAzureCredential` — `az login` locally, managed identity in the cloud.
No keys in code, ever.

## Screenshots

> _Placeholders — drop demo captures here._

| Onboarding chat | Skeleton loader | Roadmap timeline |
| --------------- | --------------- | ---------------- |
| _coming soon_   | _coming soon_   | _coming soon_    |

## Tech stack

- **Frontend:** React 18, Vite, Framer Motion, pure CSS with custom properties
  (no UI libraries), Space Grotesk + Inter via Google Fonts
- **Backend:** Flask, flask-cors, python-dotenv
- **AI:** Microsoft Foundry (`azure-ai-projects` + `azure-identity`), Foundry IQ
  grounding, `gpt-4o-mini` deployment
- **Auth:** Azure `DefaultAzureCredential` (az login / managed identity)
