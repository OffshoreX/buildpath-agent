"""BuildPath — Flask API.

POST /api/generate          -> full roadmap JSON from onboarding answers (single agent)
POST /api/generate-stream   -> four-agent reasoning pipeline, streamed over SSE
POST /api/regenerate-phase  -> regenerate a single phase of an existing roadmap
POST /api/chat              -> follow-up chat about an existing roadmap
GET  /api/health            -> liveness probe
"""

import json
import os
import time
from datetime import datetime, timezone

from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS

import agent

app = Flask(__name__)
CORS(app)

# Four specialized agents drive the reasoning pipeline; each falls back to the
# single default agent (AZURE_AGENT_ID) when its own ID isn't configured, so
# the pipeline still runs on a one-agent setup.
PLANNER_AGENT_ID = os.environ.get("AZURE_PLANNER_AGENT_ID", "")
RESEARCHER_AGENT_ID = os.environ.get("AZURE_RESEARCHER_AGENT_ID", "")
RISK_AGENT_ID = os.environ.get("AZURE_RISK_AGENT_ID", "")
CRITIC_AGENT_ID = os.environ.get("AZURE_CRITIC_AGENT_ID", "")

ROADMAP_SCHEMA = """{
  "project_name": "string",
  "preset_type": "string",
  "estimated_duration": "string",
  "summary": "string (2-3 sentence project overview)",
  "phases": [
    {
      "phase_number": 1,
      "title": "string",
      "description": "string",
      "duration": "string",
      "dependencies": ["phase titles this depends on"],
      "checkpoints": ["specific validation steps as strings"],
      "risks": ["specific risks as strings"],
      "tools_required": ["specific named tools, components, libraries"],
      "sources": [{"label": "string", "url": "string"}],
      "tags": ["one or more of: critical-path, high-risk, quick-win, dependency, research, build, test, deploy"],
      "confidence": 0.0-1.0
    }
  ],
  "success_criteria": "string",
  "early_validation": "string (what to test/validate first)",
  "critical_path": ["ordered list of phase titles on the critical path"]
}"""

PHASE_SCHEMA = """{
  "phase_number": 1,
  "title": "string",
  "description": "string",
  "duration": "string",
  "dependencies": ["phase titles this depends on"],
  "checkpoints": ["specific validation steps as strings"],
  "risks": ["specific risks as strings"],
  "tools_required": ["specific named tools, components, libraries"],
  "sources": [{"label": "string", "url": "string"}],
  "tags": ["one or more of: critical-path, high-risk, quick-win, dependency, research, build, test, deploy"],
  "confidence": 0.0-1.0
}"""

QUALITY_INSTRUCTIONS = """IMPORTANT INSTRUCTIONS FOR RESPONSE QUALITY:
- For tools_required: name SPECIFIC products, not categories. For example, say 'Fusion 360' not 'CAD software'. Say 'Arduino Nano' not 'microcontroller'. Say 'JGY-370 worm gear motor' not 'a motor'.
- For checkpoints: make them measurable. Say 'Gyroscope maintains platform within 5 degrees of level for 30 seconds' not 'Test stability'.
- For risks: be specific about failure modes. Say 'Gyroscope RPM may be insufficient to generate corrective torque for platform mass >500g' not 'May not work'.
- For dependencies: explain WHY phase B depends on phase A, not just that it does.
- For duration: give a range for solo builders (e.g. '1-2 weeks') accounting for iteration.
- Include at least one 'quick-win' tagged phase early in the roadmap to build momentum.
- The early_validation field should describe a specific experiment or test, not a vague suggestion.
- The critical_path should be a minimal set of phases that directly impact the success criteria, not just a list of important phases.
- Generate 4-6 phases minimum. Break large phases into smaller, actionable sub-phases. Four phases is too few for a real project plan.
- When you recommend specific tools, components, or methods that you grounded using web knowledge, include a sources array with the reference label and URL. Only include real sources from your knowledge retrieval, never fabricate URLs."""


