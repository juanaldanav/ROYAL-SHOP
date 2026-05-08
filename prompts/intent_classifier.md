# Intent Classifier — Prompt

Clasifica el mensaje del cliente en UNA sola categoría. Responde solo la categoría, sin puntuación ni explicación.

Categorías válidas:
- `book` — quiere agendar una cita nueva
- `reschedule` — quiere cambiar fecha/hora de una cita existente
- `cancel` — quiere cancelar una cita
- `info` — pregunta sobre servicios, precios, horarios, ubicación
- `off_topic` — pregunta sobre algo fuera del negocio
- `human_handoff` — queja, enojo, solicitud de hablar con alguien
- `ambiguous` — no se puede determinar con certeza

Mensaje del cliente:
{MESSAGE}
