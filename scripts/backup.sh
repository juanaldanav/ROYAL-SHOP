#!/bin/bash
# backup.sh — Dump Postgres del stack Lighthouse + tar de volúmenes
# NO toca MariaDB del LAMP.
# Corre en la VM desde /opt/lighthouse-bot/
# Uso: ./scripts/backup.sh [--dry-run]

set -uo pipefail

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

BACKUP_DIR="/backups/lighthouse"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"

log() { echo "[backup $(date -u +%H:%M:%S)] $*"; }

if $DRY_RUN; then
    log "DRY RUN — no changes will be made"
    log "Would create: $BACKUP_PATH/"
    log "Would dump: n8n_db, chatwoot_db (Postgres)"
    log "Would tar: lighthouse_* Docker volumes"
    exit 0
fi

# Crear directorio
sudo mkdir -p "$BACKUP_PATH"
sudo chown lighthouse:lighthouse "$BACKUP_PATH"

# ---------------------------------------------------------------------------
# Postgres dumps (n8n + chatwoot)
# ---------------------------------------------------------------------------
log "Dumping n8n_db..."
docker compose exec -T postgres pg_dump -U n8n_user n8n_db | gzip > "$BACKUP_PATH/n8n_db.sql.gz"

log "Dumping chatwoot_db..."
docker compose exec -T postgres pg_dump -U chatwoot_user chatwoot_db | gzip > "$BACKUP_PATH/chatwoot_db.sql.gz"

log "Dumping evolution_db..."
docker compose exec -T postgres pg_dump -U postgres evolution_db | gzip > "$BACKUP_PATH/evolution_db.sql.gz"

# ---------------------------------------------------------------------------
# Volúmenes importantes
# ---------------------------------------------------------------------------
log "Archiving n8n data volume..."
docker run --rm -v lighthouse_n8n_data:/data -v "$BACKUP_PATH":/backup \
    alpine tar czf /backup/n8n_data.tar.gz -C /data .

log "Archiving chatwoot storage volume..."
docker run --rm -v lighthouse_chatwoot_storage:/data -v "$BACKUP_PATH":/backup \
    alpine tar czf /backup/chatwoot_storage.tar.gz -C /data .

log "Archiving booksy sessions..."
docker run --rm -v lighthouse_booksy_storage:/data -v "$BACKUP_PATH":/backup \
    alpine tar czf /backup/booksy_storage.tar.gz -C /data .

# ---------------------------------------------------------------------------
# Limpiar backups viejos (>14 días)
# ---------------------------------------------------------------------------
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +14 -exec sudo rm -rf {} + 2>/dev/null || true

log "Backup complete: $BACKUP_PATH"
ls -lh "$BACKUP_PATH/"
