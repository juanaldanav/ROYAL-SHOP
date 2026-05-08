# COST_MODEL — Proyección de Costos Mensuales

**Escenario base:** 1,000 conversaciones/día, 5 mensajes promedio por conversación.  
**Zona horaria:** America/Mazatlan (operación ~14h/día)

---

## Supuestos de tráfico

| Métrica | Valor |
|---|---|
| Conversaciones/día | 1,000 |
| Mensajes/conversación | 5 (promedio) |
| Mensajes totales/día | 5,000 |
| Mensajes que llegan a Gemini | ~2,000 (60% filtrado por regex) |
| Tokens/mensaje entrada (prompt) | ~500 tokens |
| Tokens/mensaje salida (respuesta) | ~100 tokens |
| Tokens totales entrada/día | 1,000,000 |
| Tokens totales salida/día | 200,000 |

---

## Gemini 2.5 Flash-Lite

Precios aproximados (mayo 2026):
- Input: $0.10 / 1M tokens
- Output: $0.40 / 1M tokens

| Concepto | Tokens/mes | Costo USD/mes |
|---|---|---|
| Input (30 días) | 30,000,000 | $3.00 |
| Output (30 días) | 6,000,000 | $2.40 |
| **Subtotal Gemini** | | **~$5.40/mes** |

*Nota: el modelo puede ser actualizado o cambiar de precio. Revisar en aistudio.google.com.*

---

## Infraestructura GCP

| Servicio | Costo estimado |
|---|---|
| VM (e2-medium, 2 vCPU, 4GB) | ~$25-30 USD/mes |
| Persistent Disk (29GB SSD) | ~$5 USD/mes |
| Snapshots de VM (2 retenidos) | ~$2 USD/mes |
| Egress de red (WhatsApp webhooks) | ~$1 USD/mes |
| **Subtotal GCP** | **~$33-38 USD/mes** |

*La VM ya existía y paga el LAMP también. El costo del bot es marginal en la VM.*

---

## Booksy

| Concepto | Costo |
|---|---|
| Plan básico Booksy (2 sucursales) | ~1,200-1,400 MXN/mes (~$60-70 USD) |

*Este costo ya existía antes del bot. El bot no lo incrementa.*

---

## Resumen

| Concepto | USD/mes | MXN/mes (aprox @19) |
|---|---|---|
| Gemini 2.5 Flash-Lite | $5-8 | ~$95-150 |
| GCP VM + disco + snapshots | $33-38 | ~$625-720 |
| Booksy plan | $60-70 | ~$1,140-1,330 |
| **TOTAL** | **~$98-116 USD** | **~$1,860-2,200 MXN** |

**El costo incremental del bot** (excluyendo VM y Booksy que ya existían) es de ~$5-10 USD/mes.

---

## Escalado

| Escenario | Conversaciones/día | Costo Gemini adicional |
|---|---|---|
| Bajo | 200 | ~$1/mes |
| Base | 1,000 | ~$5/mes |
| Alto | 5,000 | ~$25/mes |
| Pico absoluto | 10,000 | ~$50/mes |

Los controles de costo (4 capas, ver ADR-002) protegen contra picos inesperados.

---

## Alertas recomendadas

Configurar en Google AI Studio / GCP Console:
- Alerta presupuestal: $20/mes en Gemini → investigar
- Alerta presupuestal: $50/mes en GCP → escalar VM o revisar egress
