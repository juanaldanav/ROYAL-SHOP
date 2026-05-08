# PRE_FLIGHT.md — Checklist Humano Antes de Arrancar

Tiempo total estimado: **10-15 minutos**.
No te brinques nada. Cada item evita un fracaso predecible a las 3am.

---

## 1. Snapshot de la VM en GCP (OBLIGATORIO) ⏱️ 2 min

Tu botón de undo si Claude Code rompe algo. Apache, MariaDB y Omada Controller
viven en esta VM — un snapshot es seguro de vida.

1. Abre Google Cloud Console → Compute Engine → VM instances.
2. Click en tu VM (`omada-controller` / `soporte.lamarque.mx`).
3. Tab **"Disks"** → click en el disco principal.
4. Botón **"Create snapshot"**.
5. Nombre: `pre-lighthouse-bot-YYYY-MM-DD` (con la fecha de hoy).
6. Espera a que el snapshot diga "Ready" (1-3 min).

**Si no haces esto y algo sale mal, no hay vuelta atrás.**

---

## 2. Validar herramientas en PowerShell ⏱️ 1 min

Abre PowerShell y corre uno por uno:

```powershell
node --version       # Debe ser >= 20  (tienes v22.18.0 ✅)
git --version        # Cualquier 2.x reciente  (tienes 2.53 ✅)
ssh -V               # OpenSSH for Windows  (tienes 9.5p2 ✅)
claude --version     # >= 2.x  (tienes 2.1.133 ✅)
gcloud --version     # debe estar disponible (tu auth al server va por aquí)
```

Si `gcloud` no responde:

```powershell
# Instalar Google Cloud SDK si falta
# https://cloud.google.com/sdk/docs/install
# Después: gcloud auth login && gcloud config set project TU_PROYECTO
```

---

## 3. Validar que el SSH como `noreply` funciona ⏱️ 1 min

Esta es la **única conexión que Claude Code usará**. Tiene que funcionar
sin password porque tienes gcloud OS Login configurado.

```powershell
ssh noreply@soporte.lamarque.mx "whoami && hostname && echo OK"
```

Debe responder:
```
noreply
omada-controller
OK
```

**Si te pide password:**
- Asegúrate de tener `gcloud auth login` hecho recientemente.
- Verifica que tu cuenta tiene permisos de OS Login en el proyecto GCP.
- Si no, agrega tu key manualmente vía consola de GCP → Compute Engine →
  Metadata → SSH Keys.

Sin esto resuelto, **Claude Code no puede arrancar**.

---

## 4. Confirmar que el setup parcial de `lighthouse` quedó bien ⏱️ 1 min

Tú ya hiciste manualmente:
- Crear el usuario `lighthouse` con password
- Crear `/etc/sudoers.d/lighthouse` (validado con "parsed OK")
- Crear `/home/lighthouse/.ssh/authorized_keys` (vacío)

Verifica que sigue todo OK:

```powershell
ssh noreply@soporte.lamarque.mx "id lighthouse && sudo cat /etc/sudoers.d/lighthouse && sudo ls -la /home/lighthouse/.ssh/"
```

Debe mostrar:
- El usuario lighthouse con grupo lighthouse
- La línea `lighthouse ALL=(ALL) NOPASSWD: /usr/bin/apt, ...`
- Un directorio `.ssh/` con `authorized_keys` dentro

Si algo falta, Claude Code lo va a completar idempotentemente — no es bloqueante.

---

## 5. Crear `.env.local` ⏱️ 2 min

En PowerShell:

```powershell
cd "D:\lighthouse bot"

@"
VM_HOST=soporte.lamarque.mx
VM_BOOTSTRAP_USER=noreply
VM_DEPLOY_USER=lighthouse
PROJECT_ROOT=D:\lighthouse bot
REMOTE_PROJECT_ROOT=/opt/lighthouse-bot
BARBERSHOP_NAME=
BARBERSHOP_LOCATION_1_NAME=
BARBERSHOP_LOCATION_2_NAME=
BARBERSHOP_TIMEZONE=America/Mazatlan
"@ | Out-File -Encoding utf8 .env.local

Get-Content .env.local
```

Después abre `.env.local` con un editor y llena los nombres de la barbería y de
las dos sucursales. No es crítico para el deploy nocturno, pero el agente lo va
a usar para los prompts y los ADRs.

---

## 6. Confirmar el flag de Claude Code ⏱️ 30 seg

```powershell
claude --help | Select-String -Pattern "permission|dangerous|skip|auto|approve"
```

Debe aparecer `--dangerously-skip-permissions`. Si tu versión expone un flag
distinto (ej. `--auto-approve`, `--yolo`), úsalo en lugar del que está en el
README.

---

## 7. Última revisión antes de pegar ⏱️ 1 min

Antes de arrancar, ten esto a la mano:

- [ ] Snapshot de la VM creado y confirmado en GCP (paso 1)
- [ ] PowerShell validado: node, git, ssh, claude, gcloud (paso 2)
- [ ] `ssh noreply@soporte.lamarque.mx` funciona sin password (paso 3)
- [ ] El usuario `lighthouse` y su sudoers están en su lugar (paso 4)
- [ ] `.env.local` creado en `D:\lighthouse bot\` (paso 5)
- [ ] `NIGHT_SHIFT.md` está en `D:\lighthouse bot\NIGHT_SHIFT.md`
- [ ] Te falta como mínimo 6-8 horas para regresar (la noche completa)

---

## 8. Arranque ⏱️ 30 seg

```powershell
cd "D:\lighthouse bot"
claude --dangerously-skip-permissions 2>&1 | Tee-Object -FilePath "night-$(Get-Date -Format yyyy-MM-dd).log"
```

Cuando entre a la sesión interactiva del agente:
1. **Abre `NIGHT_SHIFT.md`** con tu editor preferido (VSCode, Notepad++).
2. **Copia todo el contenido** del archivo (Ctrl+A → Ctrl+C).
3. **Pégalo en la sesión de Claude Code** y dale Enter.

Verás al agente leer su misión, escribir un resumen de 5-10 líneas como
"firma de comprensión", y empezar por el Bloque 0 (validación de conexión
SSH e inventario remoto). A partir de ahí trabaja solo.

---

## 9. Antes de irte a dormir, deja esto en pantalla

- La ventana de PowerShell con el agente corriendo (déjala abierta).
- Pon la PC en modo "no apagar pantalla / no suspender":
  - Settings → System → Power & battery → Screen and sleep → poner ambos en
    "Never" mientras dura la sesión.
- Opcional: configura el monitor para que se apague pero la PC no entre en
  suspensión.

---

## 10. En la mañana

1. Vuelve a `D:\lighthouse bot\`.
2. **Abre primero `HANDOVER_MORNING.md`.** Ese archivo te dice todo: qué se
   hizo, qué falta, qué TÚ tienes que hacer hoy.
3. Después revisa `WORKLOG.md` si quieres auditar las decisiones del agente.
4. Si algo se ve raro: `git log --oneline` te muestra cada commit con su razón.
5. Si Apache, MariaDB u Omada Controller se sienten raros:
   ```powershell
   ssh noreply@soporte.lamarque.mx "sudo systemctl status apache2 mariadb tpeap"
   ```
   Si alguno está degradado, **`HANDOVER_MORNING.md` tendrá una sección
   🚨 INCIDENTE en la parte superior** con instrucciones de recovery.

Suerte. Buena noche.
