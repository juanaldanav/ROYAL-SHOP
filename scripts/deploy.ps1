# deploy.ps1 — Sube el repo a la VM y ejecuta remote-bootstrap.sh
# Corre en local Windows desde D:\lighthouse bot\
# Uso: .\scripts\deploy.ps1 [-DryRun] [-SkipBootstrap]

param(
    [switch]$DryRun,
    [switch]$SkipBootstrap
)

$ErrorActionPreference = "Stop"

$VM_HOST = "soporte.lamarque.mx"
$VM_USER = "noreply"
$REMOTE_ROOT = "/opt/lighthouse-bot"
$LOCAL_ROOT = "D:\lighthouse bot"

function Log($msg)  { Write-Host "[deploy $(Get-Date -Format HH:mm:ss)] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[warn   $(Get-Date -Format HH:mm:ss)] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[FAIL   $(Get-Date -Format HH:mm:ss)] $msg" -ForegroundColor Red; exit 1 }

Log "Starting deploy to ${VM_USER}@${VM_HOST}:${REMOTE_ROOT}"

if ($DryRun) { Log "DRY RUN — no actual transfer" }

# ---------------------------------------------------------------------------
# 1. Verificar SSH
# ---------------------------------------------------------------------------
Log "Testing SSH connection..."
$sshTest = ssh "${VM_USER}@${VM_HOST}" "echo connected" 2>&1
if ($sshTest -notmatch "connected") {
    Fail "SSH connection failed: $sshTest"
}
Log "SSH OK ✓"

# ---------------------------------------------------------------------------
# 2. Crear /opt/lighthouse-bot en la VM si no existe
# ---------------------------------------------------------------------------
Log "Ensuring remote directory exists..."
if (-not $DryRun) {
    ssh "${VM_USER}@${VM_HOST}" "sudo mkdir -p ${REMOTE_ROOT} && sudo chown lighthouse:lighthouse ${REMOTE_ROOT} && sudo chmod 755 ${REMOTE_ROOT}" 2>&1
}

# ---------------------------------------------------------------------------
# 3. Transferir archivos via tar+ssh (excluye secretos y datos)
# ---------------------------------------------------------------------------
Log "Transferring files..."

# Construir lista de exclusiones para tar (PowerShell genera el comando)
$excludes = @(
    "--exclude=.env",
    "--exclude=.env.local",
    "--exclude=infra-snapshots",
    "--exclude=storage_state",
    "--exclude=*.log",
    "--exclude=__pycache__",
    "--exclude=node_modules",
    "--exclude=.git",
    "--exclude=night-*.log",
    "--exclude=PROJECT_CONTEXT.md"
)

if ($DryRun) {
    Log "Would transfer: $LOCAL_ROOT → ${VM_USER}@${VM_HOST}:${REMOTE_ROOT}"
    Log "Excludes: $($excludes -join ' ')"
} else {
    # Usar tar local + SSH (más portable que rsync en Windows)
    $tarCmd = "tar czf - $($excludes -join ' ') -C `"$LOCAL_ROOT`" . | ssh ${VM_USER}@${VM_HOST} `"sudo -u lighthouse tar xzf - -C ${REMOTE_ROOT}`""
    Log "Running tar+ssh transfer..."
    Invoke-Expression "& bash -c '$tarCmd'" 2>&1

    if ($LASTEXITCODE -ne 0) {
        Fail "Transfer failed with exit code $LASTEXITCODE"
    }
    Log "Transfer complete ✓"
}

# ---------------------------------------------------------------------------
# 4. Fix permissions
# ---------------------------------------------------------------------------
if (-not $DryRun) {
    Log "Setting permissions..."
    ssh "${VM_USER}@${VM_HOST}" "sudo chown -R lighthouse:lighthouse ${REMOTE_ROOT} && sudo chmod +x ${REMOTE_ROOT}/scripts/*.sh" 2>&1
}

# ---------------------------------------------------------------------------
# 5. Ejecutar remote-bootstrap.sh
# ---------------------------------------------------------------------------
if (-not $SkipBootstrap) {
    Log "Running remote-bootstrap.sh..."
    if (-not $DryRun) {
        ssh "${VM_USER}@${VM_HOST}" "bash ${REMOTE_ROOT}/scripts/remote-bootstrap.sh" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Fail "remote-bootstrap.sh failed — check output above"
        }
        Log "Bootstrap complete ✓"
    } else {
        Log "DRY RUN: would run remote-bootstrap.sh"
    }
} else {
    Warn "Skipping bootstrap (--SkipBootstrap flag)"
}

# ---------------------------------------------------------------------------
# 6. Verificar resultado
# ---------------------------------------------------------------------------
Log "Verifying deployment..."
$verify = ssh "${VM_USER}@${VM_HOST}" "ls -la ${REMOTE_ROOT}/ | head -20 && echo '---' && docker --version 2>/dev/null || echo 'docker not yet installed'" 2>&1
Write-Host $verify

Log "Deploy complete. Next steps:"
Log "  1. SSH to VM: ssh ${VM_USER}@${VM_HOST}"
Log "  2. sudo -i -u lighthouse"
Log "  3. cd ${REMOTE_ROOT}"
Log "  4. cp .env.example .env && nano .env  (fill credentials)"
Log "  5. docker compose up -d"
Log "  6. docker compose ps"
Log "  7. ./scripts/healthcheck.sh"