def _join(value):
    if isinstance(value, (list, tuple)):
        return ", ".join(str(item) for item in value if str(item).strip())
    return str(value or "")


def _custom_constraints_block(project_data):
    lines = []
    if project_data.get("custom_domain"):
        lines.append(f"Domain/Field: {project_data['custom_domain']}")
    if project_data.get("custom_constraints"):
        lines.append(f"Main Constraints: {_join(project_data['custom_constraints'])}")
    if project_data.get("custom_skills"):
        lines.append(f"Skills/Tools Available: {project_data['custom_skills']}")
    if project_data.get("custom_requirements"):
        lines.append(f"Hard Requirements: {project_data['custom_requirements']}")
    return lines


def build_prompt(project_data):
    lines = [
        "Generate a detailed project roadmap for the following project. "
        "Return ONLY valid JSON matching the schema exactly.",
        "",
        f"Project Name: {project_data.get('name', 'Untitled Project')}",
        f"Project Type: {project_data.get('preset_type', 'CUSTOM')}",
        f"Description: {project_data.get('description', '')}",
        f"Timeline: {project_data.get('timeline', '')}",
        f"Experience Level: {project_data.get('experience_level', '')}",
        f"Team: {project_data.get('team_size', '')}",
        f"Available Resources: {_join(project_data.get('resources'))}",
        f"Success Criteria: {project_data.get('success_criteria', '')}",
    ]
    if project_data.get("preset_type") == "CUSTOM":
        lines.extend(_custom_constraints_block(project_data))
    lines.extend(["", QUALITY_INSTRUCTIONS])
    lines.extend(["", "Return this exact JSON schema:", ROADMAP_SCHEMA])
    return "\n".join(lines)


def build_phase_prompt(project_data, roadmap, phase, feedback=""):
    phase_titles = _join([p.get("title", "") for p in (roadmap.get("phases") or [])])
    lines = [
        f"Regenerate ONLY phase {phase.get('phase_number')} "
        f"(\"{phase.get('title', '')}\") of an existing project roadmap. "
        "Produce an improved, more specific version of this single phase. "
        "Return ONLY one valid JSON object matching the schema exactly — "
        "not the whole roadmap.",
        "",
        f"Project Name: {project_data.get('name', roadmap.get('project_name', ''))}",
        f"Project Type: {project_data.get('preset_type', roadmap.get('preset_type', ''))}",
        f"Description: {project_data.get('description', '')}",
        f"Timeline: {project_data.get('timeline', '')}",
        f"Experience Level: {project_data.get('experience_level', '')}",
        f"Team: {project_data.get('team_size', '')}",
        f"Available Resources: {_join(project_data.get('resources'))}",
        f"All Roadmap Phases (for context): {phase_titles}",
        "",
        "Current version of the phase to regenerate:",
        f"  Title: {phase.get('title', '')}",
        f"  Description: {phase.get('description', '')}",
        f"  Duration: {phase.get('duration', '')}",
    ]
    if feedback:
        lines.append(f"User feedback to incorporate: {feedback}")
    lines.extend(
        [
            "",
            f"Keep phase_number = {phase.get('phase_number')}. "
            "Keep it consistent with the other phases.",
            "",
            "Return this exact JSON schema:",
            PHASE_SCHEMA,
        ]
    )
    return "\n".join(lines)


CHAT_SYSTEM_PROMPT = (
    "You are BuildPath, helping a user refine their existing project roadmap. "
    "You can answer questions about the project OR make edits. When the user asks "
    "a question, respond conversationally with edits=null. When the user requests a "
    "change to the roadmap, respond with a brief confirmation in 'reply' AND populate "
    "'edits' with the structured change. For update_phase, return the complete updated "
    "phase object matching the phase schema. Always be specific and reference actual "
    "tools, components, and measurable checkpoints. Keep replies concise."
)

