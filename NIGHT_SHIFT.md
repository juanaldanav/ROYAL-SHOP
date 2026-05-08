# 🌙 NIGHT_SHIFT.md — Misión Autónoma "Lighthouse Bot"

## 0. CÓMO LEER ESTE DOCUMENTO

Este es tu único brief para la noche. Léelo entero antes de actuar.
Cuando termines de leerlo, **escribe en el chat un resumen de 5-10 líneas**
con: tu plan inicial, los riesgos que ves, y la primera acción concreta que
vas a tomar. Esa firma es tu "entendí la misión". Después ejecuta.

---

## 1. ROL Y MISIÓN

Eres un **Lead Architect Autónomo** trabajando en modo desatendido durante la
noche. El humano (tu cliente) está dormido y vuelve a las 7-8am hora Culiacán.
No puedes pedirle aprobaciones interactivas.

Tu trabajo es dejar la base de un bot de **WhatsApp para agendar citas en
Booksy** (plan básico ~600-700 MXN/mes — sin Partner API disponible) para una
**barbería con 2 sucursales en Culiacán, Sinaloa**.

Operas **dual-machine**:
- **Local (Windows):** `D:\lighthouse bot\` — repo, configs, prompts, secretos
  en `.env.local` (gitignored), `WORKLOG.md`.
- **Remoto (GCP VM Ubuntu 22.04, `soporte.lamarque.mx`):** vía SSH para
  inventariar, instalar dependencias y desplegar el stack Docker.

Decides y avanzas. Lo que requiera credenciales reales o decisiones de negocio
se difiere a `HANDOVER_MORNING.md`.

---

## 2. ESTADO REAL DEL SERVER (CONFIRMADO POR INVENTARIO PREVIO)

**No es una VM limpia.** Hay producción real corriendo. Esto NO es opinable:

### 2.1 Servicios activos que NO debes tocar

| Servicio | Puerto | Por qué importa |
|---|---|---|
| `apache2.service` | `*:80`, `*:443` | LAMP en producción sirviendo sitios reales |
| `apache-htcacheclean` | (n/a) | Subordinado de Apache |
| `mariadbd` | `127.0.0.1:3306` | DB del LAMP |
| `tpeap.service` (Omada Controller) | `*:8043`, `*:8088`, `*:8843`, `*:29811-29816` | Gestor de red TP-Link real |
| `mongod` (embebido en Omada) | `127.0.0.1:27217` | Storage del Omada (ojo: 27217, no 27017) |
| `sshd` | `*:22` | Tu único acceso |
| `systemd-resolved` | `127.0.0.53:53` | DNS del SO |
| `fluent-bit` | `*:20202` | Telemetría GCP — NO TOCAR |
| `otelopscol` | `*:20201` | Telemetría GCP — NO TOCAR |

### 2.2 Estado de preparación (ya hecho por el humano antes de tu turno)

- ✅ Usuario `lighthouse` existe (UID 1002, GID 1003, password definido)
- ✅ `/etc/sudoers.d/lighthouse` existe y validado, contiene:
  `lighthouse ALL=(ALL) NOPASSWD: /usr/bin/apt, /usr/bin/apt-get, /usr/bin/docker, /bin/systemctl, /usr/bin/systemctl, /usr/sbin/ufw, /usr/bin/tee`
- ✅ `/home/lighthouse/.ssh/authorized_keys` existe (vacío, modo 600, dueño lighthouse:lighthouse)
- ✅ `/home/lighthouse/.ssh/` directorio (modo 700, dueño lighthouse:lighthouse)
- ❌ Docker NO instalado — tú lo instalas
- ❌ El grupo `docker` NO existe — se crea al instalar Docker
- ❌ El stack Lighthouse NO desplegado — tú lo despliegas

### 2.3 Recursos disponibles

- **RAM:** 3.8 GiB total, ~2.5 GiB disponibles, swap 4 GiB (770 MiB usado)
- **Disco:** 29 GB total, 14 GB libres
- **CPU:** verifica con `nproc` en el Bloque 0 (probable e2-small/medium)
- **OS:** Ubuntu 22.04.5 LTS, kernel 6.8.0-1053-gcp
- **Aviso:** hay `*** System restart required ***` pendiente. **NO reinicies.**
  Eso lo decide el humano.

### 2.4 Conexión SSH

El humano usa **gcloud OS Login**. No hay llave estática local. La conexión a
`noreply@soporte.lamarque.mx` funciona sin password porque está autenticada vía
gcloud. Esto es importante: **tu único método de entrada al server es SSH como
`noreply`**. No intentes conectarte como `lighthouse` (su pubkey aún no está
configurada y no es necesario que lo esté).

Cuando necesites operar como `lighthouse` (para que archivos pertenezcan a ese
usuario), usa: `sudo -u lighthouse <comando>` o `sudo chown lighthouse:lighthouse <ruta>`.

---

## 3. MODO DE OPERACIÓN

Estás corriendo con `--dangerously-skip-permissions`. Puedes ejecutar comandos
sin confirmación. Eso te obliga a ser **extra cuidadoso**.

### 3.1 Reglas anti-desastre (no negociables)

**LOCAL — solo dentro de `D:\lighthouse bot\`.** Nada fuera. No instales paquetes
globales en Windows. No toques el registro. No modifiques el PATH del usuario.

**REMOTO — solo dentro de `/opt/lighthouse-bot/` y `/home/lighthouse/`.**
Excepciones permitidas con justificación documentada en WORKLOG.md:
- `apt install` de paquetes que necesites (docker, etc.)
- `systemctl` solo de servicios que TÚ creas
- Crear `/etc/docker/daemon.json` solo si es estrictamente necesario y dejando backup
- Configurar `ufw` (sin tumbar SSH; verifica que el puerto 22 sigue permitido
  ANTES de activar el firewall)

### 3.2 PROHIBIDO TOCAR

- ❌ `apache2.service`, `apache-htcacheclean.service`
- ❌ `/etc/apache2/`, `/var/www/`, cualquier site existente
- ❌ `mariadb.service`, `/etc/mysql/`, bases de datos MariaDB existentes
  (no `DROP`, no `CREATE` sobre ellas)
- ❌ `tpeap.service` (Omada Controller), `/opt/tplink/`, `/usr/lib/omada/`
- ❌ MongoDB del Omada (`127.0.0.1:27217`) — es de ellos
- ❌ `fluent-bit.service`, `otelopscol.service` — telemetría GCP
- ❌ Crontabs existentes (root, www-data, otros usuarios)
- ❌ `/etc/ssh/sshd_config` — no lo toques
- ❌ `/etc/resolv.conf`, `/etc/hosts` — no los toques
- ❌ Reiniciar la VM (hay `System restart required` pendiente, eso lo decide
  el humano en la mañana)

### 3.3 Puertos PROHIBIDOS (ya en uso)

`22, 53, 80, 443, 3306, 8043, 8088, 8843, 20201, 20202, 27217, 29811-29816`

### 3.4 Puertos asignados al stack Lighthouse

Verifica en Bloque 0 que sigan libres. Si alguno chocó, reasigna y documenta.

| Servicio | Bind | Puerto |
|---|---|---|
| Caddy HTTP | `0.0.0.0` | `9080` |
| Caddy HTTPS | `0.0.0.0` | `9443` |
| n8n | `127.0.0.1` | `5678` |
| Postgres | `127.0.0.1` | `5433` |
| Redis | `127.0.0.1` | `6380` |
| Evolution API | `127.0.0.1` | `8001` |
| Chatwoot | `127.0.0.1` | `3001` |
| booksy-executor | `127.0.0.1` | `8002` |

> **Caddy es el único expuesto a `0.0.0.0`** pero solo en puertos altos. La
> exposición pública vía 80/443 se difiere al humano (opción A: Apache reverse
> proxy a Caddy:9080 vía nuevo VirtualHost).

### 3.5 Otras reglas

- NO commitees secretos. `.env` real → gitignored.
- NO uses imágenes Docker `:latest`. Versiones pinneadas siempre.
- Si algo falla → `PROTOCOLO DE AUTORRECUPERACIÓN` (Sección 9). Tres intentos
  máximo por problema; después marca BLOQUEADO y sigue.
- **Logging obligatorio:** `WORKLOG.md` con cada decisión arquitectónica
  significativa, timestamp ISO, razón. Es tu diario auditable.

---

## 4. CONTEXTO DEL PROYECTO

**Negocio:** Barbería con 2 sucursales en Culiacán. Cliente final manda WhatsApp
para agendar/reagendar/cancelar citas. Bot debe parecer humano local
(sinaloense, sin caricatura), agendar en Booksy automáticamente, escalar a
humano cuando se complique.

**Plan Booksy:** ~600-700 MXN/mes, sin Partner API. Por lo tanto, el ejecutor
**obligatoriamente usa Playwright con persistent context y stealth**. Decisión
cerrada, no la cuestiones. Documenta en `docs/ADR-001-booksy-strategy.md`.

**Stack:**
- **Orquestador:** n8n (open source, self-hosted)
- **WhatsApp gateway:** Evolution API
- **Bandeja humana:** Chatwoot
- **LLM default:** `gemini-2.5-flash-lite` vía Google AI Studio API. NO uses
  1.5 Flash (deprecado por Google). Modelo configurable vía `GEMINI_MODEL`.
- **Ejecutor Booksy:** microservicio Python con FastAPI + Playwright
  (persistent context, stealth, fallback de selectores en cascada).
- **Cache/estado:** Redis 7
- **Base de datos:** Postgres 16 con schemas separados para n8n y Chatwoot.
  **NO uses MariaDB del LAMP**, monta tu propio Postgres en Docker.
- **Reverse proxy:** Caddy 2 escuchando en puertos altos (9080/9443).
- **Observabilidad:** Loki + Grafana en perfil opcional `--profile observability`.
  **No la actives por default** (RAM limitada).

---

## 5. ESTRUCTURA DE ENTREGABLES

```
D:\lighthouse bot\                          (LOCAL — repo principal)
├── NIGHT_SHIFT.md                          (este archivo)
├── README.md                               (ya existe, no lo modifiques)
├── PRE_FLIGHT.md                           (ya existe, no lo modifiques)
├── WORKLOG.md                              (tu diario nocturno — LO CREAS)
├── HANDOVER_MORNING.md                     (entregable final — LO CREAS)
├── INFRA_REPORT.md                         (del Bloque 0 — LO CREAS)
├── infra-snapshots/<timestamp>/            (raw outputs del inventario)
├── .gitignore
├── .env.local                              (ya existe, NO lo toques ni lo committees)
├── .env.example                            (placeholders documentados)
├── docker-compose.yml
├── docker-compose.observability.yml
├── Caddyfile
├── postgres/init/01-create-databases.sh
├── n8n/workflows/
│   ├── 01-whatsapp-inbound.json
│   ├── 02-intent-router.json
│   ├── 03-booking-flow.json
│   └── 04-human-handoff.json
├── booksy-executor/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── README.md
│   ├── src/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── api/{routes.py, schemas.py}
│   │   ├── booksy/{browser.py, selectors.py, login.py, booking.py, availability.py, exceptions.py}
│   │   ├── circuit_breaker.py
│   │   └── observability/{logger.py, snapshots.py}
│   └── tests/test_health.py
├── prompts/
│   ├── system_prompt_humanizer.md
│   ├── intent_classifier.md
│   ├── refusal_templates.md
│   └── README.md
├── docs/
│   ├── ADR-001-booksy-strategy.md
│   ├── ADR-002-gemini-cost-controls.md
│   ├── ADR-003-redis-as-state-store.md
│   ├── ADR-004-port-and-coexistence-strategy.md
│   ├── ARCHITECTURE.md                     (mermaid del flujo)
│   ├── RUNBOOK.md
│   └── COST_MODEL.md
├── scripts/
│   ├── deploy.ps1                          (PowerShell, sube todo a la VM)
│   ├── remote-bootstrap.sh                 (corre en la VM, idempotente)
│   ├── backup.sh
│   ├── restore.sh
│   └── healthcheck.sh
└── ssh-config-snippet.txt                  (para que el humano lo use opcionalmente)

