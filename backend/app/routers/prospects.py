import json
from datetime import date

from fastapi import APIRouter, HTTPException

from .. import db
from ..models import EventIn, ProspectIn, ProspectPatch

router = APIRouter(prefix="/api/prospects", tags=["prospects"])


def _get_or_404(con, prospect_id: int) -> dict:
    row = con.execute("SELECT * FROM prospect WHERE id = ?", (prospect_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "prospect not found")
    return db.row_to_prospect(row)


def _validate_status(status: str) -> None:
    if status not in db.VALID_STATUSES:
        raise HTTPException(422, f"status must be one of {db.VALID_STATUSES}")


@router.get("")
def list_prospects(include_archived: bool = False):
    q = "SELECT * FROM prospect"
    if not include_archived:
        q += " WHERE archived_at IS NULL AND status != 'archived'"
    q += " ORDER BY last_contact_at IS NULL, last_contact_at DESC, created_at DESC"
    with db.connect() as con:
        prospects = [db.row_to_prospect(r) for r in con.execute(q)]
        for p in prospects:
            media = con.execute(
                """SELECT id, path, kind FROM media WHERE prospect_id = ?
                   ORDER BY is_portrait DESC,
                            CASE kind WHEN 'photo' THEN 0
                                      WHEN 'profile_screenshot' THEN 1
                                      ELSE 2 END, id LIMIT 1""",
                (p["id"],),
            ).fetchone()
            p["thumb"] = dict(media) if media else None
    return prospects


@router.post("", status_code=201)
def create_prospect(body: ProspectIn):
    _validate_status(body.status)
    with db.connect() as con:
        cur = con.execute(
            """INSERT INTO prospect (display_name, nickname, age, location, apps, status,
                                     last_contact_at, looking_for, interests, prompts, notes)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (body.display_name, body.nickname, body.age, body.location, json.dumps(body.apps),
             body.status, body.last_contact_at, body.looking_for,
             json.dumps(body.interests), json.dumps(body.prompts), body.notes),
        )
        return _get_or_404(con, cur.lastrowid)


@router.get("/{prospect_id}")
def get_prospect(prospect_id: int):
    with db.connect() as con:
        p = _get_or_404(con, prospect_id)
        p["media"] = [dict(r) for r in con.execute(
            "SELECT * FROM media WHERE prospect_id = ? ORDER BY created_at DESC", (prospect_id,))]
        p["events"] = [db.row_to_event(r) for r in con.execute(
            "SELECT * FROM event WHERE prospect_id = ? ORDER BY ts DESC", (prospect_id,))]
    return p


@router.patch("/{prospect_id}")
def patch_prospect(prospect_id: int, body: ProspectPatch):
    fields = body.model_dump(exclude_unset=True)
    with db.connect() as con:
        current = _get_or_404(con, prospect_id)
        if "status" in fields:
            _validate_status(fields["status"])
            if fields["status"] != current["status"]:
                # every transition is logged, so the phase-2 funnel comes free
                con.execute(
                    "INSERT INTO event (prospect_id, type, payload) VALUES (?,?,?)",
                    (prospect_id, "status_change",
                     json.dumps({"from": current["status"], "to": fields["status"]})),
                )
        sets, vals = [], []
        for key, val in fields.items():
            if key in ("apps", "interests", "prompts"):
                val = json.dumps(val)
            sets.append(f"{key} = ?")
            vals.append(val)
        if sets:
            con.execute(f"UPDATE prospect SET {', '.join(sets)} WHERE id = ?", (*vals, prospect_id))
        return _get_or_404(con, prospect_id)


@router.delete("/{prospect_id}", status_code=204)
def delete_prospect(prospect_id: int):
    with db.connect() as con:
        _get_or_404(con, prospect_id)
        con.execute("DELETE FROM prospect WHERE id = ?", (prospect_id,))


@router.post("/{prospect_id}/events", status_code=201)
def add_event(prospect_id: int, body: EventIn):
    with db.connect() as con:
        _get_or_404(con, prospect_id)
        cur = con.execute(
            "INSERT INTO event (prospect_id, type, ts, payload) VALUES (?,?,COALESCE(?, datetime('now')),?)",
            (prospect_id, body.type, body.ts, json.dumps(body.payload)),
        )
        row = con.execute("SELECT * FROM event WHERE id = ?", (cur.lastrowid,)).fetchone()
        return db.row_to_event(row)


@router.get("/{prospect_id}/briefing")
def briefing(prospect_id: int, question: str = ""):
    """Plain-text briefing for the Consult Claude button — self-contained, so it
    works pasted into any Claude chat with no folder access required."""
    with db.connect() as con:
        p = _get_or_404(con, prospect_id)
        events = [db.row_to_event(r) for r in con.execute(
            "SELECT * FROM event WHERE prospect_id = ? ORDER BY ts DESC LIMIT 20", (prospect_id,))]

    lines = [
        "CUPID STATION // CONSULT BRIEFING",
        f"Generated {date.today().isoformat()}",
        "",
        f"Prospect: {p['display_name']}"
        + (f" (aka {p['nickname']})" if p.get("nickname") else "")
        + (f", {p['age']}" if p["age"] else "")
        + (f", {p['location']}" if p["location"] else ""),
        f"Met on: {', '.join(p['apps']) or 'unknown'}",
        f"Pipeline status: {p['status']}"
        + (f" (last contact {p['last_contact_at']})" if p["last_contact_at"] else ""),
    ]
    if p["looking_for"]:
        lines.append(f"Looking for: {p['looking_for']}")
    if p["interests"]:
        lines.append(f"Interests: {', '.join(p['interests'])}")
    if p["prompts"]:
        lines.append("Their profile prompts:")
        for pr in p["prompts"]:
            lines.append(f"- {pr.get('question')}: {pr.get('answer')}")
    if p["notes"]:
        lines += ["", "My notes:", p["notes"]]
    dates = [e for e in events if e["type"] == "date"]
    if dates:
        lines += ["", "Date history (newest first):"]
        for e in dates[:5]:
            pl = e["payload"]
            bits = [pl.get("on") or e["ts"][:10], pl.get("venue") or "?", pl.get("verdict") or ""]
            line = f"- {' · '.join(str(b) for b in bits if b)}"
            if pl.get("green_flags"):
                line += f" | green: {', '.join(pl['green_flags'])}"
            if pl.get("red_flags"):
                line += f" | red: {', '.join(pl['red_flags'])}"
            if pl.get("text"):
                line += f" | {pl['text']}"
            if pl.get("next_step"):
                line += f" | next: {pl['next_step']}"
            lines.append(line)
    if events:
        lines += ["", "Recent timeline (newest first):"]
        for e in events:
            summary = e["payload"].get("text") or e["payload"].get("summary") \
                or json.dumps(e["payload"]) if e["payload"] else ""
            lines.append(f"- {e['ts']} [{e['type']}] {summary}")
    # my own profile on the apps this prospect is on — so advice can account
    # for what my profile claims about me
    with db.connect() as con:
        accounts = [dict(r) for r in con.execute("SELECT * FROM app_account")]
    mine = [a for a in accounts if a["app"] in p["apps"]]
    if mine:
        lines += ["", "My own profile on the app(s) we matched on:"]
        for a in mine:
            lines.append(f"[{a['app']}]")
            if a["bio"]:
                lines.append(f"  Bio: {a['bio']}")
            for pr in json.loads(a.get("prompts") or "[]"):
                lines.append(f"  {pr.get('question')}: {pr.get('answer')}")

    lines += ["", "What I need help with:", question or "<type your question here>"]
    return {"text": "\n".join(lines)}
