#!/bin/bash
# restore.sh — Restaura backup de Lighthouse (Postgres + volúmenes)
# Uso: ./scripts/restore.sh <backup-timestamp>
# Ejemplo: ./scripts/restore.sh 20260507-234000

set -uo pipefail

TIMESTAMP="${1:-}"
BACKUP_DIR="/backups/lighthouse"
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

log() { echo "[restore $(date -u +%H:%M:%S)] $*"; }
fail() { echo "[FAIL] $*"; exit 1; }

[ -z "$TIMESTAMP" ] && fail "Usage: $0 <timestamp> — available: $(ls $BACKUP_DIR)"
[ -d "$BACKUP_PATH" ] || fail "Backup not found: $BACKUP_PATH"

log "Restoring from: $BACKUP_PATH"
log "Available files:"
ls -lh "$BACKUP_PATH/"

read -p "This will OVERWRITE current data. Continue? [y/N] " confirm
[ "$confirm" = "y" ] || { log "Aborted."; exit 0; }

# Stop services (not postgres/redis — needed for restore)
log "Stopping app services..."
docker compose stop n8n chatwoot-web chatwoot-sidekiq evolution-api booksy-executor

# ---------------------------------------------------------------------------
# Restore Postgres
# ---------------------------------------------------------------------------
log "Restoring n8n_db..."
zcat "$BACKUP_PATH/n8n_db.sql.gz" | docker compose exec -T postgres psql -U n8n_user n8n_db

log "Restoring chatwoot_db..."
zcat "$BACKUP_PATH/chatwoot_db.sql.gz" | docker compose exec -T postgres psql -U chatwoot_user chatwoot_db

# ---------------------------------------------------------------------------
# Restore volumes
# ---------------------------------------------------------------------------
if [ -f "$BACKUP_PATH/n8n_data.tar.gz" ]; then
    log "Restoring n8n data volume..."
    docker run --rm -v lighthouse_n8n_data:/data -v "$BACKUP_PATH":/backup \
        alpine sh -c "cd /data && tar xzf /backup/n8n_data.tar.gz"
fi

if [ -f "$BACKUP_PATH/chatwoot_storage.tar.gz" ]; then
    log "Restoring chatwoot storage..."
    docker run --rm -v lighthouse_chatwoot_storage:/data -v "$BACKUP_PATH":/backup \
        alpine sh -c "cd /data && tar xzf /backup/chatwoot_storage.tar.gz"
fi

# Restart
log "Restarting services..."
docker compose start n8n chatwoot-web chatwoot-sidekiq evolution-api booksy-executor

log "Restore complete. Run ./scripts/healthcheck.sh to verify."