EN LA VM (cuando termines el deploy):
/opt/lighthouse-bot/                        (clon del repo, sin .env real al inicio)
├── docker-compose.yml
├── ... (mismo árbol)
└── .env                                    (lo crea el humano en la mañana)
```

---

## 6. ORDEN DE EJECUCIÓN (PRIORIDAD ESTRICTA)

**No saltes adelante sin que el bloque actual esté funcional.** Si te atoras,
marca BLOQUEADO en `HANDOVER_MORNING.md` y sigue.

### Bloque 0 — Pre-flight (READ-ONLY primero, después setup idempotente)

#### 6.0.1 Validar tu propio entorno local

```powershell
# Estos los corres en PowerShell vía tu interfaz de Claude Code
node --version
git --version
ssh -V
```

Lee `.env.local` en `D:\lighthouse bot\`. Extrae `VM_HOST`, `VM_BOOTSTRAP_USER`,
`VM_DEPLOY_USER`. Si el archivo no existe o falta alguna variable, **detente
ahí** y genera un `HANDOVER_MORNING.md` mínimo explicando qué falta.

#### 6.0.2 Validar conexión SSH inicial

```powershell
ssh noreply@soporte.lamarque.mx "echo connected && uname -a && whoami"
```

Si falla: NO procedas. Documenta el error exacto en `HANDOVER_MORNING.md` con
sección "🔴 BLOQUEANTE: SSH no funciona" y termina la sesión limpiamente.

#### 6.0.3 Inventario remoto (READ-ONLY — NO instales nada todavía)

Crea `D:\lighthouse bot\infra-snapshots\<YYYY-MM-DD-HHMM>\` y guarda outputs:

```powershell
$ts = Get-Date -Format "yyyy-MM-dd-HHmm"
$snapDir = "D:\lighthouse bot\infra-snapshots\$ts"
New-Item -ItemType Directory -Force -Path $snapDir | Out-Null
```

Ejecuta vía SSH y guarda cada uno (puedes usar `ssh ... > file` o capturar):

```bash
# Desde la VM (a través de SSH desde local):
uname -a; lsb_release -a 2>/dev/null; cat /etc/os-release      # > os.txt
free -h; df -h; nproc; lscpu | head -20                         # > resources.txt
systemctl list-units --type=service --state=running             # > services.txt
sudo ss -tulpn                                                   # > ports.txt
which apachectl httpd; apachectl -v 2>/dev/null;
  sudo apachectl -S 2>/dev/null                                  # > apache.txt
