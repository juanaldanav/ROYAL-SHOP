# 🌅 HANDOVER — 2026-05-08

## TL;DR

- **Estado general:** 🟢
- **Bloques completados:** 0, A, B, C, D, E, F, G — todos los 7 bloques
- **Bloques bloqueados:** ninguno
- **Tiempo total trabajado:** ~6 horas
- **Servicios pre-existentes (Apache/MariaDB/Omada/GCP):** todos sanos al cierre ✅
- **Docker:** instalado (v29.4.3) en la VM ✅
- **Repo en VM:** `/opt/lighthouse-bot/` ✅
- **docker compose config:** válido ✅

---

## ✅ Lo que ya funciona (verificable)

| Item | Cómo verificar |
|---|---|
| Repo local con 7 commits | `git log --oneline` en `D:\lighthouse bot\` |
| Docker en VM | `ssh noreply@soporte.lamarque.mx "docker --version"` |
| /opt/lighthouse-bot/ poblado | `ssh noreply@soporte.lamarque.mx "ls /opt/lighthouse-bot/"` |
| docker-compose.yml válido | `ssh noreply@soporte.lamarque.mx "cd /opt/lighthouse-bot && sudo docker compose config --quiet"` |
| Servicios pre-existentes OK | `ssh noreply@soporte.lamarque.mx "sudo systemctl is-active apache2 mariadb tpeap"` |

---

## 🔴 CRÍTICO — hacer primero (sin esto el bot no arranca)

### 1. Llenar `.env` en la VM con credenciales reales

```bash
ssh noreply@soporte.lamarque.mx
sudo -u lighthouse cp /opt/lighthouse-bot/.env.example /opt/lighthouse-bot/.env
sudo -u lighthouse nano /opt/lighthouse-bot/.env
```

Variables OBLIGATORIAS para el primer arranque:

| Variable | Dónde se obtiene | Formato |
|---|---|---|
| `POSTGRES_PASSWORD` | Inventar (32+ chars) | ej: `Lh2026$Pg#Str0ng!Xkq2` |
| `N8N_DB_PASSWORD` | Inventar (24+ chars) | ej: `n8nPwd2026XqZ` |
| `CHATWOOT_DB_PASSWORD` | Inventar (24+ chars) | ej: `cwPwd2026RqZ` |
| `N8N_BASIC_AUTH_PASSWORD` | Inventar | min 12 chars |
| `N8N_ENCRYPTION_KEY` | `openssl rand -hex 32` | hex 64 chars |
| `CHATWOOT_SECRET_KEY_BASE` | `openssl rand -hex 64` | hex 128 chars |
| `EVOLUTION_API_KEY` | Inventar (UUID format) | `openssl rand -hex 16` |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | `AIza...` |
| `BARBERSHOP_NAME` | Nombre de la barbería | texto |
| `BARBERSHOP_LOCATION_1_NAME` | Nombre sucursal 1 | ej: `Centro` |
| `BARBERSHOP_LOCATION_2_NAME` | Nombre sucursal 2 | ej: `Ley` |
| `BOOKSY_USERNAME_SUC1` | Email de tu cuenta Booksy suc1 | email |
| `BOOKSY_PASSWORD_SUC1` | Password de Booksy suc1 | string |
| `BOOKSY_LOCATION_ID_SUC1` | ID en URL de Booksy (ej: `/biz/123456`) | número |
| `BOOKSY_USERNAME_SUC2` | Email de tu cuenta Booksy suc2 | email |
| `BOOKSY_PASSWORD_SUC2` | Password de Booksy suc2 | string |
| `BOOKSY_LOCATION_ID_SUC2` | ID en URL de Booksy suc2 | número |

### 2. Levantar el stack

```bash
ssh noreply@soporte.lamarque.mx
cd /opt/lighthouse-bot

# Primera vez — esto descarga imágenes (~2GB) y puede tardar 10-15 min
sudo docker compose up -d

# Verificar
sudo docker compose ps
# Todos deben decir "healthy" o "running" (booksy-executor tarda más por Playwright)

# Healthcheck
bash scripts/healthcheck.sh
```

### 3. Generar QR de Evolution API y parear WhatsApp Business

```bash
# En una terminal LOCAL (no en la VM):
ssh -L 8001:localhost:8001 noreply@soporte.lamarque.mx

# Con el tunnel abierto, en tu navegador local abre:
# http://localhost:8001
```

En la UI de Evolution API:
1. Click en la instancia `lighthouse_wa`
2. Click "Connect"
3. Escanear el QR con el WhatsApp Business del número del bot
4. Esperar confirmación "Connected"

### 4. Sacar selectores reales de Booksy

