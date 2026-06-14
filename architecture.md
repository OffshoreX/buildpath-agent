# BuildPath — Architecture

The five-agent reasoning pipeline and Foundry IQ grounding. Each agent consumes
the previous agent's structured output; the assembled roadmap is streamed to the
frontend over Server-Sent Events as each stage reasons.

```mermaid
flowchart TB
    subgraph FE["Frontend · React 18 + Vite 5"]
        A["FogIntro → HomePage → OnboardingChat"]
        T["ReasoningTrace<br/>(live SSE)"]
        R["RoadmapView · PhaseCard · TimelinePath<br/>FollowUpChat · export · saved roadmaps"]
    end

    subgraph BE["Backend · Flask (backend/app.py)"]
        S["POST /api/generate-stream — SSE pipeline"]
        C["POST /api/chat — follow-up + edits"]
        G["POST /api/regenerate-phase"]
        H["POST /api/generate (non-stream fallback) · GET /api/health"]
        AG["backend/agent.py — generate(prompt, agent_id)<br/>AIProjectClient + DefaultAzureCredential"]
    end

    subgraph FO["Microsoft Foundry · gpt-4o-mini · East US"]
        P["PLANNER<br/>phases + dependencies"]
        RS["RESEARCHER<br/>specific tools + citations"]
        IQ[("Foundry IQ<br/>web knowledge")]
        RK["RISK ANALYST<br/>measurable checkpoints + risks"]
        CR["CRITIC<br/>critical path · early validation · confidence"]
        CH["buildpath-agent<br/>conversational follow-up"]
    end

    A -->|project description| S
    S --> AG
    C --> AG
    G --> AG
    AG --> P
    P -->|phase skeleton| RS
    IQ -. grounds .-> RS
    RS -->|enriched + sources| RK
    RK -->|checkpoints + tags| CR
    CR -->|final roadmap JSON| S
    S -->|stage_start / stage_reasoning / done| T
    S -->|roadmap| R
    AG --> CH
    CH -->|answer or structured edit| C
    C --> R
```

## Stage contract

| Agent | Foundry ID | Input | Output |
|---|---|---|---|
| Planner | `buildpath-planner` | project data | ordered phase skeleton (title, description, duration, dependencies) + reasoning |
| Researcher | `buildpath-researcher` (Foundry IQ) | skeleton | `tools_required` + `sources[{label,url}]` per phase + reasoning |
| Risk Analyst | `buildpath-risk` | enriched phases | `checkpoints`, `risks`, `tags` per phase + reasoning |
| Critic | `buildpath-critic` | assembled roadmap | `summary`, `success_criteria`, `early_validation`, `critical_path`, `estimated_duration`, per-phase `confidence` + reasoning |
| Follow-up | `buildpath-agent` | roadmap + message + history | conversational reply, optionally a validated structured phase edit |

Any agent ID left unset falls back to `AZURE_AGENT_ID`, so the pipeline still runs
on a single-agent configuration. A failed stage degrades gracefully — the best
roadmap assembled so far is still returned.