mysql --version; systemctl status mariadb 2>/dev/null            # > mariadb.txt
systemctl status tpeap 2>/dev/null                               # > omada.txt
which docker; docker --version 2>/dev/null;
  docker ps -a 2>/dev/null; docker images 2>/dev/null            # > docker-status.txt
sudo ufw status verbose 2>/dev/null ||
  sudo iptables -L -n 2>/dev/null                                # > firewall.txt
sudo crontab -l 2>/dev/null; crontab -l 2>/dev/null              # > cron.txt
ls -la /opt/                                                     # > opt-listing.txt
id lighthouse                                                    # > user-lighthouse.txt
sudo cat /etc/sudoers.d/lighthouse 2>/dev/null                   # > sudoers-lighthouse.txt
sudo ls -la /home/lighthouse/.ssh/ 2>/dev/null                   # > ssh-lighthouse.txt
getent group docker 2>/dev/null || echo "no docker group"        # > docker-group.txt
```

#### 6.0.4 Generar `INFRA_REPORT.md`

Con base en los outputs anteriores, genera el reporte resumido en
`D:\lighthouse bot\INFRA_REPORT.md`. Estructura:

```markdown
# Infra Report — <timestamp>

## VM Specs
- OS: Ubuntu 22.04.5 LTS (kernel 6.8.0-1053-gcp)
- vCPU: ...
- RAM: 3.8 GiB total, X disponibles
- Disco: X GB libres de 29 GB
- Swap: ...

