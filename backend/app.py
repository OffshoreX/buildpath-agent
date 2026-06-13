"""BuildPath — Flask API.

POST /api/generate          -> full roadmap JSON from onboarding answers
POST /api/regenerate-phase  -> regenerate a single phase of an existing roadmap
GET  /api/health            -> liveness probe
"""

import os
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS

import agent

app = Flask(__name__)
CORS(app)

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
- Generate 4-6 phases minimum. Break large phases into smaller, actionable sub-phases. Four phases is too few for a real project plan."""


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


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


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
