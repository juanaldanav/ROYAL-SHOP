#!/usr/bin/env bash
# deploy-vm.sh — Build and deploy royaleshop-pos to the GCP VM
# Usage: ./scripts/deploy-vm.sh
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
VM_USER="noreply"
VM_HOST="soporte.lamarque.mx"
VM_SSH="${VM_USER}@${VM_HOST}"
REMOTE_DIR="/opt/royaleshop"
COMPOSE_FILE="docker-compose.prod.yml"
APP_DIR="royale-shop"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ─── Resolve script location so it works regardless of cwd ───────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# ─── 1. SSH connectivity check ────────────────────────────────────────────────
info "Checking SSH connection to ${VM_SSH} ..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "${VM_SSH}" "echo ok" &>/dev/null; then
    error "Cannot reach ${VM_SSH}. Verify gcloud OS Login / SSH key."
    exit 1
fi
success "SSH connection OK"

# ─── 2. Ensure remote directory exists ────────────────────────────────────────
info "Ensuring ${REMOTE_DIR} exists on VM ..."
ssh "${VM_SSH}" "sudo mkdir -p ${REMOTE_DIR} && sudo chown \$(id -u):\$(id -g) ${REMOTE_DIR}"
success "Remote directory ready"

# ─── 3. Copy docker-compose.prod.yml ─────────────────────────────────────────
info "Copying ${COMPOSE_FILE} to VM ..."
scp "${REPO_ROOT}/${COMPOSE_FILE}" "${VM_SSH}:${REMOTE_DIR}/${COMPOSE_FILE}"
success "Compose file uploaded"

# ─── 4. Sync app source (exclude build artefacts) ─────────────────────────────
info "Syncing ${APP_DIR}/ source to VM ..."
rsync -az --delete \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='.env.local' \
    --exclude='.env.development' \
    --exclude='*.log' \
    "${REPO_ROOT}/${APP_DIR}/" \
    "${VM_SSH}:${REMOTE_DIR}/${APP_DIR}/"
success "Source sync complete"

# ─── 5. Build Docker image on VM ─────────────────────────────────────────────
info "Building Docker image on VM (this may take a few minutes) ..."
ssh "${VM_SSH}" "cd ${REMOTE_DIR} && sudo docker compose -f ${COMPOSE_FILE} build --no-cache"
success "Docker image built"

# ─── 6. Start / restart the container ────────────────────────────────────────
info "Bringing up container ..."
ssh "${VM_SSH}" "cd ${REMOTE_DIR} && sudo docker compose -f ${COMPOSE_FILE} up -d"
success "Container started"

# ─── 7. Health check ─────────────────────────────────────────────────────────
info "Waiting 10 s for the app to initialize ..."
sleep 10

info "Running health check ..."
if ssh "${VM_SSH}" "curl -sf http://localhost:3000 > /dev/null"; then
    success "Health check passed — app is responding on :3000"
else
    warn "Health check failed. Showing recent container logs:"
    ssh "${VM_SSH}" "sudo docker compose -f ${REMOTE_DIR}/${COMPOSE_FILE} logs --tail=50 pos-app" || true
    error "App may not have started correctly. Check logs above."
    exit 1
fi

# ─── 8. Show running containers ──────────────────────────────────────────────
info "Running containers on VM:"
ssh "${VM_SSH}" "sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo ""
success "Deployment complete. Visit https://soporte.lamarque.mx (or your configured subdomain/path)."
