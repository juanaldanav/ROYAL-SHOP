"""
Consulta de disponibilidad en Booksy.
Retorna slots disponibles para una sucursal/servicio/rango de fechas.
STUB: pendiente de selectores reales.
"""
from datetime import datetime
from typing import Any

import structlog
from playwright.async_api import BrowserContext

log = structlog.get_logger()


async def get_availability(
    ctx: BrowserContext,
    location_id: str,
    service_name: str,
    date_from: datetime,
    date_to: datetime,
) -> dict[str, Any]:
    """
    Stub: retorna estructura realista pero marcada como not_implemented.
    El humano completa con selectores reales desde selectors.py.
    """
    # TODO: implementar con Playwright una vez que el humano provea los selectores
    log.info(
        "availability.stub",
        location_id=location_id,
        service=service_name,
        date_from=date_from.isoformat(),
        date_to=date_to.isoformat(),
    )
    return {
        "status": "not_implemented",
        "reason": "awaiting_selectors",
        "location_id": location_id,
        "service": service_name,
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "slots": [],
    }
