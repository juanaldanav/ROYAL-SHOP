#!/bin/bash
# remote-bootstrap.sh — Corre en la VM como noreply (con sudo donde aplica)
# Idempotente: verifica antes de instalar/crear.
# NO toca apache, mariadb, omada, telemetría GCP.
# NO activa ufw — lo decide el humano.
# NO arranca docker compose — lo hace el humano.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[bootstrap]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

# ---------------------------------------------------------------------------
# 1. Verificar que los servicios críticos siguen activos
# ---------------------------------------------------------------------------
log "Checking critical services..."
for svc in apache2 mariadb tpeap; do
    if ! sudo systemctl is-active --quiet "$svc"; then
        fail "CRITICAL: $svc is NOT active — aborting bootstrap to avoid further damage"
    fi
done
log "All critical services active ✓"

# ---------------------------------------------------------------------------
# 2. Verificar puertos libres (Lighthouse target ports)
# ---------------------------------------------------------------------------
log "Checking target ports..."
PORTS_NEEDED=(9080 9443 5433 6380 5678 8001 3001 8002)
for port in "${PORTS_NEEDED[@]}"; do
    if sudo ss -tlnp | grep -q ":${port} "; then
        warn "Port ${port} is in use — check docker-compose.yml and reassign if needed"
    fi
done
log "Port check done ✓"

# ---------------------------------------------------------------------------
# 3. Instalar Docker (idempotente)
# ---------------------------------------------------------------------------
if command -v docker &>/dev/null; then
    log "Docker already installed: $(docker --version)"
else
    log "Installing Docker CE..."

    # Dependencias
    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release

    # GPG key
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    # Repo
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | \
        sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Instalar
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    log "Docker installed: $(docker --version)"
fi

# ---------------------------------------------------------------------------
# 4. Verificar que los servicios críticos siguen activos post-Docker
# ---------------------------------------------------------------------------
log "Re-checking critical services after Docker install..."
for svc in apache2 mariadb tpeap; do
    if ! sudo systemctl is-active --quiet "$svc"; then
        fail "CRITICAL: $svc became inactive after Docker install — INVESTIGATE IMMEDIATELY"
    fi
done
log "All critical services still active post-Docker ✓"

# ---------------------------------------------------------------------------
# 5. Agregar lighthouse al grupo docker (idempotente)
# ---------------------------------------------------------------------------
if groups lighthouse 2>/dev/null | grep -q docker; then
    log "lighthouse already in docker group"
else
    log "Adding lighthouse to docker group..."
    sudo usermod -aG docker lighthouse
    log "lighthouse added to docker group (effective on next login)"
fi

# ---------------------------------------------------------------------------
# 6. Crear /opt/lighthouse-bot/ (idempotente)
# ---------------------------------------------------------------------------
if [ -d /opt/lighthouse-bot ]; then
    log "/opt/lighthouse-bot/ already exists"
else
    log "Creating /opt/lighthouse-bot/..."
    sudo mkdir -p /opt/lighthouse-bot
fi

sudo chown lighthouse:lighthouse /opt/lighthouse-bot
sudo chmod 755 /opt/lighthouse-bot
log "/opt/lighthouse-bot/ ready (owner: lighthouse) ✓"

# ---------------------------------------------------------------------------
# 7. Verificar recursos finales
# ---------------------------------------------------------------------------
log "Final resource check..."
DISK_AVAIL_GB=$(df -BG / | awk 'NR==2 {print $4}' | tr -d 'G')
RAM_AVAIL_MB=$(free -m | awk '/^Mem:/{print $7}')

if [ "$DISK_AVAIL_GB" -lt 4 ]; then
    fail "Disk space too low: ${DISK_AVAIL_GB}GB free (need >= 4GB)"
fi
if [ "$RAM_AVAIL_MB" -lt 500 ]; then
    warn "RAM available low: ${RAM_AVAIL_MB}MB — monitor closely when starting stack"
fi
log "Resources: disk ${DISK_AVAIL_GB}GB free, RAM ${RAM_AVAIL_MB}MB available ✓"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
log "Bootstrap complete ✓"
log "Next steps (human action required):"
log "  1. Copy .env.example to .env in /opt/lighthouse-bot/ and fill credentials"
log "  2. cd /opt/lighthouse-bot && docker compose up -d"
log "  3. Run: docker compose ps  (confirm all healthy)"
log "  4. Run: ./scripts/healthcheck.sh"
