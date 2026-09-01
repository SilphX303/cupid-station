-- Cupid Station schema. Applied idempotently at startup (db.py).

CREATE TABLE IF NOT EXISTS prospect (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name  TEXT NOT NULL,
    nickname      TEXT,                         -- disambiguator ("Gym Sarah") — unique-ish by convention
    age           INTEGER,
    location      TEXT,
    apps          TEXT NOT NULL DEFAULT '[]',   -- JSON array: ["hinge","mattr","bumble",...]
    status        TEXT NOT NULL DEFAULT 'matched',
    last_contact_at TEXT,                       -- ISO date of last message either way
    next_date_at  TEXT,                         -- ISO date of the next planned date, if any
    interests     TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
    looking_for   TEXT,                         -- their stated dating intentions
    prompts       TEXT NOT NULL DEFAULT '[]',   -- JSON array of {question, answer} from their profile
    notes         TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    archived_at   TEXT
);

CREATE TABLE IF NOT EXISTS media (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id INTEGER NOT NULL REFERENCES prospect(id) ON DELETE CASCADE,
    path        TEXT NOT NULL,                  -- relative to the media dir
    kind        TEXT NOT NULL DEFAULT 'photo',  -- photo | profile_screenshot | chat_screenshot
    caption     TEXT NOT NULL DEFAULT '',
    captured_at TEXT,
    is_portrait INTEGER NOT NULL DEFAULT 0,       -- at most one per prospect
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id INTEGER NOT NULL REFERENCES prospect(id) ON DELETE CASCADE,
    ts          TEXT NOT NULL DEFAULT (datetime('now')),
    type        TEXT NOT NULL,                  -- status_change | message_note | date | consult | note
    payload     TEXT NOT NULL DEFAULT '{}'      -- JSON, shape depends on type
);

-- Steve's own profile per app (bio, prompts, photo set notes)
CREATE TABLE IF NOT EXISTS app_account (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    app        TEXT NOT NULL UNIQUE,            -- hinge | mattr | bumble | ...
    bio        TEXT NOT NULL DEFAULT '',
    prompts    TEXT NOT NULL DEFAULT '[]',      -- JSON array of {question, answer}
    notes      TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_prospect ON media(prospect_id);
CREATE INDEX IF NOT EXISTS idx_event_prospect ON event(prospect_id, ts);
CREATE INDEX IF NOT EXISTS idx_prospect_status ON prospect(status);
