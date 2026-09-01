# Screenshot ingestion workflow

Dating apps have no APIs, so Cupid Station ingests via Claude's eyes.

## The loop

1. **Capture** — screenshot profiles and chat threads on your phone (or save
   them to an `inbox/` folder for batch runs).
2. **Extract** — attach the screenshots to any Claude chat along with the
   extraction prompt (copy it from the Ingest page in the app — it pins the
   exact JSON shape). Claude returns one fenced JSON block per person.
3. **Transport** — paste each block into Ingest → Receiver → Energize.
   `POST /api/import` matches on `match_name` (case-insensitive, non-archived):
   existing prospects are updated (apps/interests unioned, notes appended,
   status transitions logged as events); unknown names create a new prospect.

In a Cowork session with the cupid-station folder connected, steps 2–3
collapse: Claude can call the API or write the import blob directly.

## Import blob shape

See `backend/app/models.py::ImportBlob` — `{match_name, prospect{...},
events[...]}`. The prompt template in `frontend/src/pages/Import.tsx`
(`EXTRACTION_PROMPT`) is the single source of truth shown to users; keep the
two in sync if the schema changes.

## Status inference rules

- profile being browsed, no match confirmed → `scouting`
- fresh match, no messages → `matched`
- active back-and-forth → `chatting`
- no reply 3+ days → `quiet`
- a planned meetup visible → `date_planned`

The 3-day threshold also drives the app's yellow-alert / "awaiting action"
counter (`backend/app/routers/accounts.py::stats`).
