# Prompts — Cómo se conectan en n8n

## Archivos

| Archivo | Uso | Tokens aprox |
|---|---|---|
| `system_prompt_humanizer.md` | System prompt de Gemini para todas las respuestas al cliente | ~1,200 |
| `intent_classifier.md` | Pre-clasificación rápida (antes del humanizer) | ~80 |
| `refusal_templates.md` | Respuestas canned para casos específicos | ~250 |

## Flujo en n8n

```
Mensaje WhatsApp entrante
    │
    ▼
[02-intent-router] ─── regex/keywords ──► match → switch directo
    │
    │ no match
    ▼
Gemini (intent_classifier.md + mensaje)  → intent en ≤5 tokens
    │
    ▼
Switch por intent
    ├── book/reschedule/cancel → [03-booking-flow]
    │       │
    │       ▼
    │   Gemini (system_prompt_humanizer.md + contexto)
    │       │
    │       ├── requires_tool=true → booksy-executor → respuesta final
    │       └── requires_tool=false → respuesta directa
    │
    ├── info → Gemini (humanizer) con contexto estático de servicios/precios
    ├── off_topic → refusal_template aleatorio
    └── human_handoff → [04-human-handoff] → Chatwoot
```

## Variables de contexto que pasa n8n al humanizer

- `{BARBERSHOP_NAME}` — nombre del salón
- `{LOCATION_NAME}` — sucursal detectada o seleccionada
- `{CONVERSATION_HISTORY}` — últimos 6 turnos (Redis key `conv:{phone}`)
- `{AVAILABLE_SLOTS}` — resultado de booksy-executor (si se llamó)
- `{CLIENT_NAME}` — si ya se conoce del contexto

## Controles de costo (codificados en n8n)

- 4,000 tokens acumulados por número/24h (contador en Redis `tokens:{phone}:{date}`)
- 10 mensajes por número/minuto (Redis INCR + TTL 60s)
- Ventana conversacional: últimos 6 turnos
- Tripwire off-topic: 3 strikes → silencio 1h (Redis key `tripwire:{phone}`)
