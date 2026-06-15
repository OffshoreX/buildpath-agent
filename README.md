# BuildPath

**Turn a plain-language project idea into a structured, visual roadmap — built by five reasoning agents you can watch think.**

![Track](https://img.shields.io/badge/Microsoft_Agents_League-Reasoning_Agents-d4a24c)
![Foundry IQ](https://img.shields.io/badge/Grounded_by-Foundry_IQ-c65d3a)
![Backend](https://img.shields.io/badge/Backend-Flask_·_SSE-3b3b3b)
![Frontend](https://img.shields.io/badge/Frontend-React_18_·_Vite_5-3b3b3b)
![Model](https://img.shields.io/badge/Model-gpt--4o--mini-3b3b3b)

---

## The Problem

Most planning tools hand you a blank board. The hard part of starting a hardware build, a research project, or a software product isn't typing tasks into columns — it's the reasoning *before* the tasks exist:

- What are the real phases, and in what order do the dependencies actually run?
- Which *specific* parts, components, and tools do I need — not "a microcontroller," but the actual one to buy?
- What's most likely to fail, and what's the measurable check that tells me a phase is done?
- What should I validate *first*, before sinking time and money into the wrong assumption?

A single LLM call flattens all of that into one generic list. The thinking is invisible, the tool names are vague, the risks are filler, and there's no way to interrogate or refine the result.

## The Solution

BuildPath runs your description through a **five-agent reasoning pipeline**, where each agent has one job and consumes the previous agent's output. You don't get a wall of text — you watch the agents reason in sequence over a **live streaming trace**, then land on a visual, editable roadmap on an S-curve timeline.

- **Planner** decomposes the project into an ordered phase skeleton with explained dependencies.
- **Researcher** enriches each phase with *specific* named tools and components, **grounded in live web knowledge via Foundry IQ**, and attaches real source citations.
- **Risk Analyst** pressure-tests every phase with measurable checkpoints and concrete, project-specific failure modes.
- **Critic** reviews the whole roadmap for coherence — the critical path, the first experiment to validate, per-phase confidence.
- **Follow-up agent** stays available afterward to answer questions about the plan *and* make structured edits to it in natural language.

The final output conforms to one strict roadmap schema, so the visual timeline, the interactive widgets, and the Markdown/PDF export all render the same trustworthy structure.

---

## Architecture

```
                          ┌──────────────────────────────────────────────┐
                          │                  FRONTEND                     │
                          │            React 18 + Vite 5                   │
                          │                                               │
                          │  FogIntro → HomePage → OnboardingChat          │
                          │  ReasoningTrace (live SSE)                     │
                          │  RoadmapView · PhaseCard · TimelinePath        │
                          │  FollowUpChat · exports · saved roadmaps       │
                          └───────────────┬───────────────────────────────┘
                                          │  fetch + SSE stream  (Vite proxies /api → :5001)
                                          ▼
                          ┌──────────────────────────────────────────────┐
                          │              BACKEND (Flask)                  │
                          │  backend/app.py                               │
                          │   POST /api/generate-stream   (SSE pipeline)  │
                          │   POST /api/chat              (follow-up)     │
                          │   POST /api/regenerate-phase  (targeted)      │
                          │   POST /api/generate          (non-stream)    │
                          │   GET  /api/health                            │
                          │  backend/agent.py  → generate(prompt, id)     │
                          └───────────────┬───────────────────────────────┘
                                          │  AIProjectClient + DefaultAzureCredential
                                          ▼
        ┌─────────────────────────── MICROSOFT FOUNDRY ───────────────────────────┐
        │                                                                          │
        │   ┌──────────┐   ┌────────────┐   ┌──────────┐   ┌──────────┐            │
        │   │ PLANNER  │──▶│ RESEARCHER │──▶│   RISK   │──▶│  CRITIC  │──▶ roadmap  │
        │   └──────────┘   └─────┬──────┘   └──────────┘   └──────────┘            │
        │   phases             tools +         checkpoints     critical path        │
        │   + deps         ┌────┴─────┐        + risks         + early validation   │
        │                  │FOUNDRY IQ│        + tags          + confidence         │
        │                  │  web KB  │                                            │
        │                  └──────────┘   ┌──────────────┐                          │
        │   citations ◀────────┘          │ buildpath-   │  ← conversational        │
        │                                 │   agent      │     follow-up + edits    │
        │                                 └──────────────┘                          │
        │   models: gpt-4o-mini deployment · region East US · Azure for Students    │
        └──────────────────────────────────────────────────────────────────────────┘
```

Two agents are Foundry IQ-grounded: the **Researcher** against a web knowledge base (`buildpath-knowledge`) for live parts/tools with citations, and the **Risk Analyst** against a file-based systems-engineering risk knowledge base (`buildpath-risk-knowledge`). A standalone Mermaid version lives in [`architecture.md`](architecture.md).

---

## How the Agent Reasons

The pipeline is orchestrated in `backend/app.py` (`_pipeline_events`), streamed over Server-Sent Events. Each stage parses the prior stage's JSON, passes it forward, and emits its own reasoning steps as `stage_reasoning` events so the user sees the thinking, not just a spinner.

**1 · Planner** — `build_planner_prompt`
Given your project description, type, timeline, experience level, team, and resources, it decides *how many phases the project genuinely needs and why* (this rationale is the first line of its reasoning trace), then returns an ordered skeleton: title, description, solo-builder duration range, and dependencies, with the *why* of each dependency explained. No tools or risks yet — later agents own those.

**2 · Researcher** — `build_researcher_prompt`
Consumes the skeleton and enriches each phase with the parts and tools needed. It is grounded in **Foundry IQ web knowledge**: it names *specific* physical products (e.g. `STM32G431`, not "a microcontroller"), includes the basic connecting/supporting components people forget (breadboard, jumpers, connectors, fasteners, power supply), and stays deliberately *generic* for software/CAD where the user likely has a preference. Every grounded recommendation can carry a `sources` array of real `{label, url}` citations — never fabricated.

**3 · Risk Analyst** — `build_risk_prompt`
Takes the enriched phases and adds **measurable checkpoints** ("Holds a 350g arm level at <60% rated current," not "test it"), **specific failure modes** tied to this exact project and phase, and tags drawn from a fixed vocabulary (`critical-path`, `high-risk`, `quick-win`, `dependency`, `research`, `build`, `test`, `deploy`). It is told not to pad — one real risk beats three filler ones.

**4 · Critic** — `build_critic_prompt`
Reviews the assembled roadmap holistically: it determines the minimal **critical path** (the phases that actually gate success), writes the summary and success criteria, sets a concrete **early-validation experiment** to de-risk the riskiest assumption first, estimates total duration, and assigns honest **per-phase confidence** scores.

**5 · Follow-up agent** — `build_chat_prompt` (`POST /api/chat`)
After the roadmap exists, you can ask it anything ("Why does phase 3 depend on phase 2?", "What parts do I need for phase 2?") and it answers conversationally — *or* you can request a change ("make phase 2 shorter," "add a safety-testing phase after assembly," "remove the last phase") and it returns a **structured edit** that BuildPath validates and applies in place, with the affected phase glowing briefly to show what changed.

**Graceful degradation:** if any stage fails, the pipeline streams an error event but keeps the best roadmap assembled so far (e.g. a failed Critic still yields the risk-analyzed version). The non-streaming `POST /api/generate` endpoint remains as a fallback if SSE is unavailable, and each specialized agent falls back to the default agent when its own ID isn't configured.

---

## Judging Rubric → Feature Map

| Rubric criterion | How BuildPath addresses it |
|---|---|
| **Accuracy & Relevance** | Two Foundry IQ knowledge bases ground the pipeline: the Researcher cites real sources from a web KB (`buildpath-knowledge`) for specific named parts, and the Risk Analyst reasons from a file-based systems-engineering risk KB (`buildpath-risk-knowledge`, NASA SE Handbook) for grounded checkpoints and failure modes. Output is schema-constrained so it always renders correctly. |
| **Reasoning & Multi-step** | A true five-agent pipeline — Planner → Researcher → Risk → Critic (+ conversational editor) — where each agent consumes the prior's structured output. The Planner reasons explicitly about phase count; the Critic re-evaluates the whole plan's critical path and confidence. |
| **Reliability & Safety** | Per-stage graceful degradation (best-roadmap-so-far on failure), a non-streaming fallback endpoint, strict server-side validation of chat edits before they touch the roadmap (malformed edits are dropped, never applied), and `DefaultAzureCredential` so no keys live in code. |
| **Creativity & Originality** | The reasoning trace is the centerpiece — you *watch* four agents think in sequence. Phase-specific interactive widgets, an S-curve "lit blueprint" timeline, a mouse-reveal fog intro, and self-drawing blueprint line art make a planning tool feel like an instrument. |
| **UX & Presentation** | Live streaming trace, progress-reactive timeline lighting, collapse/expand, inline editing, one-click uncomplete, targeted regeneration with feedback, Markdown/PDF export, saved roadmaps, surfaced citations — all in a cohesive warm "Workshop Blueprint" design system with reduced-motion support throughout. |

---

## Microsoft Foundry IQ Integration

The **Researcher** agent (`buildpath-researcher`) is configured in Microsoft Foundry with **Foundry IQ web knowledge** enabled. Its job is the part of planning that goes stale fastest: which actual, currently-available products and libraries to use.

- The backend sends the Researcher a structured prompt built from your project plus the Planner's phase skeleton, and asks it to **ground recommendations in current web knowledge and cite real sources — never fabricating URLs.**
- Each phase can return a `sources: [{ label, url }]` array alongside `tools_required`. The roadmap schema (`ROADMAP_SCHEMA` / `PHASE_SCHEMA` in `backend/app.py`) carries `sources` as a first-class field.
- The frontend surfaces those citations on each `PhaseCard` as amber, external-link source chips — so the grounding is **visible and verifiable**, not a black box. (The sample roadmap ships with real reference links so the feature is demonstrable offline.)

This separation — one agent dedicated to grounded retrieval, with citations flowing through the schema to the UI — is what lets BuildPath claim *specific* parts with provenance instead of plausible-sounding guesses.

### Two knowledge bases

BuildPath grounds two of its five agents in **distinct Foundry IQ knowledge bases**:

- **Web-based — `buildpath-knowledge`** grounds the **Researcher** in live web knowledge for current parts, components, and tools, surfaced as the source citations described above.
- **File-based — `buildpath-risk-knowledge`** grounds the **Risk Analyst** (`buildpath-risk`) in systems-engineering risk-management reference material (risk chapters of the NASA Systems Engineering Handbook). This anchors its checkpoints and failure-mode reasoning in established methodology rather than ad-hoc guesses — the same agent that's already prompted for measurable, project-specific risks now reasons from a real risk-management corpus.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Framer Motion, hand-authored CSS design tokens |
| Type system | Playfair Display (display), Inter (body), Chakra Petch (blueprint labels) |
| Backend | Python, Flask, flask-cors, Server-Sent Events via `Response(stream_with_context(...))` |
| Agent SDK | `azure-ai-projects` (2.x, version-adaptive), `azure-identity`, `openai`, `python-dotenv` |
| AI | Microsoft Foundry — five agents, Foundry IQ web-knowledge grounding, `gpt-4o-mini` deployment |
| Auth | Azure `DefaultAzureCredential` (`az login` locally / managed identity in cloud) — no keys in code |
| Persistence | Browser `localStorage` (saved roadmaps, per-phase notes and widget data) |

---

## Setup

> All credentials below are **placeholders**. No secrets are committed — `backend/.env` is git-ignored.

### Prerequisites

- Python 3.10+ and Node 18+
- The Azure CLI (`az`)
- Access to a Microsoft Foundry project with the five agents deployed (`buildpath-planner`, `buildpath-researcher`, `buildpath-risk`, `buildpath-critic`, `buildpath-agent`) and a `gpt-4o-mini` model deployment

### 1. Clone

```bash
git clone <repo-url> && cd buildpath-agent
```

### 2. Configure `backend/.env`

```bash
cp backend/.env.example backend/.env
```

Then fill in your own values:

```env
AZURE_PROJECT_ENDPOINT=https://<your-resource>.services.ai.azure.com
AZURE_PROJECT_NAME=<your-project-name>
AZURE_MODEL_DEPLOYMENT=gpt-4o-mini

# Default / conversational agent (also the per-stage fallback)
AZURE_AGENT_ID=buildpath-agent

# Five-agent reasoning pipeline (leave any blank to fall back to AZURE_AGENT_ID)
AZURE_PLANNER_AGENT_ID=buildpath-planner
AZURE_RESEARCHER_AGENT_ID=buildpath-researcher
AZURE_RISK_AGENT_ID=buildpath-risk
AZURE_CRITIC_AGENT_ID=buildpath-critic
```

The project runs against a Foundry resource in **East US** under an **Azure for Students** subscription, but any Foundry project with the equivalent agents works.

### 3. Authenticate to Azure

```bash
az login   # select your Azure for Students subscription
```

`DefaultAzureCredential` picks up this session automatically — no API keys are stored anywhere.

### 4. Install dependencies

```bash
npm run install:all
# (equivalently: pip install -r backend/requirements.txt && npm install --prefix frontend)
```

### 5. Run (two terminals)

```bash
# Terminal 1 — backend (Flask on http://localhost:5001)
python backend/app.py

# Terminal 2 — frontend (Vite on http://localhost:5173)
npm run dev --prefix frontend
```

Open **http://localhost:5173**. Vite proxies `/api/*` to the Flask backend on `:5001`, so the frontend and API share an origin in the browser.

> macOS note: if port 5000 is taken by AirPlay Receiver, it's irrelevant here — the backend defaults to `:5001`. Override with `PORT=<n> python backend/app.py` if needed.

---

## Project Structure

```
buildpath-agent/
├── backend/
│   ├── app.py          # Flask API: SSE pipeline, chat, regenerate, schemas, prompts
│   ├── agent.py        # Foundry connector: generate(prompt, agent_id), version-adaptive
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   └── src/
│       ├── App.jsx                 # stage machine + SSE client + fog intro gate
│       └── components/
│           ├── FogIntro.jsx        # mouse-reveal mist intro
│           ├── HomePage.jsx        # landing + saved roadmaps + self-drawing blueprint
│           ├── OnboardingChat.jsx  # conversational intake
│           ├── ReasoningTrace.jsx  # live five-agent reasoning trace
│           ├── RoadmapView.jsx     # S-curve timeline + export + edit application
│           ├── PhaseCard.jsx       # phase widgets, sources, regenerate, complete
│           ├── TimelinePath.jsx    # serpentine SVG timeline
│           ├── FollowUpChat.jsx    # ask + natural-language edits
│           ├── BlueprintTools.jsx  # decorative engineering line art
│           └── ...
├── README.md
└── architecture.md     # Mermaid diagram of the five-agent flow
```

---

## What's Next

- **Per-agent knowledge bases** — two of the five agents already have dedicated Foundry IQ grounding (the Researcher on a web KB, the Risk Analyst on a file-based risk KB). Because the pipeline routes each stage to its own Foundry agent by ID, the remaining agents — Planner, Critic, and the conversational follow-up — are clean extension points for their own knowledge bases (e.g. a methodology KB for the Planner, an estimation/benchmark KB for the Critic).
- **Reflection on completion** — a sixth agent that reviews a *finished* project (completed phases + the user's notes and widget data) and produces a retrospective: what went as planned, what to do differently next time.
- **Live deployment** — the app currently runs locally against a Foundry project; a hosted deployment with managed identity is the next step (no code change needed for auth — `DefaultAzureCredential` already supports it).
- **True token streaming** — today the live trace streams each agent's own returned reasoning steps (the polled Foundry SDK doesn't expose intermediate tokens); first-class token streaming would make the trace even more granular.

---

*BuildPath — from a rough idea to a build-ready path, reasoned out loud.*