## Stack actual confirmado
- Apache 2: versión X, escuchando en :80, :443
- MariaDB: versión X, en 127.0.0.1:3306, con N DBs (no listadas por respeto)
- Omada Controller (tpeap): activo, puertos 8043, 8088, 8843, 29811-29816
- MongoDB de Omada: 127.0.0.1:27217
- Telemetría GCP: fluent-bit (:20202), otelopscol (:20201)
- Docker: [presente/ausente]

## Puertos en uso (lista exacta)
[copia de ports.txt resumida]

## Puertos asignados al stack Lighthouse (verificados libres)
- 9080 → Caddy HTTP
- 9443 → Caddy HTTPS
- 5433 → Postgres (loopback)
- 6380 → Redis (loopback)
- 5678 → n8n (loopback)
- 8001 → Evolution API (loopback)
- 3001 → Chatwoot (loopback)
- 8002 → booksy-executor (loopback)

## Estado del usuario lighthouse
- Existe: SÍ
- Sudoers: validado
- .ssh/authorized_keys: presente, [vacío/poblado]
- En grupo docker: [SÍ/NO — depende de si Docker está instalado]

## Recursos vs demanda esperada
- Stack mínimo proyectado: ~2-2.5 GiB RAM en pico
- Margen de seguridad: ✅/⚠️/❌

## Riesgos detectados
- [Lista honesta]

## Decisión de coexistencia con LAMP + Omada
- Apache se queda en 80/443 sirviendo lo que ya sirve
- Omada se queda en sus puertos
- Caddy del stack solo escucha en 9080/9443 (NO compite)
- Exposición pública: se difiere al humano, opciones documentadas en
  ADR-004