Abre Booksy en el navegador logueado como dueño de la sucursal. Usa DevTools (F12 → Inspector) para identificar los selectores reales de:

| Elemento | Archivo a editar |
|---|---|
| Campo email en login | `booksy-executor/src/booksy/selectors.py` → `login_email` |
| Campo password en login | `selectors.py` → `login_password` |
| Botón login | `selectors.py` → `login_button` |
| Botón "Nueva cita" | `selectors.py` → `new_appointment_button` |
| Selector de servicio | `selectors.py` → `service_selector` |
| Date picker | `selectors.py` → `date_picker` |
| Slots de hora | `selectors.py` → `time_slot` |
| Botón confirmar | `selectors.py` → `confirm_button` |

Después de actualizar selectores, subir y reiniciar:
```powershell
# Local:
.\scripts\deploy.ps1 -SkipBootstrap
# En VM:
ssh noreply@soporte.lamarque.mx "cd /opt/lighthouse-bot && sudo docker compose restart booksy-executor"
```

### 5. Generar storage_state inicial de Playwright (sesión Booksy)

```bash
# En la VM con el stack corriendo:
ssh noreply@soporte.lamarque.mx
cd /opt/lighthouse-bot

# Para sucursal 1:
sudo docker compose exec booksy-executor python -c "
import asyncio
from booksy.browser import get_context, save_session
from booksy.login import ensure_logged_in
from config import settings
async def main():
    ctx = await get_context('suc1')
    await ensure_logged_in(ctx, 'suc1', settings.booksy_username_suc1, settings.booksy_password_suc1)
    await save_session('suc1')
asyncio.run(main())
"

# Para sucursal 2 (mismo patrón con 'suc2')
```

### 6. Importar workflows en n8n

```bash
# Tunnel local primero:
ssh -L 5678:localhost:5678 noreply@soporte.lamarque.mx

# Abrir: http://localhost:5678 con las credenciales de N8N_BASIC_AUTH_*
```

En n8n:
1. Settings → API → Create API Key (para usarla en los workflows)
2. Workflows → Import → subir cada JSON de `n8n/workflows/` en orden (01 → 04)
3. Configurar en cada workflow:
   - Credencial Redis: `redis://localhost:6380`
   - Variable `GEMINI_API_KEY`: la API key de Gemini
   - Variable `EVOLUTION_API_KEY`: la key configurada en `.env`
4. Activar los workflows (toggle)
5. Configurar el webhook de Evolution API para que apunte a: `http://n8n:5678/webhook/whatsapp-inbound`

### 7. Decidir exposición pública

Lee `docs/ADR-004-port-and-coexistence-strategy.md`. Tres opciones:

- **A (recomendada):** Nuevo VirtualHost en Apache que proxy-pase a Caddy:9080
  - Requiere: DNS `bot.lamarque.mx → IP pública`
  - Requiere: `sudo a2enmod proxy proxy_http`
  - Luego: `sudo certbot --apache -d bot.lamarque.mx`
- **B:** Cloudflare Tunnel (sin tocar Apache)
- **C:** No recomendada (tumbaría Apache)

---

## 🟡 Importante (esta semana)

1. **Configurar backups automáticos:**
   ```bash
   # En la VM como root:
   echo "0 2 * * * lighthouse bash /opt/lighthouse-bot/scripts/backup.sh >> /var/log/lighthouse-backup.log 2>&1" | sudo tee /etc/cron.d/lighthouse-backup
   sudo mkdir -p /backups/lighthouse && sudo chown lighthouse:lighthouse /backups/lighthouse
   ```

2. **Aplicar el "System restart required" pendiente:**
   El kernel tiene una actualización pendiente (6.8.0-1053 → 6.8.0-1054). La VM necesita reinicio. Cuando lo hagas:
   ```bash
   # Antes del reinicio — bajar stack para evitar corrupción:
   ssh noreply@soporte.lamarque.mx "cd /opt/lighthouse-bot && sudo docker compose down"
   # Reiniciar:
   ssh noreply@soporte.lamarque.mx "sudo reboot"
   # Esperar 2-3 min, luego:
   ssh noreply@soporte.lamarque.mx "sudo systemctl is-active apache2 mariadb tpeap && cd /opt/lighthouse-bot && sudo docker compose up -d"
   ```

3. **Verificar que Evolution webhook llegue:** Después de configurar la exposición pública, enviar un WhatsApp de prueba al número del bot y verificar que aparezca en los execution logs de n8n.

4. **Ajustar system_prompt_humanizer.md:** Revisar el tono y los nombres de los servicios/precios reales de la barbería. Actualizar los few-shot examples si es necesario.