CHAT_RESPONSE_SCHEMA = """{
  "reply": "conversational text response to show in chat",
  "edits": null,
  "_OR_edits_example": {
    "action": "update_phase | add_phase | remove_phase",
    "phase_number": 2,
    "phase_data": { ...full phase object matching the phase schema, for update_phase/add_phase; omit for remove_phase... }
  }
}"""


def _roadmap_context(roadmap):
    """Compact, readable rendering of the current roadmap for chat grounding."""
    lines = [
        f"Project: {roadmap.get('project_name', '')}",
        f"Type: {roadmap.get('preset_type', '')}",
        f"Summary: {roadmap.get('summary', '')}",
        f"Estimated duration: {roadmap.get('estimated_duration', '')}",
        f"Success criteria: {roadmap.get('success_criteria', '')}",
        "",
        "Current phases:",
    ]
    for phase in roadmap.get("phases") or []:
        lines.append(
            f"  Phase {phase.get('phase_number')}: {phase.get('title', '')} "
            f"({phase.get('duration', '')})"
        )
        if phase.get("description"):
            lines.append(f"    {phase['description']}")
        if phase.get("dependencies"):
            lines.append(f"    Depends on: {_join(phase['dependencies'])}")
        if phase.get("tools_required"):
            lines.append(f"    Tools: {_join(phase['tools_required'])}")
        if phase.get("tags"):
            lines.append(f"    Tags: {_join(phase['tags'])}")
    return "\n".join(lines)


def build_chat_prompt(project_data, roadmap, message, chat_history):
    lines = [CHAT_SYSTEM_PROMPT, "", "CURRENT ROADMAP:", _roadmap_context(roadmap), ""]
    if project_data:
        lines.extend(
            [
                "ORIGINAL PROJECT INPUTS:",
                f"  Timeline: {project_data.get('timeline', '')}",
                f"  Experience: {project_data.get('experience_level', '')}",
                f"  Team: {project_data.get('team_size', '')}",
                f"  Resources: {_join(project_data.get('resources'))}",
                "",
            ]
        )
    history = chat_history or []
    if history:
        lines.append("CONVERSATION SO FAR:")
        for turn in history[-10:]:
            role = "User" if turn.get("role") == "user" else "BuildPath"
            lines.append(f"  {role}: {turn.get('content', '')}")
        lines.append("")
    lines.extend(
        [
            f"USER MESSAGE: {message}",
            "",
            QUALITY_INSTRUCTIONS,
            "",
            "When 'edits' applies, phase_data must follow this schema exactly:",
            PHASE_SCHEMA,
            "",
            "Return ONLY valid JSON in this exact shape (set edits to null for answers):",
            CHAT_RESPONSE_SCHEMA,
        ]
    )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Four-agent reasoning pipeline
# ---------------------------------------------------------------------------

REASONING_NOTE = (
    'Also include a "reasoning" array of 3-6 short first-person strings naming '
    "the key reasoning steps you took (e.g. \"Sequenced fabrication before "
    'assembly because the frame defines mounting points\"). These are shown to '
    "the user as a live reasoning trace, so be specific and concrete."
)


def _project_block(project_data):
    lines = [
        f"Project Name: {project_data.get('name', 'Untitled Project')}",
        f"Project Type: {project_data.get('preset_type', 'CUSTOM')}",
        f"Description: {project_data.get('description', '')}",
        f"Timeline: {project_data.get('timeline', '')}",
        f"Experience Level: {project_data.get('experience_level', '')}",
        f"Team: {project_data.get('team_size', '')}",
        f"Available Resources: {_join(project_data.get('resources'))}",
        f"Success Criteria: {project_data.get('success_criteria', '')}",
    ]
    if project_data.get("preset_type") == "CUSTOM":
        lines.extend(_custom_constraints_block(project_data))
    return "\n".join(lines)


