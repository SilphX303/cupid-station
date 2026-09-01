"""Vision extraction — turns dating-app screenshots into a structured draft.

Talks to any OpenAI-compatible chat-completions endpoint with image support:
vLLM on the lab (preferred — screenshots never leave the LAN), OpenAI, Z.AI…

Config (environment):
    CUPID_VISION_BASE_URL  e.g. http://10.0.1.235:8000/v1  (no trailing /chat/completions)
    CUPID_VISION_MODEL     e.g. Qwen/Qwen3-VL-30B-A3B-Instruct
    CUPID_VISION_API_KEY   optional (vLLM usually ignores it)
"""
import base64
import json
import os
import re

import httpx

SYSTEM_PROMPT = """You extract structured data from dating-app screenshots (profiles and chats).
Reply with ONE JSON object and nothing else, exactly this shape:

{
  "display_name": "<first name, or null if not visible>",
  "age": <number or null>,
  "location": "<text or null>",
  "apps": ["hinge" | "mattr" | "bumble" | "other"],
  "status": "scouting" | "matched" | "chatting" | "quiet" | "ghosted" | "date_planned" | "dating",
  "last_contact_at": "<YYYY-MM-DD of the latest visible message, or null>",
  "looking_for": "<what they say they want (relationship type, dating intentions), or null>",
  "interests": ["<from the profile>"],
  "prompts": [{"question": "<prompt title>", "answer": "<their answer>"}],
  "notes": "<anything else notable: bio highlights, vibe, verified badge, job, pets…>",
  "conversation_summary": "<for chat screenshots: who spoke last, tone, open threads — else null>"
}

Which app: infer from the UI (Hinge's serif prompts and heart button; Bumble's yellow; Mattr's look) — "other" if unsure.
Status: profile being browsed with no match visible = scouting; fresh match no chat = matched;
active back-and-forth = chatting; no reply 3+ days = quiet; planned meetup visible = date_planned.
Multiple screenshots in one request are the SAME person unless clearly not — merge into one object.
Never invent data; use null for anything not visible."""

SELF_PROMPT = """You extract the USER'S OWN dating-app profile from screenshots of it.
Reply with ONE JSON object and nothing else, exactly this shape:

{
  "app": "hinge" | "mattr" | "bumble" | "<other app name in lowercase>",
  "bio": "<their bio/about text, verbatim, or empty string>",
  "prompts": [{"question": "<prompt title>", "answer": "<their answer, verbatim>"}],
  "notes": "<anything else on the profile worth recording: badges, photo count and what the photos show, stated preferences>"
}

Which app: infer from the UI (Hinge's serif prompts; Bumble's yellow; Mattr's look) —
use the app's lowercase name if it's some other app you recognise.
Multiple screenshots are the SAME profile — merge. Quote bio and prompt answers
verbatim; never paraphrase them. Never invent data."""


def configured() -> bool:
    return bool(os.environ.get("CUPID_VISION_BASE_URL") and os.environ.get("CUPID_VISION_MODEL"))


def analyze(images: list[tuple[bytes, str]], system_prompt: str = SYSTEM_PROMPT) -> dict:
    """images: list of (raw bytes, mime type). Returns the parsed draft dict."""
    base = os.environ["CUPID_VISION_BASE_URL"].rstrip("/")
    model = os.environ["CUPID_VISION_MODEL"]
    key = os.environ.get("CUPID_VISION_API_KEY", "none")

    content: list[dict] = [
        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{base64.b64encode(raw).decode()}"}}
        for raw, mime in images
    ]
    content.append({"type": "text", "text": "Extract this person's details as specified."})

    resp = httpx.post(
        f"{base}/chat/completions",
        headers={"Authorization": f"Bearer {key}"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content},
            ],
            "temperature": 0.1,
            "max_tokens": 1500,
        },
        timeout=120,
    )
    resp.raise_for_status()
    text = resp.json()["choices"][0]["message"]["content"]

    # strip a ```json fence or surrounding prose if the model added any
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match is None:
        raise ValueError(f"model returned no JSON object: {text[:200]}")
    return json.loads(match.group(0))
