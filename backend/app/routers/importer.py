import json

from fastapi import APIRouter, HTTPException

from .. import db
from ..models import ImportBlob

router = APIRouter(prefix="/api", tags=["import"])


@router.post("/import", status_code=201)
def import_blob(body: ImportBlob):
    """Ingest a JSON blob produced by a Claude extraction chat.

    Matching: if match_name is given and a non-archived prospect has that
    display_name (case-insensitive), we update it — non-empty incoming fields
    win, notes are appended. Otherwise a new prospect is created.
    """
    p = body.prospect
    with db.connect() as con:
        existing = None
        if body.match_id is not None:
            existing = con.execute(
                "SELECT * FROM prospect WHERE id = ?", (body.match_id,)
            ).fetchone()
            if existing is None:
                raise HTTPException(404, f"match_id {body.match_id} not found")
        elif body.match_name:
            existing = con.execute(
                "SELECT * FROM prospect WHERE archived_at IS NULL AND lower(display_name) = lower(?)",
                (body.match_name,),
            ).fetchone()

        if existing is None:
            cur = con.execute(
                """INSERT INTO prospect (display_name, age, location, apps, status,
                                         last_contact_at, looking_for, interests, prompts, notes)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (p.display_name, p.age, p.location, json.dumps(p.apps), p.status,
                 p.last_contact_at, p.looking_for, json.dumps(p.interests),
                 json.dumps(p.prompts), p.notes),
            )
            prospect_id, action = cur.lastrowid, "created"
        else:
            cur_p = db.row_to_prospect(existing)
            prospect_id, action = cur_p["id"], "updated"
            merged_apps = sorted(set(cur_p["apps"]) | set(p.apps))
            merged_interests = sorted(set(cur_p["interests"]) | set(p.interests))
            merged_prompts = cur_p["prompts"] + [
                pr for pr in p.prompts if pr not in cur_p["prompts"]
            ]
            notes = cur_p["notes"]
            if p.notes and p.notes not in notes:
                notes = (notes + "\n\n" + p.notes).strip()
            if p.status != cur_p["status"]:
                con.execute(
                    "INSERT INTO event (prospect_id, type, payload) VALUES (?,?,?)",
                    (prospect_id, "status_change",
                     json.dumps({"from": cur_p["status"], "to": p.status, "via": "import"})),
                )
            con.execute(
                """UPDATE prospect SET age = COALESCE(?, age), location = COALESCE(?, location),
                       apps = ?, status = ?, last_contact_at = COALESCE(?, last_contact_at),
                       looking_for = COALESCE(?, looking_for), interests = ?, prompts = ?,
                       notes = ? WHERE id = ?""",
                (p.age, p.location, json.dumps(merged_apps), p.status, p.last_contact_at,
                 p.looking_for, json.dumps(merged_interests), json.dumps(merged_prompts),
                 notes, prospect_id),
            )

        for e in body.events:
            con.execute(
                "INSERT INTO event (prospect_id, type, ts, payload) VALUES (?,?,COALESCE(?, datetime('now')),?)",
                (prospect_id, e.type, e.ts, json.dumps(e.payload)),
            )
    return {"action": action, "prospect_id": prospect_id, "events_added": len(body.events)}
