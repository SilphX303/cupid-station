#!/usr/bin/env bash
# Nightly backup of the cupid-data volume (SQLite db + media).
#
# Runs on the Docker host (HV01). Takes a CONSISTENT database snapshot via
# SQLite's VACUUM INTO inside the running container (safe against concurrent
# writes, unlike copying the .db file), then tars the whole /data tree.
#
# Usage:   backup-cupid.sh [DEST_DIR]
# Default: /srv/backups/cupid   — point it at NAS-mounted storage.
# Retention: last 14 archives are kept.
set -euo pipefail

DEST="${1:-/srv/backups/cupid}"
KEEP=14
STAMP="$(date +%Y%m%d-%H%M%S)"

CONTAINER="$(docker ps --format '{{.Names}}' | grep -i cupid | head -1)"
if [ -z "$CONTAINER" ]; then
    echo "backup-cupid: no running cupid container found" >&2
    exit 1
fi

mkdir -p "$DEST"

# 1. Consistent SQLite snapshot inside the container
docker exec "$CONTAINER" python3 - << 'EOF'
import os, sqlite3
snap = "/data/.backup-snapshot.db"
if os.path.exists(snap):
    os.unlink(snap)
sqlite3.connect("/data/cupid.db").execute(f'VACUUM INTO "{snap}"').close()
EOF

# 2. Tar the data tree (snapshot instead of the live db) out of the container
docker exec "$CONTAINER" tar czf - \
    --transform='s|.backup-snapshot.db|cupid.db|' \
    --exclude='data/cupid.db' --exclude='data/cupid.db-*' --exclude='data/inbox' \
    -C / data > "$DEST/cupid-$STAMP.tar.gz"

# 3. Clean the snapshot and rotate old archives
docker exec "$CONTAINER" rm -f /data/.backup-snapshot.db
ls -1t "$DEST"/cupid-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "backup-cupid: wrote $DEST/cupid-$STAMP.tar.gz ($(du -h "$DEST/cupid-$STAMP.tar.gz" | cut -f1))"
