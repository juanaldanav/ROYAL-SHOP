#!/usr/bin/env bash
# deploy-vm.sh — Build and deploy royaleshop to the GCP VM
# Usage: ./scripts/deploy-vm.sh
set -euo pipefail

VM_USER="noreply"
VM_HOST="soporte.lamarque.mx"
VM_SSH="${VM_USER}@${VM_HOST}"
# Opciones SSH globales — keepalive para builds largos, multiplexing para velocidad
SSH_OPTS="-o ServerAliveInterval=30 -o ServerAliveCountMax=20 -o ConnectTimeout=15"
REMOTE_DIR="/opt/royaleshop"
COMPOSE_FILE="docker-compose.prod.yml"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# 1. SSH check
info "Verificando conexión SSH a ${VM_SSH} ..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "${VM_SSH}" "echo ok" &>/dev/null; then
    error "No se puede conectar a ${VM_SSH}. Verifica SSH key / gcloud OS Login."
    exit 1
fi
success "SSH OK"

# 2. Directorio remoto
info "Preparando ${REMOTE_DIR} en VM ..."
ssh ${SSH_OPTS} "${VM_SSH}" "sudo mkdir -p ${REMOTE_DIR} && sudo chown \$(id -u):\$(id -g) ${REMOTE_DIR}"
success "Directorio listo"

# 3. .env — debe existir localmente
ENV_FILE="${REPO_ROOT}/royale-shop/.env"
if [ ! -f "${ENV_FILE}" ]; then
    error ".env no encontrado en ${ENV_FILE}"
    error "Copia royale-shop/.env.example a royale-shop/.env y llena las variables."
    exit 1
fi
info "Subiendo .env ..."
scp ${SSH_OPTS} "${ENV_FILE}" "${VM_SSH}:${REMOTE_DIR}/.env"
# En Linux Docker Compose, el host de postgres es el nombre del servicio (no host.docker.internal ni localhost)
ssh ${SSH_OPTS} "${VM_SSH}" "sed -i 's|@localhost:5432|@royaleshop-postgres:5432|g; s|@host.docker.internal:5432|@royaleshop-postgres:5432|g' ${REMOTE_DIR}/.env"
success ".env subido"

# 4. docker-compose.prod.yml
info "Subiendo ${COMPOSE_FILE} ..."
scp ${SSH_OPTS} "${REPO_ROOT}/${COMPOSE_FILE}" "${VM_SSH}:${REMOTE_DIR}/${COMPOSE_FILE}"
success "Compose subido"

# 5. Sync Next.js app (tar pipe — no rsync needed)
info "Sincronizando royale-shop/ ..."
ssh ${SSH_OPTS} "${VM_SSH}" "mkdir -p ${REMOTE_DIR}/royale-shop"
tar -czf - \
    --exclude='royale-shop/node_modules' \
    --exclude='royale-shop/.next' \
    --exclude='royale-shop/.git' \
    --exclude='royale-shop/.env' \
    --exclude='royale-shop/.env.local' \
    --exclude='royale-shop/.env.development' \
    --exclude='royale-shop/app/generated' \
    --exclude='royale-shop/*.log' \
    -C "${REPO_ROOT}" royale-shop \
    | ssh ${SSH_OPTS} "${VM_SSH}" "tar -xzf - -C ${REMOTE_DIR}"
success "royale-shop sincronizado"

# 6. Sync WhatsApp microservicio (opcional)
if [ -d "${REPO_ROOT}/services/whatsapp" ]; then
    info "Sincronizando services/whatsapp/ ..."
    ssh ${SSH_OPTS} "${VM_SSH}" "mkdir -p ${REMOTE_DIR}/services/whatsapp"
    tar -czf - \
        --exclude='services/whatsapp/node_modules' \
        --exclude='services/whatsapp/.wwebjs_auth' \
        --exclude='services/whatsapp/*.log' \
        -C "${REPO_ROOT}" services/whatsapp \
        | ssh ${SSH_OPTS} "${VM_SSH}" "tar -xzf - -C ${REMOTE_DIR}"
    success "whatsapp-svc sincronizado"
else
    warn "services/whatsapp/ no encontrado — omitiendo"
fi

# 7. Build en VM
info "Building imágenes Docker en VM ..."
ssh ${SSH_OPTS} "${VM_SSH}" "cd ${REMOTE_DIR} && sudo docker compose -f ${COMPOSE_FILE} build --no-cache"
success "Build completado"

# 8. Up
info "Levantando containers ..."
ssh ${SSH_OPTS} "${VM_SSH}" "cd ${REMOTE_DIR} && sudo docker compose -f ${COMPOSE_FILE} up -d"
success "Containers activos"

# 9. Migraciones de DB (idempotentes — IF NOT EXISTS)
info "Aplicando migraciones de BD ..."
ssh ${SSH_OPTS} "${VM_SSH}" "sudo docker exec royaleshop-postgres psql -U royale royaleshop -c \"
DO \\\$\\\$ BEGIN
  CREATE TYPE \\\"CashMovementType\\\" AS ENUM ('REFUND');
EXCEPTION WHEN duplicate_object THEN null;
END \\\$\\\$;