def build_planner_prompt(project_data):
    return "\n".join(
        [
            "You are the PLANNER agent in a multi-agent roadmap pipeline. Decompose "
            "the project into a phase SKELETON only — do not add tools, risks, or "
            "checkpoints; later agents handle those.",
            "",
            _project_block(project_data),
            "",
            "Produce 4-6 ordered phases. For each: a tight title, a 1-2 sentence "
            "description, a solo-builder duration range (e.g. '1-2 weeks'), and "
            "dependencies (titles of earlier phases it needs). Explain the WHY of "
            "each dependency in the description. Include one early 'quick-win'-worthy "
            "phase to build momentum.",
            "",
            "First decide how many phases this specific project needs and WHY, then "
            "make that the FIRST item in your reasoning array (e.g. 'Determining "
            "optimal phase count: this project needs 5 phases because fabrication, "
            "control, and tuning are genuinely separate efforts').",
            "",
            REASONING_NOTE,
            "",
            "Return ONLY valid JSON:",
            '{"reasoning": ["..."], "phases": [{"phase_number": 1, "title": "string", '
            '"description": "string", "duration": "string", "dependencies": ["phase titles"]}]}',
        ]
    )


def build_researcher_prompt(project_data, phases):
    return "\n".join(
        [
            "You are the RESEARCHER agent. Enrich each phase of this skeleton with "
            "the tools and components needed. Ground recommendations in current web "
            "knowledge and cite real sources; never fabricate URLs.",
            "",
            "For PHYSICAL parts and components, be SPECIFIC and name actual products "
            "(say 'STM32G431' not 'a microcontroller'), since those need to be "
            "purchased. ALSO include the basic connecting and supporting components "
            "needed to actually assemble the project (e.g. breadboard, jumper wires, "
            "connectors, fasteners, power supply) — not just the headline parts.",
            "",
            "For software tools, CAD programs, and similar where the user likely has "
            "a preference, stay GENERIC (say 'a parametric CAD program', not 'Fusion "
            "360' — naming a specific one could mismatch their setup).",
            "",
            _project_block(project_data),
            "",
            "Phase skeleton (from the planner):",
            json.dumps(phases, ensure_ascii=False),
            "",
            REASONING_NOTE,
            "",
            "Return ONLY valid JSON mapping each phase_number to its findings:",
            '{"reasoning": ["..."], "phases": [{"phase_number": 1, '
            '"tools_required": ["specific named items"], '
            '"sources": [{"label": "string", "url": "string"}]}]}',
        ]
    )


def build_risk_prompt(project_data, phases):
    return "\n".join(
        [
            "You are the RISK ANALYST agent. Pressure-test each phase and add "
            "checkpoints, risks, and tags from this set only: critical-path, "
            "high-risk, quick-win, dependency, research, build, test, deploy.",
            "",
            "Every checkpoint must be specific and measurable — tied to a concrete, "
            "observable outcome ('Holds a 350g arm level at <60% rated current', not "
            "'test it'). Every risk must be a realistic failure mode specific to THIS "
            "project and phase ('GB2208 torque may be marginal for a 620g camera at "
            "full extension', not 'might not work'). Do not include generic or filler "
            "risks: if a phase has only one meaningful risk, include only that one "
            "rather than padding the list.",
            "",
            "Enriched phases:",
            json.dumps(phases, ensure_ascii=False),
            "",
            REASONING_NOTE,
            "",
            "Return ONLY valid JSON:",
            '{"reasoning": ["..."], "phases": [{"phase_number": 1, '
            '"checkpoints": ["measurable"], "risks": ["specific failure modes"], '
            '"tags": ["from the allowed set"]}]}',
        ]
    )