```

#### 6.0.5 Decisión Go/No-Go

- **GO** si: SSH OK, RAM disponible >= 1.5 GiB, disco libre >= 8 GB, todos los
  puertos asignados están libres, Apache y Omada saludables.
- **NO-GO** si falla cualquiera. Genera `HANDOVER_MORNING.md` mínimo y termina.

#### 6.0.6 Setup idempotente del usuario lighthouse

Verifica el estado de cada item. Si ya existe, NO lo rehagas. Si falta, créalo:

```bash
# Verificar y completar (ejemplos, adáptalos):
id lighthouse || sudo adduser --disabled-password --gecos "" lighthouse
[ -f /etc/sudoers.d/lighthouse ] || sudo tee /etc/sudoers.d/lighthouse <<'EOF'
lighthouse ALL=(ALL) NOPASSWD: /usr/bin/apt, /usr/bin/apt-get, /usr/bin/docker, /bin/systemctl, /usr/bin/systemctl, /usr/sbin/ufw, /usr/bin/tee
EOF
sudo chmod 440 /etc/sudoers.d/lighthouse
sudo visudo -c -f /etc/sudoers.d/lighthouse  # debe responder "parsed OK"
```

> **No subas pubkey al `authorized_keys` de lighthouse.** No es necesario; tu
> conexión va siempre por `noreply` y operas como lighthouse vía `sudo -u`.

---

### Bloque A — Repo local + estructura

1. `cd "D:\lighthouse bot"`, `git init` si no existe.
2. Crear `.gitignore` con: `.env`, `.env.local`, `infra-snapshots/`,
   `storage_state/`, `**/data/`, `**/storage/`, `*.log`, `secrets/`,
   `night-*.log`, `__pycache__/`, `node_modules/`, `*.tmp`.
3. Crear toda la estructura de carpetas (vacía con `.gitkeep` o `README` placeholder).
4. Crear `.env.example` con TODAS las variables documentadas en línea
   (qué es, dónde se obtiene, formato esperado).
5. Primer commit: `chore: initial project structure with infra report`.

---

### Bloque B — Docker Compose (sin desplegar todavía)

1. `docker-compose.yml` con: postgres, redis, evolution-api, n8n, chatwoot,
   caddy, booksy-executor.
   - Healthchecks reales en cada uno.
   - `restart: unless-stopped`.
   - Red nombrada `lighthouse-net` interna.
   - Volúmenes nombrados con prefix `lighthouse_`.
   - **Bind a 127.0.0.1** en host ports para todos excepto Caddy (9080/9443).
   - **Versiones pinneadas** (busca las estables actuales; documenta en WORKLOG.md).
   - **Resource limits** por servicio (RAM apretada en la VM):
     - postgres: mem_limit 256m
     - redis: mem_limit 128m
     - n8n: mem_limit 512m
     - evolution-api: mem_limit 512m
     - chatwoot: mem_limit 768m (web + sidekiq combinados o separados pero limitados)
     - caddy: mem_limit 64m
     - booksy-executor: mem_limit 768m (Playwright es pesado)
   - Ajusta `shared_buffers=128MB` en Postgres vía command o config montado.

2. `Caddyfile` con sites para n8n, Chatwoot, Evolution UI, todos en 9080/9443.
   **TLS interno (auto-generated CA) por ahora**, no Let's Encrypt — el
   dominio público no está enrutado todavía.

3. `postgres/init/01-create-databases.sh`: crea DBs `n8n_db` y `chatwoot_db`
   con users separados (`n8n_user`, `chatwoot_user`). Idempotente.

4. Validar localmente: `docker compose config` debe pasar sin errores.
   **NO hagas `docker compose up` en local Windows** — desplegamos a la VM.

5. Commit: `feat: docker compose stack with port isolation and resource limits`.

---

### Bloque C — Microservicio booksy-executor

1. Estructura Python con `uv` (preferido). Python 3.12.
2. `Dockerfile` multi-stage basado en imagen oficial de Playwright Python
   (busca versión estable; documenta).
3. FastAPI con endpoints funcionales pero stubbeados:
   - `GET /health` → 200 si browser está vivo
   - `GET /availability?location=X&service=Y&from=ISO&to=ISO` → estructura
     realista pero `{"status": "not_implemented", "reason": "awaiting_selectors"}`
   - `POST /book`, `POST /reschedule`, `POST /cancel` → mismo patrón
4. **Browser singleton** (`browser.py`) con persistent context por sucursal,
   lazy-init, mutex, recuperación de sesión.
5. **Selectors module** con cascada de fallback (data-testid → role+name →
   text → CSS). Función `find_with_fallback(page, element_key)`. Llena con
   TODOs — el humano completa selectores reales en la mañana.
6. **Circuit breaker:** 3 fallos en 60s → OPEN 5min → 503.
7. **Snapshot on failure:** screenshot + `page.content()` + URL en
   `storage_state/failures/<timestamp>/`.
8. Logging estructurado JSON con `structlog`.
9. Tests smoke con pytest (mockean Playwright). **Deben pasar**.
10. Commit: `feat(booksy-executor): scaffold with playwright stealth and circuit breaker`.

---

### Bloque D — Prompts de Gemini

Crea los archivos en `prompts/`:

1. **`system_prompt_humanizer.md`** (el grande):
   - Persona: barbera de Culiacán, 28 años. Cálida pero profesional.
     Sinaloense real (sin caricatura).
   - Vocabulario permitido (mande, qué tal, va, ándele, claro que sí, sale).
     PROHIBIDO: regionalismos exagerados, slang vulgar, anglicismos forzados.
   - Longitud: máximo 2 oraciones por respuesta.
   - **Topic guardrail:** lista explícita de temas permitidos (citas, servicios,
     precios, ubicaciones, horarios). Bloqueo duro para todo lo demás con
     respuesta canned tipo "Solo te puedo apoyar con lo de citas, ¿agendamos?".
   - No-alucinación: si no tiene un dato, dice "déjame checar" y dispara tool
     call. NO inventa.
   - Output format: JSON estructurado con campos `text`, `intent`,
     `requires_tool`, `tool_args`.
   - Mínimo 8 few-shot examples diversos.

2. **`intent_classifier.md`**: prompt corto (<150 tokens) que clasifica en
   `[book, reschedule, cancel, info, off_topic, human_handoff, ambiguous]`.
   Output máx 5 tokens.

3. **`refusal_templates.md`**: 5-8 respuestas canned naturales en español
   sinaloense (off-topic, fuera de horario, error técnico, escalación a
   humano, despedida).

4. **`prompts/README.md`**: cómo se conectan en n8n.

5. Commit: `feat(prompts): humanizer + intent classifier + refusal templates`.

---

### Bloque E — Workflows n8n (esqueletos importables)

JSONs que abran sin error en n8n aunque algunos nodos sean placeholder:

1. `01-whatsapp-inbound.json`: webhook Evolution → dedup Redis (key
   `msg:<id>`, TTL 1h) → rate limit por número (Redis INCR + TTL) → push al
   router.
2. `02-intent-router.json`: pre-filtro determinista (regex/keywords) → si no
   matchea, llama Gemini con `intent_classifier.md` → switch por intent.
3. `03-booking-flow.json`: state machine conversacional → llama
   `booksy-executor` para availability/book → confirmación → guarda contexto
   en Redis (key `conv:<phone>`, TTL 24h).
4. `04-human-handoff.json`: crea/actualiza conversación en Chatwoot, marca
   número como "humano" en Redis (TTL 2h).

Commit: `feat(n8n): workflow scaffolds with redis dedup and rate limiting`.

---

### Bloque F — Scripts de despliegue y bootstrap remoto

1. **`scripts/remote-bootstrap.sh`** (corre en la VM, idempotente):
   - Detecta si Docker ya está instalado; si no, instala docker-ce y
     docker-compose-plugin desde el repo oficial.
   - Agrega `lighthouse` al grupo `docker`.
   - Verifica que los puertos planeados sigan libres (vuelve a checar, no asuma).
   - Crea `/opt/lighthouse-bot/` si no existe; dueño `lighthouse:lighthouse`,
     modo 755.
   - **NO arranca docker compose todavía** — eso lo hace el humano después de
     llenar `.env`.
   - **NO toca apache, mariadb, omada, telemetría.**
   - **NO activa ufw** (lo deja para el humano por riesgo de tumbar SSH).

2. **`scripts/deploy.ps1`** (corre en local Windows):
   - rsync-like (vía `scp -r` o `tar | ssh tar`) del repo a `/opt/lighthouse-bot/`.
   - Excluye `.env*`, `infra-snapshots/`, `storage_state/`, `*.log`,
     `node_modules/`, `__pycache__/`, `.git/`.
   - Llama `remote-bootstrap.sh` por SSH.
   - Reporta status final.

3. **`scripts/healthcheck.sh`**: hace `curl -f` a cada healthcheck endpoint
   en loopback de la VM, reporta lo vivo/muerto.

4. **`scripts/backup.sh` y `scripts/restore.sh`**: dumps de Postgres del stack
   (no del MariaDB del LAMP), tar de volúmenes a `/backups/`. Probados en
   dry-run.

5. **EJECUTA `deploy.ps1`** para subir el repo a la VM. Verifica con SSH que
   `/opt/lighthouse-bot/` existe y tiene los archivos.

6. **EJECUTA `remote-bootstrap.sh` por SSH.** Verifica que Docker quedó instalado
   y que los puertos están libres.

7. **NO ejecutes `docker compose up`.** Eso lo hace el humano después de
   llenar `.env`.

8. **Verificación post-bootstrap CRÍTICA:**
   ```bash
   sudo systemctl status apache2 mariadb tpeap fluent-bit otelopscol
   ```
   Todos deben seguir `active (running)`. Si alguno cambió, **REVERTIR** lo
   que hayas hecho desde el último commit, documentar incidente en
   HANDOVER_MORNING.md sección "🚨 INCIDENTE", terminar.

9. Commit final: `feat: deployment scripts and bootstrap idempotente`.

---

### Bloque G — Documentación

1. `docs/ADR-001-booksy-strategy.md`: justifica Playwright vs reverse engineering.
2. `docs/ADR-002-gemini-cost-controls.md`: documenta las 4 capas de control.
3. `docs/ADR-003-redis-as-state-store.md`: qué keys vives en Redis con TTLs.
4. `docs/ADR-004-port-and-coexistence-strategy.md`:
   - Tu decisión de puertos altos (9080/9443).
   - Tres opciones de exposición pública para el humano:
     - **Opción A (recomendada):** Apache reverse-proxy a Caddy:9080 vía nuevo
       VirtualHost en un subdominio (ej. `bot.lamarque.mx`). Sin tocar el
       Apache existente, solo agregar un site nuevo.
     - **Opción B:** Cloudflare Tunnel (no toca Apache, sale por afuera).
     - **Opción C:** Mover Caddy a 80/443 (requiere apagar Apache → NO
       recomendado, ya hay producción ahí).
5. `docs/ARCHITECTURE.md`: diagrama mermaid del flujo end-to-end.
6. `docs/RUNBOOK.md`: qué hacer cuando: Evolution pierde sesión, Booksy cambia
   selector, Gemini se dispara en costo, número WhatsApp baneado, conflicto
   con Apache/Omada.
7. `docs/COST_MODEL.md`: proyección mensual con números (1k conv/día,
   5 msg promedio, Gemini 2.5 Flash-Lite a $0.10/$0.40 per 1M tokens, costo
   VM, storage). Total estimado.
8. Commit: `docs: ADRs, architecture, runbook, cost model`.

---

## 7. CONSTRAINTS TÉCNICOS

- Idioma del producto final: español sinaloense. Código y commits en inglés.
- Modelo Gemini default: `gemini-2.5-flash-lite`. Configurable.
- Token caps codificados (no solo en prompt):
  - 4,000 tokens acumulados por número/24h
  - 10 mensajes por número/minuto (rate limit en Redis)
  - Window conversacional: últimos 6 turnos
  - Tripwire off-topic: 3 strikes → silencio 1h
- Zona horaria: BD en UTC, conversión a `America/Mazatlan` solo en
  presentación.
- Lock distribuido en Redis para Booksy: key `booksy:lock:<location>`, TTL 30s.
- Imágenes Docker con versión pinneada.
- Resource limits codificados en docker-compose por la RAM apretada.

---

## 8. FAIL-SAFES PROACTIVOS DURANTE LA NOCHE

Cada **2 commits significativos** o cada **45 minutos** (lo que ocurra
primero), corre esta verificación rápida desde local vía SSH:

```bash
ssh noreply@soporte.lamarque.mx "sudo systemctl is-active apache2 mariadb tpeap fluent-bit otelopscol"
```

Esperado: 5 líneas con `active`. Si alguna dice `failed` o `inactive`:
- **DETÉN** todo trabajo nuevo.
- Identifica qué commit lo causó (`git log` reciente).
- Revierte ese commit y reaplica los cambios remotos sin ese diff.
- Documenta en `WORKLOG.md` y en sección 🚨 INCIDENTE de `HANDOVER_MORNING.md`.

También monitorea:

```bash
ssh noreply@soporte.lamarque.mx "df -h / | tail -1; free -h | grep Mem"
```

Si disco libre baja de 4 GB o RAM disponible baja de 500 MB, **DETENTE** y
documenta. No sigas instalando.

---

## 9. PROTOCOLO DE AUTORRECUPERACIÓN

Cuando algo falle (y va a fallar):

1. **Captura el error completo** + comando que lo causó + últimas 50 líneas de
   log relevantes en `WORKLOG.md`.
2. **Genera 2-3 hipótesis** ordenadas por probabilidad. Pruébalas.
3. **Búsqueda:** docs oficiales primero (n8n, Evolution API, Chatwoot,
   Playwright, Gemini, Caddy, Docker). Web search si necesario. Stack Overflow
   último recurso.
4. **Slash commands disponibles** (si aplican en tu instalación):
   - `/diagnose` — para servicios Docker que no levantan o crashean.
   - `/grill-with.docs` — para profundizar en docs cuando una hipótesis no
     aclara el problema.
   - `/humanizer` — solo aplica al refinamiento del system prompt de Gemini.
5. **Fix con commit atómico** que explique qué falló y por qué la solución
   funciona.
6. **3 intentos máximo.** Si no resuelves: marca el bloque como BLOQUEADO en
   `HANDOVER_MORNING.md`, documenta lo intentado, pasa al siguiente bloque.

**Errores específicos esperables:**

- **SSH falla** → revisa que `gcloud auth` siga válido en local. Si no
  resuelves: bloqueante crítico, documenta y termina.
- **`docker compose config` falla** → typo de YAML, sintaxis de healthcheck,
  referencias a archivos faltantes.
- **Imagen Docker no descarga** → mirror caído o tag inexistente. Prueba
  versión inmediata anterior. Documenta versión final usada.
- **Conflicto de puertos en VM** → vuelve a `ss -tulpn`, encuentra otro libre,
  actualiza `docker-compose.yml`, `Caddyfile`, `INFRA_REPORT.md`.
- **Apache/MariaDB/Omada se degrada** → **REVERTIR INMEDIATAMENTE**, restaurar
  config desde backup, documentar incidente en `HANDOVER_MORNING.md` con
  prioridad 🚨. Termina la sesión.
- **`apt` falla con lock** → algún auto-update corriendo. Espera 30s, reintenta.
  Si persiste, documenta y sigue con otro bloque.

---

## 10. CONDICIONES DE PARO

Detente y salta a generar `HANDOVER_MORNING.md` si:

- SSH no funciona después de 2 intentos de fix.
- RAM disponible en la VM baja de 500 MiB.
- Disco libre baja de 4 GB.
- Apache, MariaDB u Omada cambian a `failed` o `inactive`.
- 3 bloques distintos quedaron BLOQUEADOS.
- Has avanzado >6 horas reales y no llegaste al Bloque C.
- Espacio en disco LOCAL baja del 15%.
- Detectas que necesitas modificar algo fuera de `/opt/lighthouse-bot/` que no
  sea trivial (ej. firewall GCP, SSH config global).

---

## 11. ENTREGABLE FINAL: `HANDOVER_MORNING.md`

Lo PRIMERO que el humano lee. Estructura obligatoria:

```markdown
# 🌅 HANDOVER — <fecha>

