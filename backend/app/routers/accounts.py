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


@router.get("/stats/detail")
def stats_detail():
    """Everything the OPS dashboard renders. All derived from live tables —
    no denormalised counters to drift."""
    with db.connect() as con:
        by_status = {r["status"]: r["n"] for r in con.execute(
            "SELECT status, COUNT(*) AS n FROM prospect WHERE archived_at IS NULL GROUP BY status")}
        by_app = [dict(r) for r in con.execute(
            """SELECT j.value AS app, COUNT(*) AS n
               FROM prospect, json_each(prospect.apps) AS j
               WHERE archived_at IS NULL GROUP BY j.value ORDER BY n DESC""")]
        staleness_rows = con.execute(
            """SELECT CASE
                        WHEN last_contact_at IS NULL THEN 'never'
                        WHEN last_contact_at >= date('now') THEN 'today'
                        WHEN last_contact_at >= date('now', '-3 days') THEN '1-3d'
                        WHEN last_contact_at >= date('now', '-7 days') THEN '4-7d'
                        ELSE '8d+'
                      END AS bucket, COUNT(*) AS n
               FROM prospect
               WHERE archived_at IS NULL
                 AND status IN ('matched','chatting','quiet','date_planned','dating')
               GROUP BY bucket"""
        )
        staleness = {r["bucket"]: r["n"] for r in staleness_rows}
        totals = {
            "prospects": con.execute(
                "SELECT COUNT(*) AS n FROM prospect WHERE archived_at IS NULL").fetchone()["n"],
            "active": sum(n for s, n in by_status.items()
                          if s not in ("scouting", "ended", "archived", "ghosted")),
            "dates_logged": con.execute(
                "SELECT COUNT(*) AS n FROM event WHERE type = 'date'").fetchone()["n"],
            "consults": con.execute(
                "SELECT COUNT(*) AS n FROM event WHERE type = 'consult'").fetchone()["n"],
        }
        recent = {
            "new_7d": con.execute(
                "SELECT COUNT(*) AS n FROM prospect WHERE created_at >= datetime('now','-7 days')"
            ).fetchone()["n"],
            "events_30d": con.execute(
                "SELECT COUNT(*) AS n FROM event WHERE ts >= datetime('now','-30 days')"
            ).fetchone()["n"],
        }
    return {
        "by_status": by_status,
        "by_app": by_app,
        "staleness": staleness,
        "totals": totals,
        "recent": recent,
    }


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
        # RED ALERT: a date is scheduled for TODAY
        dates_today = [
            dict(r) for r in con.execute(
                """SELECT id, display_name, next_date_at FROM prospect
                   WHERE archived_at IS NULL AND next_date_at = date('now')"""
            )
        ]
    return {
        "by_status": by_status,
        "active": active,
        "needs_attention": needs_attention,
        "dates_today": dates_today,
    }
