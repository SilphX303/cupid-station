"""Visual ingest: upload screenshots → vision model drafts the record →
user reviews/edits → commit creates or updates the prospect with the
screenshots attached as media.

Uploads wait in data/inbox/ between analyze and commit so nothing is lost
if the user walks away mid-review.
"""
import json
import re
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from .. import db, extraction
from ..models import ProspectIn

router = APIRouter(prefix="/api/ingest", tags=["ingest"])

ALLOWED = {".jpg", ".jpeg", ".png", ".webp"}
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


class CommitBody(BaseModel):
    prospect: ProspectIn
    match_name: str | None = None
    conversation_summary: str | None = None
    inbox_ids: list[str] = []
    media_kind: str = "profile_screenshot"


@router.get("/status")
def status():
    return {"vision_configured": extraction.configured()}


@router.post("/analyze")
async def analyze(files: list[UploadFile] = File(...)):
    if not extraction.configured():
        raise HTTPException(
            503,
            "Vision extraction is not configured. Set CUPID_VISION_BASE_URL and "
            "CUPID_VISION_MODEL (and optionally CUPID_VISION_API_KEY), or use the "
            "paste-JSON receiver below.",
        )
    images: list[tuple[bytes, str]] = []
    inbox_ids: list[str] = []
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ALLOWED:
            raise HTTPException(422, f"file type {ext or '(none)'} not allowed")
        raw = await f.read()
        images.append((raw, MIME[ext]))
        inbox_id = f"{uuid.uuid4().hex[:12]}{ext}"
        (db.INBOX_DIR / inbox_id).write_bytes(raw)
        inbox_ids.append(inbox_id)

    try:
        draft = extraction.analyze(images)
    except Exception as e:  # surface model/endpoint failures readably
        raise HTTPException(502, f"vision model call failed: {e}")

    # find a likely existing match for the reviewer
    suggestion = None
    name = draft.get("display_name")
    if name:
        with db.connect() as con:
            row = con.execute(
                "SELECT id, display_name, status FROM prospect "
                "WHERE archived_at IS NULL AND lower(display_name) = lower(?)",
                (name,),
            ).fetchone()
            if row:
                suggestion = dict(row)

    return {"draft": draft, "inbox_ids": inbox_ids, "existing_match": suggestion}


@router.post("/commit", status_code=201)
def commit(body: CommitBody):
    from . import importer  # reuse the merge logic
    from ..models import EventIn, ImportBlob

    events = []
    if body.conversation_summary:
        events.append(EventIn(type="message_note", payload={"text": body.conversation_summary}))

    result = importer.import_blob(
        ImportBlob(match_name=body.match_name, prospect=body.prospect, events=events)
    )
    prospect_id = result["prospect_id"]

    attached = []
    with db.connect() as con:
        for inbox_id in body.inbox_ids:
            src = (db.INBOX_DIR / inbox_id).resolve()
            if not src.is_relative_to(db.INBOX_DIR.resolve()) or not src.exists():
                continue
            stem = re.sub(r"[^a-z0-9]+", "-", src.stem.lower())[:40] or "img"
            rel = f"{prospect_id}/{stem}{src.suffix}"
            dest = db.MEDIA_DIR / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dest))
            cur = con.execute(
                "INSERT INTO media (prospect_id, path, kind, caption) VALUES (?,?,?,?)",
                (prospect_id, rel, body.media_kind, "visual ingest"),
            )
            attached.append(cur.lastrowid)

    return {**result, "media_attached": len(attached)}