5. **Configurar BARBERSHOP_NAME y sucursales** en `.env` si aún están vacíos.

---

## 🟢 Nice-to-have

1. **Observabilidad (Loki + Grafana):**
   ```bash
   ssh noreply@soporte.lamarque.mx "cd /opt/lighthouse-bot && sudo docker compose --profile observability up -d"
   ```
   ⚠️ Solo activar si hay >1.5 GiB RAM libre. Agrega ~600 MiB.

2. **Alertas de billing Gemini:** Configurar en https://aistudio.google.com para alertar cuando el costo mensual supere $20 USD.

3. **Snapshot semanal de VM en GCP:** Compute Engine → Disks → Create schedule.

---

## 🧠 Decisiones que tomé sin tu aprobación (revisa)

| Decisión | Razón | Dónde está documentado |
|---|---|---|
| Corregí imagen Evolution API (`evoapicloud/evolution-api` vs `evolutionapi/evolution-api`) | La imagen del brief no existe en Docker Hub; `evoapicloud` es la oficial v2 | WORKLOG.md |
| Corregí imagen Chatwoot (`chatwoot/chatwoot` vs `atendai/chatwoot`) | La imagen correcta en Docker Hub es `chatwoot/chatwoot` | WORKLOG.md |
| Creé `.env.local` con valores del README (no existía) | La sesión no podía proceder sin él; valores eran públicos en el brief | WORKLOG.md |
| Chatwoot split en 2 servicios (web + sidekiq) | Patrón oficial; permite resource limits separados | docker-compose.yml |
| Playwright base: `-jammy` (Ubuntu 22.04) en vez de `-noble` | Coincide con el OS de la VM; reduce riesgo de incompatibilidad | WORKLOG.md |
| Caddyfile usa `*.localhost:9443` con TLS internal | Dominio público no enrutado todavía; tunnels SSH para testing | ADR-004 |
| No activé UFW | Riesgo de tumbar SSH; lo decide el humano | remote-bootstrap.sh |
| No corrí `docker compose up` | Instrucción explícita del brief; requiere `.env` real primero | NIGHT_SHIFT.md §6F |

---

## ❌ Cosas que intenté y no funcionaron

- **`docker compose config` local en Windows:** Docker no instalado en el PC local. Validación se hizo en la VM directamente con resultado exitoso.
- **`needrestart` durante apt-get:** Mostró lista de servicios para reiniciar por kernel update. No tomé acción (el brief prohíbe reiniciar la VM). Los servicios siguen activos.

---

## 📊 Costo proyectado mensual

| Concepto | USD/mes |
|---|---|
| Gemini 2.5 Flash-Lite (1k conv/día) | ~$5-8 |
| GCP VM + disco (ya existía) | ~$33-38 |
| Booksy plan (ya existía) | ~$60-70 |
| **Costo incremental del bot** | **~$5-10** |

Ver `docs/COST_MODEL.md` para detalle completo.

---

## 🔍 Comandos rápidos para auditar mi noche

```bash
# En local (D:\lighthouse bot\):
git log --oneline
cat WORKLOG.md
cat INFRA_REPORT.md

# En remoto:
ssh noreply@soporte.lamarque.mx
sudo systemctl is-active apache2 mariadb tpeap  # debe decir active x3
ls /opt/lighthouse-bot/
sudo docker --version
sudo docker compose -f /opt/lighthouse-bot/docker-compose.yml config --quiet
df -h / | tail -1  # disco libre
free -h | grep Mem  # RAM disponible
```

---

## 📁 Estructura de archivos generada

```
D:\lighthouse bot\
├── WORKLOG.md              ← diario de la noche
├── HANDOVER_MORNING.md     ← este archivo
├── INFRA_REPORT.md         ← inventario del servidor
├── infra-snapshots/2026-05-07-2340/  ← raw outputs SSH
├── .env.example            ← todas las vars documentadas
├── .gitignore
├── docker-compose.yml      ← stack completo, images pinneadas
├── docker-compose.observability.yml
├── Caddyfile
├── postgres/init/01-create-databases.sh
├── n8n/workflows/01-04 JSONs importables
├── booksy-executor/         ← microservicio Python/Playwright
├── prompts/                 ← humanizer + classifier + templates
├── docs/ADR-001 a 004, ARCHITECTURE, RUNBOOK, COST_MODEL
└── scripts/deploy.ps1, remote-bootstrap.sh, healthcheck.sh, backup.sh, restore.sh

/opt/lighthouse-bot/  (en la VM)
└── mismo árbol (sin .env real)
```

Buena mañana. El sistema está listo para levantar en cuanto llenes el `.env`.
