# ADR-001 — Estrategia de Integración con Booksy

**Fecha:** 2026-05-07  
**Estado:** Aceptado  
**Decidido por:** Agente nocturno (confirmado por brief del humano)

---

## Contexto

La barbería usa Booksy plan básico (~600-700 MXN/mes). Este plan **no incluye Partner API** (webhooks, REST API de reservas). La única forma de automatizar reservas es a través de la UI web de Booksy.

## Opciones evaluadas

### Opción A — Partner API oficial
**Descartada.** Requiere plan Enterprise o aprobación especial de Booksy. No disponible en el plan actual y el costo sería significativamente mayor.

### Opción B — Reverse engineering de la API privada
**Descartada.** La API interna de Booksy usa tokens de sesión efímeros con fingerprinting. El reverse engineering violaría los TOS de Booksy y la sesión expiraría frecuentemente, generando mantenimiento continuo.

### Opción C — Playwright con persistent context y stealth (ELEGIDA)
**Adoptada.** Usa la UI de Booksy exactamente como lo haría un humano usando el navegador. 

**Ventajas:**
- Compatible con cualquier plan de Booksy
- La sesión persiste via `storage_state` (cookies + localStorage)
- Fallback de selectores en cascada reduce fragilidad ante cambios de UI
- Circuit breaker protege contra cascades de fallos

**Desventajas:**
- Dependiente de la estructura HTML de Booksy (puede cambiar)
- Requiere credenciales de cuenta de dueño
- Playwright agrega ~768 MiB RAM al stack

**Mitigaciones:**
- Selectores en cascada (4 estrategias por elemento)
- Snapshot automático de pantalla+HTML en cada fallo
- Circuit breaker (3 fallos/60s → OPEN 5min → 503)
- RUNBOOK.md documenta qué hacer cuando Booksy cambia un selector

## Decisión

Usar **Playwright con persistent context y stealth** en un microservicio Python/FastAPI (`booksy-executor`). Los selectores reales los provee el humano tras inspeccionar la UI de Booksy logueado como dueño.

## Consecuencias

- booksy-executor necesita `mem_limit: 768m` (Playwright + Chromium)
- El humano debe hacer login manual una vez para generar el `storage_state` inicial
- Cuando Booksy actualice su UI, alguien debe actualizar `selectors.py`
