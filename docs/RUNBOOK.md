# RUNBOOK — Lighthouse Bot

Procedimientos para situaciones frecuentes.

---

## Evolution API pierde sesión WhatsApp

**Síntomas:** El bot deja de recibir mensajes. Los logs de Evolution muestran "session closed".

**Procedimiento:**
```bash
ssh noreply@soporte.lamarque.mx
# Abrir tunnel en nueva terminal local:
#   ssh -L 8001:localhost:8001 noreply@soporte.lamarque.mx
# Abrir http://localhost:8001 en el navegador
# → Ir a la instancia (EVOLUTION_INSTANCE_NAME) → Connect
# → Escanear QR con WhatsApp Business del número
```

**Prevención:** Evolution API v2 con sesión activa puede mantenerse por semanas. Si hay reconexiones frecuentes, verificar que el número de WhatsApp Business no tenga la sesión abierta en otro dispositivo.

---

## Booksy cambia un selector (el bot falla al agendar)

**Síntomas:** booksy-executor retorna 500, hay snapshots en `storage_state/failures/`.

**Diagnóstico:**
```bash
ssh noreply@soporte.lamarque.mx
ls /opt/lighthouse-bot/storage_state/failures/  # ver timestamp del fallo
cat /opt/lighthouse-bot/storage_state/failures/<timestamp>/meta.txt
# Abrir /storage_state/failures/<timestamp>/page.html en navegador
# o ver screenshot.png para identificar qué cambió en la UI
```

**Fix:**
1. Abrir Booksy en navegador logueado como dueño
2. Inspeccionar el elemento con DevTools
3. Actualizar `booksy-executor/src/booksy/selectors.py` con el nuevo selector
4. Deploy el fix:
   ```powershell
   # Local:
   .\scripts\deploy.ps1 -SkipBootstrap
   # En VM:
   ssh noreply@soporte.lamarque.mx "cd /opt/lighthouse-bot && sudo docker compose restart booksy-executor"
   ```

---

## Gemini se dispara en costo

**Síntomas:** Alerta de billing en Google AI Studio. Costo mayor al proyectado.

**Diagnóstico en Redis:**
```bash
ssh noreply@soporte.lamarque.mx
sudo docker compose exec redis redis-cli
# Ver números con más tokens:
KEYS tokens:*
GET tokens:<phone>:<fecha>
```

**Acciones:**
1. Verificar que el pre-filtro regex funciona (debe evitar ~60% de llamadas a Gemini)
2. Reducir `maxOutputTokens` temporalmente en los nodos de n8n
3. Si un número específico está abusando: `SET human:<phone> 1 EX 86400` (bloquear 24h)
4. Cambiar modelo a uno más barato si es necesario: ajustar `GEMINI_MODEL` en `.env`

---

## Número WhatsApp baneado por Meta

**Síntomas:** Los mensajes no llegan. Evolution logs: "banned" o "invalid_session".

**Procedimiento:**
1. El número baneado no puede recuperarse automáticamente
2. Si es un ban temporal (24-48h): esperar y reconectar
3. Si es permanente: reemplazar el número de WhatsApp Business y reconfigurar Evolution API
4. **Prevención:** nunca usar el número para envíos masivos o spam; respetar rate limits

---

## Conflicto accidental con Apache u Omada

**Síntomas:** Apache o tpeap cambian a `failed` o `inactive` después de una operación del stack Lighthouse.

**Procedimiento de emergencia:**
```bash
ssh noreply@soporte.lamarque.mx
sudo systemctl status apache2 mariadb tpeap

# Si alguno está failed:
sudo systemctl restart apache2  # si fue apache
sudo systemctl restart tpeap    # si fue omada (cuidado, tarda ~60s en levantar)

# Verificar logs:
sudo journalctl -u apache2 -n 50
sudo journalctl -u tpeap -n 50
```

**Si fue causado por el stack Lighthouse:**
```bash
cd /opt/lighthouse-bot
sudo docker compose down  # bajar el stack
# Identificar qué causó el conflicto (puertos, iptables, recursos)
# Corregir y volver a subir
```

**Reporte:** Abrir entrada 🚨 INCIDENTE en WORKLOG.md con el comando que lo causó.

---

## Stack Lighthouse no levanta (docker compose up falla)

**Diagnóstico:**
```bash
ssh noreply@soporte.lamarque.mx
cd /opt/lighthouse-bot
sudo docker compose logs --tail=50  # ver qué servicio falla
sudo docker compose ps              # ver estados
```

**Causas comunes:**
- `.env` no existe o tiene variables vacías → llenar y volver a intentar
- Puerto en conflicto → verificar con `sudo ss -tlnp | grep <puerto>`
- RAM insuficiente → `free -h`; parar servicios no críticos o esperar
- Imagen no descargable → verificar conectividad; probar versión anterior
- booksy-executor build falla → `sudo docker compose build booksy-executor --no-cache`

---

## Redis memoria llena

**Síntomas:** Logs de Redis con `OOM command not allowed` o datos perdidos inesperadamente.

**Diagnóstico:**
```bash
sudo docker compose exec redis redis-cli info memory | grep used_memory_human
```

**Acción:**
La política `allkeys-lru` evicta automáticamente. Si el problema persiste, aumentar `maxmemory` en docker-compose.yml (actualmente 100mb) o aumentar el mem_limit del contenedor Redis.

---

## Backup y restore

```bash
# Backup manual:
cd /opt/lighthouse-bot && ./scripts/backup.sh

# Dry run (solo muestra qué haría):
./scripts/backup.sh --dry-run

# Restaurar desde timestamp:
./scripts/restore.sh 20260507-234000
```

Backups guardados en `/backups/lighthouse/`. Se limpian automáticamente después de 14 días.