[SI HUBO INCIDENTE: empieza con sección 🚨 INCIDENTE explicando qué pasó,
qué se rompió, cómo lo revertiste, y qué debe verificar el humano AHORA.]

## TL;DR
- Estado general: 🟢/🟡/🔴
- Bloques completados: ...
- Bloques bloqueados: ...
- Tiempo total trabajado: X horas
- ⚠️ Servicios pre-existentes (Apache/MariaDB/Omada): [todos sanos / lista de incidentes]

## ✅ Lo que ya funciona (verificable)
- Repo local en D:\lighthouse bot\ con N commits, todo committeado
- Estructura de archivos completa
- Docker compose validado (`docker compose config` pasa)
- VM tiene Docker instalado (versión X)
- /opt/lighthouse-bot/ creado con repo desplegado, dueño lighthouse:lighthouse
- [comandos exactos de verificación para cada bullet]

## 🔴 CRÍTICO — hacer primero (sin esto el bot no arranca)

### 1. Llenar `.env` con credenciales reales
Copia `.env.example` a `.env` en `/opt/lighthouse-bot/` (en la VM, vía SSH).
Variables a llenar (tabla completa):

| Variable | Dónde se obtiene | Formato ejemplo |
|---|---|---|
| GEMINI_API_KEY | https://aistudio.google.com/apikey | AIza... |
| EVOLUTION_API_KEY | autogenerada al primer arranque, ver logs | uuid |
| POSTGRES_PASSWORD | inventa una fuerte | 32 chars |
| N8N_BASIC_AUTH_PASSWORD | inventa | 24 chars |
| CHATWOOT_SECRET_KEY_BASE | `openssl rand -hex 64` | hex de 128 chars |
| BOOKSY_USERNAME_SUC1 | tu cuenta de dueño | email |
| BOOKSY_PASSWORD_SUC1 | tu password | string |
| BOOKSY_USERNAME_SUC2 | igual | email |
| BOOKSY_PASSWORD_SUC2 | igual | string |
| ... | ... | ... |

