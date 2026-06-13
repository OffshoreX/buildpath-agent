"""BuildPath — Microsoft Foundry agent connector.

Connects to a Microsoft Foundry project with AIProjectClient + DefaultAzureCredential,
sends a prompt to the BuildPath agent (Foundry IQ grounded), waits for the run to
finish, extracts the assistant's text, and parses it as JSON.

Supports both SDK generations behind one `generate(prompt)` entry point:
  * azure-ai-projects 1.x  — classic agents API (threads / messages / runs, polled)
  * azure-ai-projects 2.x  — OpenAI-compatible surface (conversations + responses
    with an `agent_reference`)
If the agent itself cannot be reached, it falls back to calling the model
deployment directly so the app stays demoable. All failures come back as
`{"error": "..."}` dicts — never exceptions — so the API layer can respond cleanly.
"""

import json
import os
import re
import time

from azure.identity import DefaultAzureCredential
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

AZURE_PROJECT_ENDPOINT = os.environ.get("AZURE_PROJECT_ENDPOINT", "").rstrip("/")
AZURE_PROJECT_NAME = os.environ.get("AZURE_PROJECT_NAME", "")
AZURE_AGENT_ID = os.environ.get("AZURE_AGENT_ID", "")
AZURE_MODEL_DEPLOYMENT = os.environ.get("AZURE_MODEL_DEPLOYMENT", "gpt-4o-mini")

RUN_POLL_INTERVAL_SECONDS = 1.0
RUN_TIMEOUT_SECONDS = 180

_project_client = None


def _project_endpoint():
    if not AZURE_PROJECT_ENDPOINT:
        raise RuntimeError(
            "AZURE_PROJECT_ENDPOINT is not set. Add it to backend/.env or the environment."
        )
    # Foundry project endpoints take the form
    # https://<resource>.services.ai.azure.com/api/projects/<project-name>;
    # accept either a resource-level or a full project endpoint in the env var.
    if "/api/projects/" in AZURE_PROJECT_ENDPOINT or not AZURE_PROJECT_NAME:
        return AZURE_PROJECT_ENDPOINT
    return f"{AZURE_PROJECT_ENDPOINT}/api/projects/{AZURE_PROJECT_NAME}"


def _get_project_client():
    global _project_client
    if _project_client is None:
        from azure.ai.projects import AIProjectClient

        _project_client = AIProjectClient(
            endpoint=_project_endpoint(),
            credential=DefaultAzureCredential(),
        )
    return _project_client


def _get_openai_client(client):
    """Return an OpenAI-compatible client for the Foundry project, across SDK versions."""
    if hasattr(client, "get_openai_client"):
        try:
            return client.get_openai_client()
        except TypeError:
            return client.get_openai_client(api_version="2025-04-01-preview")
    inference = getattr(client, "inference", None)
    if inference is not None and hasattr(inference, "get_azure_openai_client"):
        return inference.get_azure_openai_client(api_version="2024-10-21")
    raise RuntimeError("Installed azure-ai-projects SDK exposes no OpenAI client accessor.")


# ---------------------------------------------------------------------------
# Run strategies
# ---------------------------------------------------------------------------

def _run_agent_legacy(client, prompt):
    """azure-ai-projects 1.x flow: thread -> message -> run -> poll -> messages."""
    agents = client.agents
    thread = agents.threads.create()
    agents.messages.create(thread_id=thread.id, role="user", content=prompt)
    run = agents.runs.create(thread_id=thread.id, agent_id=AZURE_AGENT_ID)

    deadline = time.time() + RUN_TIMEOUT_SECONDS
    while run.status in ("queued", "in_progress", "requires_action"):
        if time.time() > deadline:
            raise TimeoutError(
                f"Agent run did not complete within {RUN_TIMEOUT_SECONDS} seconds."
            )
        time.sleep(RUN_POLL_INTERVAL_SECONDS)
        run = agents.runs.get(thread_id=thread.id, run_id=run.id)

    if run.status != "completed":
        last_error = getattr(run, "last_error", None)
        detail = getattr(last_error, "message", None) or str(last_error or "unknown error")
        raise RuntimeError(f"Agent run ended with status '{run.status}': {detail}")

    # Messages list newest-first; grab the most recent assistant reply.
    for message in agents.messages.list(thread_id=thread.id):
        role = str(getattr(message, "role", "")).lower()
        if "assistant" in role or "agent" in role:
            text = _legacy_message_text(message)
            if text:
                return text
    raise RuntimeError("Agent run completed but produced no assistant message.")