CREATE TABLE IF NOT EXISTS \\\"CashMovement\\\" (
  \\\"id\\\"              TEXT NOT NULL,
  \\\"tenantId\\\"        TEXT NOT NULL,
  \\\"branchId\\\"        TEXT NOT NULL,
  \\\"cashCutId\\\"       TEXT NOT NULL,
  \\\"type\\\"            \\\"CashMovementType\\\" NOT NULL,
  \\\"amount\\\"          DECIMAL(10,2) NOT NULL,
  \\\"description\\\"     TEXT NOT NULL,
  \\\"relatedSaleId\\\"   TEXT,
  \\\"authorizedById\\\"  TEXT NOT NULL,
  \\\"createdAt\\\"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT \\\"CashMovement_pkey\\\" PRIMARY KEY (\\\"id\\\")
);

CREATE INDEX IF NOT EXISTS \\\"CashMovement_tenantId_cashCutId_idx\\\" ON \\\"CashMovement\\\"(\\\"tenantId\\\", \\\"cashCutId\\\");

DO \\\$\\\$ BEGIN
  ALTER TABLE \\\"CashMovement\\\" ADD CONSTRAINT \\\"CashMovement_tenantId_fkey\\\" FOREIGN KEY (\\\"tenantId\\\") REFERENCES \\\"Tenant\\\"(\\\"id\\\") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN null;
END \\\$\\\$;
DO \\\$\\\$ BEGIN
  ALTER TABLE \\\"CashMovement\\\" ADD CONSTRAINT \\\"CashMovement_branchId_fkey\\\" FOREIGN KEY (\\\"branchId\\\") REFERENCES \\\"Branch\\\"(\\\"id\\\") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN null;
END \\\$\\\$;
DO \\\$\\\$ BEGIN
  ALTER TABLE \\\"CashMovement\\\" ADD CONSTRAINT \\\"CashMovement_cashCutId_fkey\\\" FOREIGN KEY (\\\"cashCutId\\\") REFERENCES \\\"CashCut\\\"(\\\"id\\\") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN null;
END \\\$\\\$;
DO \\\$\\\$ BEGIN
  ALTER TABLE \\\"CashMovement\\\" ADD CONSTRAINT \\\"CashMovement_relatedSaleId_fkey\\\" FOREIGN KEY (\\\"relatedSaleId\\\") REFERENCES \\\"Sale\\\"(\\\"id\\\") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END \\\$\\\$;
DO \\\$\\\$ BEGIN
  ALTER TABLE \\\"CashMovement\\\" ADD CONSTRAINT \\\"CashMovement_authorizedById_fkey\\\" FOREIGN KEY (\\\"authorizedById\\\") REFERENCES \\\"User\\\"(\\\"id\\\") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN null;
END \\\$\\\$;

ALTER TABLE \\\"CashCut\\\" ADD COLUMN IF NOT EXISTS \\\"expectedCard\\\"     DECIMAL(10,2);
ALTER TABLE \\\"CashCut\\\" ADD COLUMN IF NOT EXISTS \\\"countedCard\\\"      DECIMAL(10,2);
ALTER TABLE \\\"CashCut\\\" ADD COLUMN IF NOT EXISTS \\\"cardDifference\\\"   DECIMAL(10,2);
ALTER TABLE \\\"CashCut\\\" ADD COLUMN IF NOT EXISTS \\\"cuadreStatus\\\"     TEXT;
ALTER TABLE \\\"CashCut\\\" ADD COLUMN IF NOT EXISTS \\\"cardCuadreStatus\\\" TEXT;

CREATE TABLE IF NOT EXISTS \\\"UserBranch\\\" (
  \\\"userId\\\"   TEXT NOT NULL,
  \\\"branchId\\\" TEXT NOT NULL,
  CONSTRAINT \\\"UserBranch_pkey\\\" PRIMARY KEY (\\\"userId\\\", \\\"branchId\\\")
);
CREATE INDEX IF NOT EXISTS \\\"UserBranch_userId_idx\\\" ON \\\"UserBranch\\\"(\\\"userId\\\");
DO \\\$\\\$ BEGIN
  ALTER TABLE \\\"UserBranch\\\" ADD CONSTRAINT \\\"UserBranch_userId_fkey\\\" FOREIGN KEY (\\\"userId\\\") REFERENCES \\\"User\\\"(\\\"id\\\") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END \\\$\\\$;
DO \\\$\\\$ BEGIN
  ALTER TABLE \\\"UserBranch\\\" ADD CONSTRAINT \\\"UserBranch_branchId_fkey\\\" FOREIGN KEY (\\\"branchId\\\") REFERENCES \\\"Branch\\\"(\\\"id\\\") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END \\\$\\\$;
\""
success "Migraciones aplicadas"

# 10. Health check
info "Esperando 15s para health check ..."
sleep 15
if ssh ${SSH_OPTS} "${VM_SSH}" "curl -sf http://localhost:3000 > /dev/null"; then
    success "App respondiendo en :3000"
else
    warn "Health check falló. Logs recientes:"
    ssh ${SSH_OPTS} "${VM_SSH}" "sudo docker compose -f ${REMOTE_DIR}/${COMPOSE_FILE} logs --tail=60 pos-app" || true
    error "Revisa los logs arriba."
    exit 1
fi

# 10. Estado final
info "Containers corriendo:"
ssh ${SSH_OPTS} "${VM_SSH}" "sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo ""
success "Deploy completo — https://royalshop.lamarque.mx"
echo ""
warn "Si es el primer deploy de WhatsApp, escanea el QR:"
warn "  ssh ${VM_SSH} -L 3001:127.0.0.1:3001 'sleep 60'"
warn "  Abre http://localhost:3001/qr en tu navegador"