### 2. Levantar el stack
```bash
ssh noreply@soporte.lamarque.mx
sudo -i -u lighthouse  # o trabajar con sudo si prefieres
cd /opt/lighthouse-bot
docker compose up -d
docker compose ps  # confirma todos "healthy"
./scripts/healthcheck.sh
```

### 3. Generar QR de Evolution API y parear WhatsApp
[Pasos exactos: abrir túnel SSH `ssh -L 8001:localhost:8001 noreply@soporte.lamarque.mx`,
abrir http://localhost:8001 en navegador, click Connect, escanear con
WhatsApp Business del número X.]

### 4. Sacar selectores reales de Booksy
Abre Booksy logueado como dueño en un navegador. Para cada elemento listado
abajo, inspecciona y copia el selector más estable. Pégalos en
`/opt/lighthouse-bot/booksy-executor/src/booksy/selectors.py`:
- Botón "Nuevo cliente" → ...
- Campo de búsqueda de servicio → ...
- Selector de fecha → ...
- Selector de hora → ...
- Botón confirmar → ...
[Lista completa con captura de pantalla esperada]

### 5. Generar storage_state inicial de Playwright
[Comando exacto que el humano corre para que Playwright haga login una vez y
guarde la sesión por sucursal]

### 6. Decidir exposición pública
Lee `docs/ADR-004-port-and-coexistence-strategy.md`. Tres opciones:
- **A (recomendada):** Apache reverse-proxy a Caddy:9080 vía nuevo VirtualHost
- **B:** Cloudflare Tunnel
- **C:** Mover Caddy a 80/443 (no recomendado, tira Apache)

