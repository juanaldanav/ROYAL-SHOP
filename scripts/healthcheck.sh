#!/bin/bash
# healthcheck.sh — Verifica que todos los servicios del stack respondan
# Corre en la VM desde /opt/lighthouse-bot/
# Uso: ./scripts/healthcheck.sh

set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $*"; }
fail() { echo -e "${RED}✗${NC} $*"; FAILURES=$((FAILURES + 1)); }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }

FAILURES=0

echo "=== Lighthouse Bot Health Check ==="
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

# n8n
if curl -sf http://localhost:5678/healthz > /dev/null 2>&1; then
    ok "n8n (localhost:5678) — healthy"
else
    fail "n8n (localhost:5678) — NOT responding"
fi

# Evolution API
if curl -sf http://localhost:8001/ > /dev/null 2>&1; then
    ok "Evolution API (localhost:8001) — healthy"
else
    fail "Evolution API (localhost:8001) — NOT responding"
fi

# Chatwoot
if curl -sf http://localhost:3001 > /dev/null 2>&1; then
    ok "Chatwoot (localhost:3001) — healthy"
else
    fail "Chatwoot (localhost:3001) — NOT responding"
fi

# Booksy Executor
if curl -sf http://localhost:8002/health > /dev/null 2>&1; then
    ok "booksy-executor (localhost:8002) — healthy"
else
    fail "booksy-executor (localhost:8002) — NOT responding"
fi

# Postgres (via docker exec)
if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    ok "Postgres (docker) — ready"
else
    fail "Postgres (docker) — NOT ready"
fi

# Redis
if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
    ok "Redis (docker) — PONG"
else
    fail "Redis (docker) — NOT responding"
fi

# Caddy
if curl -sk https://localhost:9443/ -o /dev/null 2>&1; then
    ok "Caddy (0.0.0.0:9443) — responding"
else
    warn "Caddy HTTPS (9443) — not reachable or TLS self-signed (expected on first run)"
fi

# Critical pre-existing services
echo
echo "=== Pre-existing services (must stay active) ==="
for svc in apache2 mariadb tpeap; do
    if sudo systemctl is-active --quiet "$svc" 2>/dev/null; then
        ok "$svc — active"
    else
        fail "$svc — INACTIVE (CRITICAL)"
    fi
done

echo
if [ "$FAILURES" -eq 0 ]; then
    echo -e "${GREEN}All checks passed.${NC}"
else
    echo -e "${RED}${FAILURES} check(s) failed.${NC}"
    exit 1
fi