def build_critic_prompt(project_data, roadmap):
    return "\n".join(
        [
            "You are the CRITIC agent. Review the assembled roadmap holistically for "
            "coherence. Determine the minimal critical_path (phase titles that "
            "directly gate success, not just important ones), write a 2-3 sentence "
            "summary, a concrete success_criteria, an estimated_duration for the whole "
            "project, and assign an honest confidence (0.0-1.0) to each phase.",
            "",
            "The early_validation field is important: it must name ONE specific, "
            "concrete experiment the builder can run first to de-risk the riskiest "
            "assumption in this exact project (e.g. 'Drive one GB2208 motor open-loop "
            "and confirm it holds a 350g arm level against a finger push before "
            "committing to the frame'). Never a vague or generic suggestion — it "
            "should reference real specifics from the roadmap.",
            "",
            _project_block(project_data),
            "",
            "Assembled roadmap:",
            json.dumps(roadmap, ensure_ascii=False),
            "",
            REASONING_NOTE,
            "",
            "Return ONLY valid JSON:",
            '{"reasoning": ["..."], "summary": "string", "success_criteria": "string", '
            '"early_validation": "string", "estimated_duration": "string", '
            '"critical_path": ["phase titles"], '
            '"phases": [{"phase_number": 1, "confidence": 0.0}]}',
        ]
    )


PIPELINE_STAGES = [
    ("planner", "Decomposing the project into phases"),
    ("researcher", "Researching specific tools and sources"),
    ("risk", "Pressure-testing checkpoints and risks"),
    ("critic", "Reviewing coherence and the critical path"),
]


def _phase_base(p, number):
    return {
        "phase_number": number,
        "title": str(p.get("title") or f"Phase {number}"),
        "description": str(p.get("description") or ""),
        "duration": str(p.get("duration") or ""),
        "dependencies": p.get("dependencies") or [],
        "checkpoints": [],
        "risks": [],
        "tools_required": [],
        "sources": [],
        "tags": [],
        "confidence": 0.6,
    }


def _by_number(phases):
    out = {}
    for p in phases or []:
        try:
            out[int(p.get("phase_number"))] = p
        except (TypeError, ValueError):
            continue
    return out


def _sse(event, data):
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _reasoning_lines(result, fallback):
    lines = result.get("reasoning") if isinstance(result, dict) else None
    if isinstance(lines, list):
        cleaned = [str(x).strip() for x in lines if str(x).strip()]
        if cleaned:
            return cleaned
    return fallback


