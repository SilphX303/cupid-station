"""Cupid Station — private dating ops console.

FastAPI serves the JSON API, the media files, and (in the container) the
built React bundle. Auth-agnostic by design: access control belongs to the
proxy layer (Traefik forward-auth / Authelia later).
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import db
from .routers import accounts, importer, ingest, media, prospects

app = FastAPI(title="Cupid Station", version="0.1.0")
db.init()

# Dev convenience: vite dev server (5173) talking to uvicorn (8000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prospects.router)
app.include_router(media.router)
app.include_router(importer.router)
app.include_router(ingest.router)
app.include_router(accounts.router)

app.mount("/media", StaticFiles(directory=db.MEDIA_DIR), name="media")

# Built frontend (present in the container; absent in dev, where vite serves it)
STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
