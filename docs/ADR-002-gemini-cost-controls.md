# ADR-002 — Controles de Costo para Gemini

**Fecha:** 2026-05-07  
**Estado:** Aceptado

---

## Contexto

El modelo Gemini 2.5 Flash-Lite tiene costo por token. Sin controles, una conversación larga o abusiva podría generar costos inesperados. El NIGHT_SHIFT.md especifica 4 capas de control.

## Las 4 capas de control

### Capa 1 — Pre-filtro determinista (n8n)
El `02-intent-router` usa regex/keywords para clasificar los intents más comunes sin llamar a Gemini. Solo pasa a Gemini cuando el regex no matchea. Estimado: ~60-70% de mensajes clasificados sin LLM.

### Capa 2 — Token budget por número (Redis)
- Key: `tokens:{phone}:{date}` (TTL hasta fin del día)
- Límite: 4,000 tokens acumulados/número/24h
- Cuando se alcanza: respuesta canned sin llamar a Gemini

### Capa 3 — Rate limit por número (Redis)
- Key: `ratelimit:{phone}` (TTL 60s)
- Límite: 10 mensajes/número/minuto
- Cuando se excede: silencio (no responde)

### Capa 4 — Window conversacional fija
- Máximo 6 turnos de contexto (12 mensajes)
- Implementado en `03-booking-flow`: `ctx.turns.slice(-12)`
- Previene que el contexto acumulado explote el costo

### Capa bonus — Tripwire off-topic
- Key: `tripwire:{phone}` (TTL 1h)
- 3 mensajes off-topic consecutivos → silencio 1h
- Protege contra usuarios que "prueban" el bot infinitamente

## Modelo seleccionado

`gemini-2.5-flash-lite` — el más económico de la familia Gemini 2.5.  
**No usar `gemini-1.5-flash`** — deprecado por Google.  
Configurable vía `GEMINI_MODEL` env var para facilitar upgrades futuros.

## Proyección de costo (ver COST_MODEL.md para detalle)

Con 1,000 conversaciones/día × 5 mensajes promedio × ~500 tokens/mensaje (prompt+respuesta):
- ~2.5M tokens/día de input, ~500K de output
- Estimado: ~$10-15 USD/mes en Gemini

## Consecuencias

- El intent classifier usa `maxOutputTokens: 10` (solo devuelve la categoría)
- El humanizer usa `maxOutputTokens: 256` (respuestas cortas)
- La temperatura del humanizer es 0.3 (controlada, no impredecible)
