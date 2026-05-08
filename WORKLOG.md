# WORKLOG — Lighthouse Bot Night Shift
<!-- Diario auditable de decisiones y eventos -->

## 2026-05-07T23:40 — Starting night shift

**Agente:** Claude Code (Sonnet 4.6 1M context)
**Misión:** Desplegar base del bot Lighthouse (WhatsApp → Booksy) en GCP VM soporte.lamarque.mx

**Plan de bloques:**
- Bloque 0: Pre-flight, inventario, Go/No-Go
- Bloque A: Repo local + estructura
- Bloque B: Docker Compose
- Bloque C: booksy-executor microservice
- Bloque D: Prompts Gemini
- Bloque E: Workflows n8n
- Bloque F: Scripts deploy + bootstrap remoto + ejecución
- Bloque G: Documentación ADRs + HANDOVER

---

## 2026-05-07T23:40 — Bloque 0: Pre-flight

### Hallazgo: .env.local ausente
`.env.local` no existía al arrancar. Decisión: crear con valores documentados en README (VM_HOST, VM_BOOTSTRAP_USER, VM_DEPLOY_USER son públicos en el brief). Campos BARBERSHOP_* dejados vacíos (no bloqueantes para deploy técnico). **Razón:** el agente tiene go para toda la noche y la conexión es viable sin el archivo.

### SSH validado
```
ssh noreply@soporte.lamarque.mx → connected (Linux omada-controller 6.8.0-1053-gcp)
```

### Herramientas locales
- Node.js: v22.18.0 ✅
- Git: 2.53.0.windows.1 ✅
- SSH: OpenSSH_10.2p1 ✅

### Inventario VM (2026-05-07T23:40)

**Recursos:**
- CPU: 2 vCPU (Intel Xeon @ 2.20GHz, KVM)
- RAM: 3.8 GiB total, 2.6 GiB disponibles, 4 GiB swap (776 MiB usado)
- Disco: 29 GB total, 14 GB libres (52% usado)
- OS: Ubuntu 22.04.5 LTS, kernel 6.8.0-1053-gcp

**Servicios activos confirmados (todos sanos):**
- apache2: running ✅ (Apache/2.4.52, :80/:443, VHost: soporte.lamarque.mx)
- apache-htcacheclean: running ✅
- mariadbd: running ✅ (MariaDB 10.6.23, 127.0.0.1:3306)
- tpeap: running ✅ (Omada Controller, :8043/:8088/:8843/:29811-29816)
- mongod: running ✅ (127.0.0.1:27217)
- google-cloud-ops-agent-fluent-bit: running ✅ (:20202)
- google-cloud-ops-agent-opentelemetry-collector: running ✅ (:20201)
- ssh: running ✅ (:22)

**Docker:** NO instalado ✅ (esperado)
**UFW:** inactive (firewall no configurado — se deja al humano)
**Cron root:** Job GLPI backup diario (mysqldump glpidb → /root/backups/) — NO TOCAR

**Hallazgo extra:** Existe app GLPI en LAMP (DB: glpidb, user: glpiuser). No estaba en el brief inicial pero es parte del LAMP existente. No la tocamos.

**Puertos Lighthouse verificados LIBRES:**
- 9080, 9443 (Caddy) ✅
- 5433 (Postgres) ✅
- 6380 (Redis) ✅
- 5678 (n8n) ✅
- 8001 (Evolution API) ✅
- 3001 (Chatwoot) ✅
- 8002 (booksy-executor) ✅

**Usuario lighthouse:**
- UID 1002, GID 1003 ✅
- sudoers configurado y validado ✅
- .ssh/authorized_keys presente (vacío, modo 600) ✅
- Grupo docker: NO existe (se crea al instalar Docker) ✅

### Decisión Go/No-Go: **GO** ✅
- SSH OK ✅
- RAM disponible: 2.6 GiB (>= 1.5 GiB requerido) ✅
- Disco libre: 14 GB (>= 8 GB requerido) ✅
- Puertos asignados: todos libres ✅
- Apache, MariaDB, Omada: todos active/running ✅

---

## 2026-05-07T23:45 — Bloque A: Repo local + estructura

Iniciando git init y creación de estructura de carpetas.

