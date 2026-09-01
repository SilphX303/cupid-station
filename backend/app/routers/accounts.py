import json

from fastapi import APIRouter

from .. import db
from ..models import AppAccountIn

router = APIRouter(prefix="/api", tags=["accounts", "stats"])


@router.get("/accounts")
def list_accounts():
    with db.connect() as con:
        rows = [dict(r) for r in con.execute("SELECT * FROM app_account ORDER BY app")]
    for r in rows:
        r["prompts"] = json.loads(r.get("prompts") or "[]")
    return rows


@router.put("/accounts/{app}")
def upsert_account(app: str, body: AppAccountIn):
    with db.connect() as con:
        con.execute(
            """INSERT INTO app_account (app, bio, prompts, notes, updated_at)
               VALUES (?,?,?,?,datetime('now'))
               ON CONFLICT(app) DO UPDATE SET bio=excluded.bio, prompts=excluded.prompts,
                   notes=excluded.notes, updated_at=datetime('now')""",
            (app, body.bio, json.dumps(body.prompts), body.notes),
        )
        row = con.execute("SELECT * FROM app_account WHERE app = ?", (app,)).fetchone()
    d = dict(row)
    d["prompts"] = json.loads(d["prompts"])
    return d


@router.get("/stats")
def stats():
    with db.connect() as con:
        by_status = {r["status"]: r["n"] for r in con.execute(
            "SELECT status, COUNT(*) AS n FROM prospect WHERE archived_at IS NULL GROUP BY status")}
        active = sum(n for s, n in by_status.items() if s not in ("scouting", "ended", "archived", "ghosted"))
        needs_attention = con.execute(
            """SELECT COUNT(*) AS n FROM prospect WHERE archived_at IS NULL
               AND status IN ('matched','chatting','quiet','date_planned','dating')
               AND (last_contact_at IS NULL OR last_contact_at < date('now','-3 days'))"""
        ).fetchone()["n"]
    return {"by_status": by_status, "active": active, "needs_attention": needs_attention}
