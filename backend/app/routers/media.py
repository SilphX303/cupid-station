import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .. import db

router = APIRouter(prefix="/api", tags=["media"])

ALLOWED = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"}
KINDS = {"photo", "profile_screenshot", "chat_screenshot"}


@router.post("/prospects/{prospect_id}/media", status_code=201)
async def upload_media(
    prospect_id: int,
    file: UploadFile = File(...),
    kind: str = Form("photo"),
    caption: str = Form(""),
):
    if kind not in KINDS:
        raise HTTPException(422, f"kind must be one of {sorted(KINDS)}")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(422, f"file type {ext or '(none)'} not allowed")

    with db.connect() as con:
        if con.execute("SELECT 1 FROM prospect WHERE id = ?", (prospect_id,)).fetchone() is None:
            raise HTTPException(404, "prospect not found")

    stem = re.sub(r"[^a-z0-9]+", "-", (Path(file.filename or "img").stem).lower())[:40] or "img"
    rel = f"{prospect_id}/{stem}-{uuid.uuid4().hex[:8]}{ext}"
    dest = db.MEDIA_DIR / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(await file.read())

    with db.connect() as con:
        cur = con.execute(
            "INSERT INTO media (prospect_id, path, kind, caption) VALUES (?,?,?,?)",
            (prospect_id, rel, kind, caption),
        )
        row = con.execute("SELECT * FROM media WHERE id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@router.delete("/media/{media_id}", status_code=204)
def delete_media(media_id: int):
    with db.connect() as con:
        row = con.execute("SELECT * FROM media WHERE id = ?", (media_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "media not found")
        con.execute("DELETE FROM media WHERE id = ?", (media_id,))
    target = (db.MEDIA_DIR / row["path"]).resolve()
    if target.is_relative_to(db.MEDIA_DIR.resolve()) and target.exists():
        target.unlink()