## 🟡 Importante (esta semana)
1. Configurar backups automáticos (cron del `scripts/backup.sh`)
2. Importar workflows JSON en n8n (instrucciones en `n8n/workflows/README.md`)
3. Revisar y ajustar `prompts/system_prompt_humanizer.md` (tono final)
4. Decidir cuándo aplicar el "System restart required" pendiente de la VM
5. Habilitar `usermod -aG docker lighthouse` (lo dejé pendiente para que tú
   apruebes — afecta privilegios)

## 🟢 Nice-to-have
1. Activar perfil de observabilidad: `docker compose --profile observability up -d`
   (cuidado con la RAM)
2. Configurar alertas a Telegram/email
3. Snapshot semanal automatizado de la VM en GCP

## 🧠 Decisiones que tomé sin tu aprobación (revisa)
- [Cada decisión arquitectónica significativa con link al ADR o entrada
  del WORKLOG]

## ❌ Cosas que intenté y no funcionaron
- [Diagnóstico honesto de cada fracaso]

## 📊 Costo proyectado mensual
[Resumen de COST_MODEL.md: VM + Gemini + storage = $X USD/mes estimado]

## 🔍 Comandos rápidos para auditar mi noche
```bash
# En local
cd "D:\lighthouse bot"
git log --oneline
cat WORKLOG.md
cat INFRA_REPORT.md

# En remoto
ssh noreply@soporte.lamarque.mx
ls /opt/lighthouse-bot/
docker ps -a
sudo systemctl status apache2 mariadb tpeap  # verifica que sigue OK
```
```

---

## 12. EMPIEZA AHORA

1. Lee este documento entero. Si hay contradicción, prioriza:
   **no romper lo existente (Apache/MariaDB/Omada) > seguridad > correctness > completeness > velocidad**.
2. Escribe el resumen de 5-10 líneas como firma de comprensión (Sección 0).
3. Crea `D:\lighthouse bot\WORKLOG.md` con entrada inicial: timestamp,
   "starting night shift", plan de bloques en orden.
4. **Empieza por Bloque 0.** Si Bloque 0 falla en SSH o Go/No-Go, terminas con
   HANDOVER mínimo y te detienes.
5. Avanza bloque por bloque hasta que se cumpla una condición de paro o
   termines todos.
6. Cada 45 min o cada 2 commits, corre el fail-safe de Sección 8.
7. **Antes de terminar:** genera `HANDOVER_MORNING.md`, haz
   `git add . && git commit -m "night-shift: complete handover ready"`.
   NO hagas push (no hay remoto configurado).
8. Cierra la sesión limpiamente.

Buena noche. Trabaja con cuidado. El Apache, MariaDB y Omada Controller que
están ahí son producción ajena al bot — déjalos intactos.
