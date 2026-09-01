"""Pydantic request/response models."""
from typing import Any, Optional

from pydantic import BaseModel, Field


class ProspectIn(BaseModel):
    display_name: str
    nickname: Optional[str] = None
    age: Optional[int] = None
    location: Optional[str] = None
    apps: list[str] = []
    status: str = "matched"
    last_contact_at: Optional[str] = None
    looking_for: Optional[str] = None
    interests: list[str] = []
    prompts: list[dict[str, str]] = []
    notes: str = ""


class ProspectPatch(BaseModel):
    display_name: Optional[str] = None
    nickname: Optional[str] = None
    age: Optional[int] = None
    location: Optional[str] = None
    apps: Optional[list[str]] = None
    status: Optional[str] = None
    last_contact_at: Optional[str] = None
    looking_for: Optional[str] = None
    interests: Optional[list[str]] = None
    prompts: Optional[list[dict[str, str]]] = None
    notes: Optional[str] = None
    archived_at: Optional[str] = None


class EventIn(BaseModel):
    type: str = Field(pattern="^(status_change|message_note|date|consult|note)$")
    ts: Optional[str] = None
    payload: dict[str, Any] = {}


class AppAccountIn(BaseModel):
    app: str
    bio: str = ""
    prompts: list[dict[str, str]] = []
    notes: str = ""


class ImportBlob(BaseModel):
    """The JSON blob a Claude extraction chat produces (see docs/EXTRACTION.md).

    If `match_name` is set and a non-archived prospect with that display_name
    exists, the blob updates that prospect; otherwise a new one is created.
    """
    match_name: Optional[str] = None
    prospect: ProspectIn
    events: list[EventIn] = []