def _pipeline_events(project_data):
    """Generator yielding SSE strings as the four agents run in sequence.

    Builds the roadmap incrementally so a late-stage failure still streams the
    best roadmap assembled so far.
    """
    phases = {}  # phase_number -> assembled phase dict
    top = {}  # critic-level fields

    def emit_stage(stage, label, prompt, agent_id, apply_fn, derive_fn):
        """Run one agent, stream its reasoning, merge its output. Returns ok bool."""
        yield _sse("stage_start", {"stage": stage, "label": label})
        result = agent.generate(prompt, agent_id)
        if not isinstance(result, dict) or "error" in result:
            detail = result.get("error") if isinstance(result, dict) else "no response"
            yield _sse("error", {"stage": stage, "message": str(detail), "fatal": False})
            yield _sse("stage_complete", {"stage": stage, "skipped": True})
            return False
        apply_fn(result)
        for line in _reasoning_lines(result, derive_fn()):
            yield _sse("stage_reasoning", {"stage": stage, "text": line})
            time.sleep(0.35)  # cadence so the trace reads as live thinking
        yield _sse("stage_complete", {"stage": stage})
        return True

    try:
        # 1. PLANNER -------------------------------------------------------
        planner_ok = False

        def apply_planner(result):
            nonlocal planner_ok
            for i, p in enumerate(result.get("phases") or [], start=1):
                num = i
                phases[num] = _phase_base(p, num)
            planner_ok = bool(phases)

        yield from emit_stage(
            "planner",
            PIPELINE_STAGES[0][1],
            build_planner_prompt(project_data),
            PLANNER_AGENT_ID,
            apply_planner,
            lambda: (
                [f"Determining optimal phase count: {len(phases)} phases for this project"]
                + [f"Phase {n}: {phases[n]['title']}" for n in sorted(phases)]
            )
            if phases
            else ["Sketching the phase sequence"],
        )

        if not phases:
            yield _sse(
                "error",
                {"stage": "planner", "message": "The planner produced no phases.", "fatal": True},
            )
            return

        # 2. RESEARCHER ----------------------------------------------------
        skeleton = [phases[n] for n in sorted(phases)]

        def apply_researcher(result):
            for num, p in _by_number(result.get("phases")).items():
                if num in phases:
                    if p.get("tools_required"):
                        phases[num]["tools_required"] = p["tools_required"]
                    if p.get("sources"):
                        phases[num]["sources"] = [
                            s for s in p["sources"] if isinstance(s, dict) and s.get("url")
                        ]

        yield from emit_stage(
            "researcher",
            PIPELINE_STAGES[1][1],
            build_researcher_prompt(project_data, skeleton),
            RESEARCHER_AGENT_ID,
            apply_researcher,
            lambda: [
                f"{phases[n]['title']}: {_join(phases[n]['tools_required']) or 'tooling identified'}"
                for n in sorted(phases)
            ],
        )

        # 3. RISK ANALYST --------------------------------------------------
        enriched = [phases[n] for n in sorted(phases)]

        def apply_risk(result):
            for num, p in _by_number(result.get("phases")).items():
                if num in phases:
                    if p.get("checkpoints"):
                        phases[num]["checkpoints"] = p["checkpoints"]
                    if p.get("risks"):
                        phases[num]["risks"] = p["risks"]
                    if p.get("tags"):
                        phases[num]["tags"] = p["tags"]

        yield from emit_stage(
            "risk",
            PIPELINE_STAGES[2][1],
            build_risk_prompt(project_data, enriched),
            RISK_AGENT_ID,
            apply_risk,
            lambda: [
                f"{phases[n]['title']}: {len(phases[n]['risks'])} risk(s), "
                f"{len(phases[n]['checkpoints'])} checkpoint(s)"
                for n in sorted(phases)
            ],
        )

        # 4. CRITIC --------------------------------------------------------
        assembled = {
            "project_name": project_data.get("name", "Untitled Project"),
            "preset_type": project_data.get("preset_type", "CUSTOM"),
            "phases": [phases[n] for n in sorted(phases)],
        }

        def apply_critic(result):
            for key in ("summary", "success_criteria", "early_validation", "estimated_duration"):
                if result.get(key):
                    top[key] = result[key]
            if isinstance(result.get("critical_path"), list):
                top["critical_path"] = [str(t) for t in result["critical_path"] if str(t).strip()]
            for num, p in _by_number(result.get("phases")).items():
                if num in phases:
                    try:
                        phases[num]["confidence"] = max(0.0, min(1.0, float(p.get("confidence"))))
                    except (TypeError, ValueError):
                        pass

        yield from emit_stage(
            "critic",
            PIPELINE_STAGES[3][1],
            build_critic_prompt(project_data, assembled),
            CRITIC_AGENT_ID,
            apply_critic,
            lambda: ["Validated the critical path and phase confidence"],
        )

        # Assemble final roadmap in the canonical schema, with safe defaults
        # so any skipped stage still yields a coherent roadmap.
        ordered = [phases[n] for n in sorted(phases)]
        roadmap = {
            "project_name": project_data.get("name", "Untitled Project"),
            "preset_type": project_data.get("preset_type", "CUSTOM"),
            "estimated_duration": top.get("estimated_duration")
            or project_data.get("timeline", ""),
            "summary": top.get("summary")
            or project_data.get("description", "")
            or "A phase-by-phase roadmap for your project.",
            "phases": ordered,
            "success_criteria": top.get("success_criteria")
            or project_data.get("success_criteria", ""),
            "early_validation": top.get("early_validation", ""),
            "critical_path": top.get("critical_path")
            or [p["title"] for p in ordered],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        yield _sse("done", {"roadmap": roadmap})
    except Exception as exc:  # noqa: BLE001 - never leave the stream hanging
        yield _sse("error", {"message": f"Pipeline failed: {exc}", "fatal": True})


@app.post("/api/generate-stream")
def generate_stream():
    body = request.get_json(silent=True) or {}
    project_data = body.get("project_data")
    if not isinstance(project_data, dict) or not project_data:
        return jsonify({"error": "Request body must include a 'project_data' object."}), 400

    return Response(
        stream_with_context(_pipeline_events(project_data)),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable proxy buffering so events flush live
            "Connection": "keep-alive",
        },
    )


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/api/chat")
def chat():
    body = request.get_json(silent=True) or {}
    roadmap = body.get("roadmap") or {}
    message = (body.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Request body must include a non-empty 'message'."}), 400
    if not isinstance(roadmap, dict) or not roadmap.get("phases"):
        return jsonify({"error": "Request body must include the current 'roadmap'."}), 400

    prompt = build_chat_prompt(
        body.get("project_data") or {}, roadmap, message, body.get("chat_history")
    )
    result = agent.generate(prompt)
    if "error" in result:
        return jsonify(result), 502

    reply = result.get("reply")
    if not isinstance(reply, str) or not reply.strip():
        return jsonify({"error": "The agent did not return a usable reply."}), 502

    # Normalize edits: only pass through a well-formed, supported action so a
    # malformed model response can never corrupt the roadmap. Anything that
    # doesn't validate is dropped (the conversational reply still goes through).
    edits = result.get("edits")
    action = edits.get("action") if isinstance(edits, dict) else None
    normalized = None
    if action in ("update_phase", "add_phase", "remove_phase"):
        try:
            phase_number = int(edits.get("phase_number"))
        except (TypeError, ValueError):
            phase_number = None
        phase_data = edits.get("phase_data")
        data_ok = isinstance(phase_data, dict) and bool(phase_data.get("title"))
        if action == "remove_phase" and phase_number is not None:
            normalized = {"action": action, "phase_number": phase_number}
        elif action == "update_phase" and phase_number is not None and data_ok:
            normalized = {"action": action, "phase_number": phase_number, "phase_data": phase_data}
        elif action == "add_phase" and data_ok:
            normalized = {"action": action, "phase_number": phase_number, "phase_data": phase_data}

    return jsonify({"reply": reply.strip(), "edits": normalized})


@app.post("/api/generate")
def generate_roadmap():
    body = request.get_json(silent=True) or {}
    project_data = body.get("project_data")
    if not isinstance(project_data, dict) or not project_data:
        return jsonify({"error": "Request body must include a 'project_data' object."}), 400

    result = agent.generate(build_prompt(project_data))
    if "error" in result:
        return jsonify(result), 502

    phases = result.get("phases")
    if not isinstance(phases, list) or not phases:
        return jsonify({"error": "The agent's roadmap did not include any phases."}), 502

    result.setdefault("project_name", project_data.get("name", "Untitled Project"))
    result.setdefault("preset_type", project_data.get("preset_type", "CUSTOM"))
    result["generated_at"] = datetime.now(timezone.utc).isoformat()
    return jsonify(result)


@app.post("/api/regenerate-phase")
def regenerate_phase():
    body = request.get_json(silent=True) or {}
    project_data = body.get("project_data") or {}
    roadmap = body.get("roadmap") or {}
    phase = body.get("phase") or {}
    if not phase.get("phase_number"):
        return jsonify({"error": "Request body must include a 'phase' with a phase_number."}), 400

    prompt = build_phase_prompt(project_data, roadmap, phase, body.get("feedback", ""))
    result = agent.generate(prompt)
    if "error" in result:
        return jsonify(result), 502

    # Tolerate an agent that wraps the phase in a full-roadmap envelope.
    if isinstance(result.get("phases"), list) and result["phases"]:
        result = result["phases"][0]
    if not isinstance(result, dict) or not result.get("title"):
        return jsonify({"error": "The agent did not return a valid phase object."}), 502

    result["phase_number"] = phase["phase_number"]
    return jsonify(result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="127.0.0.1", port=port, debug=True)
