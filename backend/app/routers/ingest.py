"""Visual ingest: upload screenshots → vision model drafts the record →
user reviews/edits → commit creates or updates the prospect with the
screenshots attached as media.

Uploads wait in data/inbox/ between analyze and commit so nothing is lost
if the user walks away mid-review.
"""
import json
import logging
import re
import shutil
import uuid
from pathlib import Path

logger = logging.getLogger("uvicorn.error")

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .. import db, extraction, photocrop
from ..models import ProspectIn

router = APIRouter(prefix="/api/ingest", tags=["ingest"])

ALLOWED = {".jpg", ".jpeg", ".png", ".webp"}
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


class CommitBody(BaseModel):
    prospect: ProspectIn
    match_name: str | None = None
    conversation_summary: str | None = None
    inbox_ids: list[str] = []           # the original screenshots
    media_kind: str = "profile_screenshot"
    crop_ids: list[str] = []            # cut-out photos the reviewer kept
    portrait_id: str | None = None      # one of crop_ids (or inbox_ids) to mark is_portrait


INBOX_TTL_HOURS = 24


def _sweep_inbox() -> int:
    """Drop analyze uploads that were never committed. Called opportunistically —
    no scheduler needed; any visit to the Ingest page triggers it."""
    import time

    cutoff = time.time() - INBOX_TTL_HOURS * 3600
    removed = 0
    for f in db.INBOX_DIR.glob("*"):
        try:
            if f.is_file() and f.stat().st_mtime < cutoff:
                f.unlink()
                removed += 1
        except OSError:
            pass
    if removed:
        logger.info("inbox sweep: removed %d abandoned upload(s)", removed)
    return removed


@router.get("/status")
def status():
    _sweep_inbox()
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

    # cut candidate photos out of each screenshot for the reviewer
    crop_ids: list[str] = []
    for inbox_id in inbox_ids:
        try:
            found = photocrop.crop_photos(
                db.INBOX_DIR / inbox_id, db.INBOX_DIR, Path(inbox_id).stem
            )
            crop_ids += found
            logger.info("photocrop: %s -> %d crop(s)", inbox_id, len(found))
        except Exception:
            # cropping is best-effort — the screenshots still attach — but never silent
            logger.exception("photocrop failed for %s", inbox_id)

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

    return {"draft": draft, "inbox_ids": inbox_ids, "crop_ids": crop_ids, "existing_match": suggestion}


@router.post("/analyze-self")
async def analyze_self(files: list[UploadFile] = File(...)):
    """Extract the user's OWN profile from screenshots — fills a My Profiles panel.
    Nothing is stored: the draft goes to the review form and the user saves via
    PUT /api/accounts/{app}."""
    if not extraction.configured():
        raise HTTPException(503, "Vision extraction is not configured.")
    images: list[tuple[bytes, str]] = []
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ALLOWED:
            raise HTTPException(422, f"file type {ext or '(none)'} not allowed")
        images.append((await f.read(), MIME[ext]))
    try:
        draft = extraction.analyze(images, system_prompt=extraction.SELF_PROMPT)
    except Exception as e:
        raise HTTPException(502, f"vision model call failed: {e}")
    return {"draft": draft}


@router.get("/inbox/{inbox_id}")
def inbox_preview(inbox_id: str):
    """Serve a pending upload or crop so the review panel can display it."""
    path = (db.INBOX_DIR / inbox_id).resolve()
    if not path.is_relative_to(db.INBOX_DIR.resolve()) or not path.is_file():
        raise HTTPException(404, "not in inbox")
    return FileResponse(path)


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

    def attach(con, inbox_id: str, kind: str, portrait: bool) -> int | None:
        src = (db.INBOX_DIR / inbox_id).resolve()
        if not src.is_relative_to(db.INBOX_DIR.resolve()) or not src.exists():
            return None
        stem = re.sub(r"[^a-z0-9]+", "-", src.stem.lower())[:40] or "img"
        rel = f"{prospect_id}/{stem}{src.suffix}"
        dest = db.MEDIA_DIR / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dest))
        if portrait:
            con.execute("UPDATE media SET is_portrait = 0 WHERE prospect_id = ?", (prospect_id,))
        cur = con.execute(
            "INSERT INTO media (prospect_id, path, kind, caption, is_portrait) VALUES (?,?,?,?,?)",
            (prospect_id, rel, kind, "visual ingest", 1 if portrait else 0),
        )
        return cur.lastrowid

    attached = []
    with db.connect() as con:
        for crop_id in body.crop_ids:
            mid = attach(con, crop_id, "photo", crop_id == body.portrait_id)
            if mid is not None:
                attached.append(mid)
        for inbox_id in body.inbox_ids:
            mid = attach(con, inbox_id, body.media_kind, inbox_id == body.portrait_id)
            if mid is not None:
                attached.append(mid)

    # discard crops the reviewer rejected
    for leftover in db.INBOX_DIR.glob("*"):
        if any(leftover.name.startswith(Path(i).stem + "-crop") for i in body.inbox_ids):
            leftover.unlink(missing_ok=True)

    return {**result, "media_attached": len(attached)}
