# Arquitectura — Lighthouse Bot

## Flujo end-to-end

```mermaid
flowchart TD
    WA[WhatsApp Business\nCliente] -->|mensaje| EV[Evolution API\n:8001]
    EV -->|POST webhook| N8N[n8n\n:5678]
    
    subgraph n8n Workflows
        N8N --> WF1[01 WhatsApp Inbound\ndedup + rate limit]
        WF1 --> WF2[02 Intent Router\nregex → Gemini classify]
        WF2 -->|book/reschedule/cancel| WF3[03 Booking Flow\nGemini humanizer]
        WF2 -->|human_handoff| WF4[04 Human Handoff]
        WF2 -->|off_topic| CANNED[Refusal template]
    end
    
    WF3 -->|get_availability| BE[booksy-executor\n:8002]
    BE -->|Playwright| BOOKSY[Booksy Web UI\n☁️ Internet]
    
    WF3 -->|reply| EV
    EV -->|envía mensaje| WA
    
    WF4 -->|crear conversación| CW[Chatwoot\n:3001]
    CW -->|notifica| HUMAN[Humano\nequipo barbería]
    HUMAN -->|responde en Chatwoot| CW
    
    subgraph Estado Redis :6380
        REDIS[(Redis\n:6380)]
    end
    
    WF1 <-->|dedup/rate limit| REDIS
    WF3 <-->|contexto conversacional| REDIS
    WF4 <-->|mark human:phone| REDIS
    BE <-->|circuit breaker/lock| REDIS
    
    subgraph Base de Datos
        PG[(Postgres\n:5433)]
    end
    
    N8N <-->|n8n_db| PG
    CW <-->|chatwoot_db| PG
    EV <-->|evolution_db| PG
    
    subgraph Reverse Proxy
        CADDY[Caddy\n:9080/:9443]
    end
    
    CADDY -->|proxy| N8N
    CADDY -->|proxy| CW
    CADDY -->|proxy| EV
    
    APACHE[Apache\n:80/:443\nLAMP existente] -->|proxy opcional| CADDY
    
    subgraph LLM
        GEMINI[Gemini 2.5 Flash-Lite\n☁️ Google AI Studio]
    end
    
    WF2 <-->|classify| GEMINI
    WF3 <-->|humanize| GEMINI
```

## Decisiones de arquitectura clave

| Decisión | Elegida | Razón |
|---|---|---|
| Booksy integration | Playwright stealth | No hay Partner API en plan básico |
| LLM | Gemini 2.5 Flash-Lite | Costo más bajo de Gemini 2.5 |
| Estado | Redis | Sub-ms, TTL nativo, rate limit nativo |
| DB | Postgres 16 | n8n y Chatwoot la requieren; no usar MariaDB del LAMP |
| Orquestador | n8n | Open source, self-hosted, visual, webhooks nativos |
| Gateway WhatsApp | Evolution API v2 | Open source, persistente, QR/pairing |
| Reverse proxy | Caddy | TLS automático, config simple, loopback para exposición |

## Separación de responsabilidades

- **n8n:** orquestación, estado conversacional, llamadas a LLM
- **booksy-executor:** Playwright, circuit breaker, snapshots de fallos
- **Chatwoot:** bandeja de mensajes para el equipo humano
- **Redis:** estado efímero (dedup, rate limit, contexto, locks)
- **Postgres:** estado persistente (workflows n8n, conversaciones Chatwoot)
- **Caddy:** TLS y reverse proxy del stack (no toca el LAMP de Apache)
