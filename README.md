# Lighthouse Bot — Carpeta de Control

Este directorio (`D:\lighthouse bot\`) es el **cuartel general** del proyecto.
Aquí vive el código fuente, los scripts de despliegue y la sesión nocturna de
Claude Code.

El bot **se despliega** en una VM remota en GCP (Ubuntu 22.04, hostname
`omada-controller`, dominio `soporte.lamarque.mx`) vía SSH. Claude Code corre
**localmente** en esta carpeta y orquesta todo el deploy remoto. El stack
productivo vive en Docker dentro de la VM.

---

## Topología confirmada

```
┌─────────────────────────────┐    SSH (gcloud OS Login)    ┌──────────────────────────────┐
│  PC Local (Windows)         │ ──── ssh noreply@... ──────►│  GCP VM 22.04 — soporte...   │
│  D:\lighthouse bot\         │                              │  3.8 GB RAM | 14 GB libres   │
│                             │                              │                              │
│  • Claude Code agente       │                              │  YA EXISTE (no tocar):       │
│  • Repo git                 │                              │  • Apache (:80, :443) LAMP   │
│  • Prompts y configs        │     scp/rsync deploy         │  • MariaDB (:3306) LAMP      │
│  • .env.local (secretos)    │ ────────────────────────────►│  • Omada Controller          │
│  • WORKLOG.md               │                              │    (:8043, :8088, :8843)     │
│  • HANDOVER_MORNING.md      │                              │  • MongoDB de Omada (:27217) │
│                             │                              │                              │
└─────────────────────────────┘                              │  SE INSTALA (nuevo):         │
                                                             │  /opt/lighthouse-bot/        │
                                                             │  └─ docker compose:          │
                                                             │     • postgres 127.0.0.1:5433│
                                                             │     • redis    127.0.0.1:6380│
                                                             │     • n8n      127.0.0.1:5678│
                                                             │     • evolution 127.0.0.1:8001│
                                                             │     • chatwoot 127.0.0.1:3001│
                                                             │     • booksy   127.0.0.1:8002│
                                                             │     • caddy    0.0.0.0:9080  │
                                                             │                0.0.0.0:9443  │
                                                             └──────────────────────────────┘
```

**Coexistencia:** Apache sigue en 80/443 sirviendo lo que ya sirve. Caddy escucha
en puertos altos (9080/9443). La exposición pública del bot se decide al final
(opción recomendada: Apache reverse-proxy a Caddy en un VirtualHost nuevo).

---

## Estado actual del server (snapshot pre-deploy)

Lo que ya está corriendo en producción y **no se debe tocar**:

| Servicio | Puerto | Función |
|---|---|---|
| Apache 2 | 80, 443 | Servidor web (LAMP existente) |
| MariaDB | 127.0.0.1:3306 | Base de datos del LAMP |
| Omada Controller (jsvc) | 8043, 8088, 8843, 29811-29816 | Gestor de red TP-Link |
| MongoDB embebido | 127.0.0.1:27217 | Storage del Omada |
| sshd | 22 | Acceso administrativo |
| fluent-bit + otelopscol | 20201, 20202 | Telemetría de GCP (no tocar) |

Lo que ya está preparado para el deploy:

- ✅ Usuario `lighthouse` existe con password
- ✅ `/etc/sudoers.d/lighthouse` configurado y validado
- ✅ `/home/lighthouse/.ssh/authorized_keys` creado (vacío)
- ❌ Docker no instalado (Claude Code lo instala)
- ❌ Stack no desplegado (Claude Code lo despliega)

---

## Archivos en esta carpeta

| Archivo | Qué es | Cuándo lo tocas |
|---|---|---|
| `README.md` | Este archivo | Solo lectura |
| `PRE_FLIGHT.md` | Checklist humano antes de arrancar la noche | Una vez, antes de pegar el prompt |
| `NIGHT_SHIFT.md` | El prompt para Claude Code | Lo pegas al agente y no lo tocas más |
| `.env.local` | Secretos de conexión (gitignored) | Lo creas con datos reales antes de arrancar |

Después de la sesión nocturna, Claude Code generará automáticamente:

| Archivo | Qué tendrá |
|---|---|
| `WORKLOG.md` | Diario de decisiones del agente con timestamps |
| `HANDOVER_MORNING.md` | Lo PRIMERO que tú lees al despertar |
| `INFRA_REPORT.md` | Estado real de la VM contrastado con el inventario inicial |
| `infra-snapshots/` | Outputs raw del inventario remoto |
| Resto del repo | docker-compose, prompts, microservicio, scripts, docs |

---

## Cómo arrancar (resumen)

1. Lee `PRE_FLIGHT.md` y completa cada punto.
2. Llena `.env.local` con datos reales (template debajo).
3. Toma un snapshot de la VM en GCP. **No te lo brinques.**
4. Abre PowerShell, `cd "D:\lighthouse bot"`.
5. Arranca Claude Code:
   ```powershell
   claude --dangerously-skip-permissions 2>&1 | Tee-Object -FilePath "night-$(Get-Date -Format yyyy-MM-dd).log"
   ```
6. Pega el contenido completo de `NIGHT_SHIFT.md` y dale Enter.
7. A dormir. En la mañana, abre `HANDOVER_MORNING.md` primero.

---

## Template de `.env.local`

Crea este archivo en `D:\lighthouse bot\.env.local` con tus valores reales.
**No lo commitees.** Está en el `.gitignore` que el agente generará.

```env
# Conexión SSH al server (Claude Code conecta como noreply via gcloud OS Login)
VM_HOST=soporte.lamarque.mx
VM_BOOTSTRAP_USER=noreply
VM_DEPLOY_USER=lighthouse

# Rutas
PROJECT_ROOT=D:\lighthouse bot
REMOTE_PROJECT_ROOT=/opt/lighthouse-bot

# Negocio (opcional, el agente los pide si faltan)
BARBERSHOP_NAME=
BARBERSHOP_LOCATION_1_NAME=
BARBERSHOP_LOCATION_2_NAME=
BARBERSHOP_TIMEZONE=America/Mazatlan
```

> No necesitas `SSH_KEY_PATH` porque tu autenticación al server va vía gcloud
> OS Login, no por llave estática local.

---

## Reglas críticas para Claude Code

El agente tiene instrucciones explícitas de:

- ❌ **NO tocar Apache** (servicio activo en :80/:443).
- ❌ **NO tocar MariaDB** existente (:3306).
- ❌ **NO tocar Omada Controller** (servicio `tpeap`, MongoDB :27217, puertos 8043/8088/8843/29811-29816).
- ❌ **NO tocar telemetría GCP** (fluent-bit, otelopscol — :20201, :20202).
- ❌ **NO usar puertos** 22, 53, 80, 443, 3306, 8043, 8088, 8843, 20201, 20202, 27217, 29811-29816.
- ❌ **NO commitear secretos**.
- ❌ **NO usar imágenes Docker `:latest`** (siempre versiones pinneadas).
- ❌ **NO reiniciar la VM** (hay un *System restart required* pendiente, lo decide el humano).
- ✅ **Snapshot continuo** de decisiones en `WORKLOG.md`.
- ✅ **Idempotente:** si algo ya está hecho, no lo rehace.
- ✅ **Revertir inmediato** si Apache, MariaDB o Omada se degradan.
