# ADR-003 — Redis como State Store

**Fecha:** 2026-05-07  
**Estado:** Aceptado

---

## Contexto

El bot necesita estado efímero entre mensajes: contexto conversacional, dedup de mensajes, rate limiting, locks de Booksy, y tracking de escalación. Se evalúa dónde almacenar este estado.

## Opciones

### Opción A — Postgres
Adecuado para estado permanente (historial de citas) pero con overhead de SQL para operaciones de bajo nivel como INCR, NX, TTL.

### Opción B — Redis (ELEGIDA)
Nativo para todas las operaciones necesarias: `SET NX EX` (dedup), `INCR + EXPIRE` (rate limit), `GET/SET con TTL` (contexto), `SET con TTL` (locks). Sub-milisegundo en loopback.

## Keys en uso

| Key | Tipo | TTL | Propósito |
|---|---|---|---|
| `dedup:msg:{msgId}` | String | 1h | Deduplicación de mensajes Evolution |
| `ratelimit:{phone}` | String | 60s | Rate limit 10msg/min por número |
| `tokens:{phone}:{date}` | String | hasta fin del día | Budget de tokens Gemini/24h |
| `conv:{phone}` | String (JSON) | 24h | Contexto conversacional (últimos 6 turnos) |
| `human:{phone}` | String | 2h | Marca de "en atención humana" |
| `tripwire:{phone}` | String | 1h | Contador de mensajes off-topic |
| `booksy:lock:{location_id}` | String | 30s | Lock distribuido para Booksy |
| `booksy:cb:{location_id}:failures` | String | 60s | Contador de fallos del circuit breaker |
| `booksy:cb:{location_id}:state` | String | — | Estado del circuit breaker |
| `booksy:cb:{location_id}:opened_at` | String | — | Timestamp de apertura del CB |

## Configuración

- `maxmemory 100mb` (dentro del mem_limit de 128m del container)
- `maxmemory-policy allkeys-lru` — evicta los keys menos usados si llega al límite
- `appendonly yes` — persistencia básica (no crítica, el estado es efímero por diseño)

## Consecuencias

- Si Redis reinicia, se pierden todas las sesiones activas (por diseño — son datos efímeros)
- El historial permanente de citas (si se necesita) va en Postgres, no en Redis
- La instancia de Redis está en loopback (`127.0.0.1:6380` en el host) — solo accesible desde Docker
