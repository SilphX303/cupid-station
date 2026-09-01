# Cupid Station — Project Plan

*Drafted 2026-09-01 with Claude. Status: agreed, pre-build.*

## Vision

Dating happens across too many apps to hold in one head. Cupid Station is a
private, self-hosted "dating ops console" that tracks every prospect across
Hinge, Mattr, Bumble (and whatever comes next): who they are, what app they're
on, where the conversation stands, and what happened on each date — presented
as a Picard-era LCARS station interface, with Claude on call as support crew.

## Decisions (locked 2026-09-01)

| Decision | Choice | Why |
|---|---|---|
| Architecture | Hybrid: local/self-hosted data, Claude support via chat | Dating data stays on Steve's infrastructure, never a hosted page |
| Stack | FastAPI + SQLite + React, single Docker container | Mirrors the proven Arkadia Forge pattern; Python backend supports Steve's learning path |
| Deployment | Docker on the homelab via Coolify, Traefik routing, Pi-hole internal DNS | Standard lab pattern |
| Access | LAN-only at launch; designed for Authelia/Traefik forward-auth later | App stays auth-agnostic; SSO drops in at the proxy without code changes |
| Aesthetic | Picard-era LCARS (2399 refit) | Steve will name reference apps he already uses; extract palette/panels from them before UI work |
| Ingestion | Screenshots → Claude extracts (chat for one-offs, inbox folder for batches) + manual forms for quick edits | No dating app has an API; extraction plays to Claude's strengths |
| Claude support | Both: per-profile "Consult Claude" briefing button + ask-by-name in a Cowork session on this folder | Button embeds full context so it works anywhere; ask-by-name for speed during dev |

## V1 scope (launch-critical)

1. **Roster + profiles** — one record per prospect: name, age, app(s) met on,
   photos/screenshots, interests, notes, current status.
2. **Messaging pipeline** — status per prospect (matched → chatting → quiet →
   ghosted / date planned → dating → ended) with last-contact date, so nobody
   slips through the cracks. Station-style board view: who needs a reply, who's
   gone dark.
3. **Ask-Claude support** — "Consult Claude" button on each profile that copies
   a full briefing (profile, conversation state, question slot) to the clipboard
   for any Claude chat; plus ask-by-name when working in a session connected to
   this folder.

## Phase 2 (post-launch)

- **Date log** — per-prospect log: venue, how it felt, green/red flags, next step.
- **Stats dashboard** — active daters count, pipeline funnel, response times.
- **Inbox batch processing** — drop a swiping session's screenshots in
  `inbox/`, process the backlog in one Claude pass.
- **MCP bridge** — once the se7en.network MCP connector edge exists, Claude
  reads/writes Cupid Station's API directly instead of via briefing text.
- **Authelia** in front via Traefik forward-auth.

## Architecture

- **Container**: one image. FastAPI serves the API *and* the built React bundle.
- **Volumes**: `/data/cupid.db` (SQLite) and `/data/media/` (photos & screenshots).
- **Dev**: repo lives at `C:\Users\silph\dev\cupid-station`; run via
  `docker compose up` or uvicorn + vite dev servers. During dev, Claude
  (Cowork, connected to this folder) can read/write the data directly.
- **Deployed**: Coolify app, Traefik router, Pi-hole record (e.g.
  `cupid.arkadia.network` — Steve to pick host + name). After deployment the
  Import page (paste-a-JSON-blob from a Claude extraction chat) covers
  ingestion until the MCP bridge lands.

## Data model (first cut)

- `prospect` — id, display_name, age, location, apps[] (hinge/mattr/bumble/…),
  status, last_contact_at, interests[], notes, created_at, archived_at
- `media` — id, prospect_id, path, kind (photo | profile_screenshot |
  chat_screenshot), captured_at, caption
- `event` — id, prospect_id, ts, type (status_change | message_note | date |
  consult | note), payload JSON  → the per-prospect timeline; date-log entries
  in phase 2 are just `type=date` events with a richer payload
- `app_account` — Steve's own profile per app (bio text, prompts, photo set) —
  supports the "profiles" upload requirement

## Pipeline statuses

`matched` → `chatting` → `quiet` → `ghosted` | `date_planned` → `dating` →
`ended` (+ `archived`). Transitions logged as events, so the funnel stats in
phase 2 come free.

## Build order

1. Repo scaffold: FastAPI app, SQLite schema/migrations, React + Vite, Dockerfile, compose file.
2. API + roster CRUD, media upload.
3. LCARS design system (after studying Steve's reference apps) — tokens, panel components, type.
4. Roster board + profile view + pipeline board.
5. Consult-Claude briefing generator.
6. Import page (JSON blob from extraction chats).
7. Coolify deployment, Traefik + Pi-hole wiring.

## Open items

- [x] LCARS reference apps: Silphx303/starbase + Silphx303/mission-control — synthesis: mission-control's component inventory re-skinned in starbase's Picard-era tokens (hairline-technical, 2px radii, Antonio + JetBrains Mono). Done 2026-09-01.
- [x] Hostname: cupid.arkadia.network, deployed on HV01. Traefik labels in docker-compose.yml.
- [x] Extraction flow tested against the "eval photos" Drive batch (Harriet ingested end-to-end). Added a `scouting` status for profiles browsed pre-match — real data exposed the gap.
- [ ] Deploy to HV01 via Coolify + Pi-hole record
- [ ] Process the rest of the eval photos batch
- [ ] Phase 2 backlog: date log UI, stats dashboard, inbox batch, MCP bridge, Authelia

## Status 2026-09-01

v0.1 scaffold built and verified (API smoke-tested, UI screenshotted): roster,
comms pipeline board, prospect profiles with media + timeline, consult-Claude
briefing button, ingest page with extraction prompt. Source in this folder;
`data/` ships with seed records — Sarah/Amy/Kate are FICTIONAL test seeds,
Harriet is real (from the eval batch). Purge the fictional three when done
testing. Dev: uvicorn + `npm run dev`; deploy: `docker compose up -d --build`.