def _legacy_message_text(message):
    texts = getattr(message, "text_messages", None)
    if texts:
        return "\n".join(
            t.text.value for t in texts if getattr(getattr(t, "text", None), "value", None)
        )
    parts = []
    for item in getattr(message, "content", None) or []:
        text = item.get("text") if isinstance(item, dict) else getattr(item, "text", None)
        value = text.get("value") if isinstance(text, dict) else getattr(text, "value", text)
        if isinstance(value, str) and value:
            parts.append(value)
    return "\n".join(parts)


def _run_agent_v2(client, prompt):
    """azure-ai-projects 2.x flow: conversation + response against the named agent."""
    openai_client = _get_openai_client(client)
    conversation = openai_client.conversations.create()
    response = openai_client.responses.create(
        conversation=conversation.id,
        input=prompt,
        extra_body={"agent": {"name": AZURE_AGENT_ID, "type": "agent_reference"}},
    )

    deadline = time.time() + RUN_TIMEOUT_SECONDS
    while getattr(response, "status", "completed") in ("queued", "in_progress"):
        if time.time() > deadline:
            raise TimeoutError(
                f"Agent response did not complete within {RUN_TIMEOUT_SECONDS} seconds."
            )
        time.sleep(RUN_POLL_INTERVAL_SECONDS)
        response = openai_client.responses.retrieve(response.id)

    status = getattr(response, "status", "completed")
    if status not in ("completed", None):
        err = getattr(response, "error", None)
        detail = getattr(err, "message", None) or str(err or "unknown error")
        raise RuntimeError(f"Agent response ended with status '{status}': {detail}")

    text = getattr(response, "output_text", None)
    if text:
        return text
    parts = []
    for item in getattr(response, "output", None) or []:
        for content in getattr(item, "content", None) or []:
            value = getattr(content, "text", None)
            if isinstance(value, str) and value:
                parts.append(value)
    if parts:
        return "\n".join(parts)
    raise RuntimeError("Agent response completed but contained no output text.")


def _run_agent(client, prompt):
    agents = getattr(client, "agents", None)
    if agents is not None and hasattr(agents, "threads"):
        return _run_agent_legacy(client, prompt)
    return _run_agent_v2(client, prompt)


def _run_direct_model(client, prompt):
    """Last-resort fallback: call the model deployment directly (no agent)."""
    openai_client = _get_openai_client(client)
    completion = openai_client.chat.completions.create(
        model=AZURE_MODEL_DEPLOYMENT,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "You are BuildPath, an expert project-planning agent. "
                    "Respond with ONLY valid JSON matching the schema in the user message — "
                    "no prose, no markdown fences."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    )
    return completion.choices[0].message.content


# ---------------------------------------------------------------------------
# JSON extraction
# ---------------------------------------------------------------------------

def _extract_json(text):
    if not text or not text.strip():
        raise ValueError("the agent returned an empty response")
    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL)
    if fence:
        cleaned = fence.group(1).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def generate(prompt):
    """Send a prompt to the BuildPath Foundry agent and return parsed JSON.

    Returns the parsed dict on success, or {"error": "..."} on any failure.
    """
    try:
        client = _get_project_client()
    except Exception as exc:  # noqa: BLE001 - surface every connection failure as data
        return {"error": f"Could not connect to Microsoft Foundry: {exc}"}

    raw_text = None
    failures = []
    for runner in (_run_agent, _run_direct_model):
        try:
            raw_text = runner(client, prompt)
            break
        except Exception as exc:  # noqa: BLE001 - try the next strategy, keep the reason
            failures.append(f"{runner.__name__.lstrip('_')}: {exc}")

    if raw_text is None:
        return {"error": "Agent run failed — " + " | ".join(failures)}

    try:
        parsed = _extract_json(raw_text)
    except (ValueError, json.JSONDecodeError) as exc:
        return {
            "error": f"The agent's response was not valid JSON ({exc}).",
            "raw_response": raw_text[:2000],
        }

    if not isinstance(parsed, dict):
        return {
            "error": "The agent's response parsed to JSON but was not an object.",
            "raw_response": raw_text[:2000],
        }
    return parsed
