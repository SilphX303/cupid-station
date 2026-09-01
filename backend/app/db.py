"""SQLite access layer.

Deliberately plain: stdlib sqlite3, explicit SQL, no ORM. Every query is
readable and greppable. Connections are short-lived per request.
"""
import json
import os
import sqlite3
from pathlib import Path

DATA_DIR = Path(os.environ.get("CUPID_DATA_DIR", Path(__file__).resolve().parents[2] / "data"))
DB_PATH = DATA_DIR / "cupid.db"
MEDIA_DIR = DATA_DIR / "media"

SCHEMA_PATH = Path(__file__).parent / "schema.sql"

VALID_STATUSES = [
    "scouting", "matched", "chatting", "quiet", "ghosted",
    "date_planned", "dating", "ended", "archived",
]


def init() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as con:
        con.executescript(SCHEMA_PATH.read_text())


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def row_to_prospect(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["apps"] = json.loads(d.get("apps") or "[]")
    d["interests"] = json.loads(d.get("interests") or "[]")
    return d


def row_to_event(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["payload"] = json.loads(d.get("payload") or "{}")
    return d
