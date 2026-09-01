# Cupid Station

Private, self-hosted dating ops console. Tracks prospects across Hinge, Mattr,
Bumble and friends — profiles, media, messaging pipeline, date logs — in a
Picard-era LCARS interface, with Claude on call as support crew.

See `PLAN.md` for the full project plan and `docs/EXTRACTION.md` for the
screenshot-ingestion workflow.

## Stack

FastAPI + SQLite (stdlib `sqlite3`, plain SQL) · React 19 + Vite + Tailwind v4
· one Docker container. Data lives in a mounted volume: `data/cupid.db` +
`data/media/`. The app is auth-agnostic — access control belongs to the proxy
(LAN-only now, Authelia forward-auth later).

## Dev

```bash
# terminal 1 — API on :8000
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# terminal 2 — UI on :5173 (proxies /api and /media to :8000)
cd frontend
npm install
npm run dev
```

## Deploy (Coolify, hv-01)

```bash
docker compose up -d --build
```

Route `cupid.arkadia.network` → hv-01 in Pi-hole; Traefik labels are in
`docker-compose.yml` — adjust entrypoint/certresolver to match the host's
other services.

### Vision extraction (Ingest → Visual scan)

Set these on the container to enable in-app screenshot extraction (any
OpenAI-compatible chat-completions endpoint with image support):

```
CUPID_VISION_BASE_URL=http://<host>:<port>/v1
CUPID_VISION_MODEL=<served model name>
CUPID_VISION_API_KEY=<optional>
```

Unset = the Visual scan panel reports the sensor array offline and the
paste-JSON fallback remains available.

## API sketch

`GET/POST /api/prospects` · `GET/PATCH/DELETE /api/prospects/{id}` ·
`POST /api/prospects/{id}/events` · `POST /api/prospects/{id}/media` ·
`GET /api/prospects/{id}/briefing?question=…` · `POST /api/import` ·
`GET /api/stats` · `GET/PUT /api/accounts/{app}` · docs at `/docs`.

## Design language

Ported from the `starbase` iteration of the LCARS system (hairline-technical,
elbows retired, 2px radii, Antonio + JetBrains Mono). Tokens live in
`frontend/src/index.css`; token names are stable API. Yellow alert fires
automatically when prospects are awaiting action (no contact logged for 3+
days); `.red-alert` is wired and waiting for a worthy occasion.
