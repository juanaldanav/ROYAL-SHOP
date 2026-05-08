"""
Operaciones de booking: create, reschedule, cancel.
STUBs: pendiente de selectores reales.
"""
from typing import Any

import structlog
from playwright.async_api import BrowserContext

log = structlog.get_logger()


async def book_appointment(
    ctx: BrowserContext,
    location_id: str,
    service_name: str,
    slot_datetime: str,
    client_name: str,
    client_phone: str,
) -> dict[str, Any]:
    # TODO: implementar con selectores reales
    log.info("booking.stub", action="book", location_id=location_id, slot=slot_datetime)
    return {
        "status": "not_implemented",
        "reason": "awaiting_selectors",
        "action": "book",
        "location_id": location_id,
        "service": service_name,
        "slot": slot_datetime,
    }


async def reschedule_appointment(
    ctx: BrowserContext,
    location_id: str,
    appointment_id: str,
    new_slot_datetime: str,
) -> dict[str, Any]:
    # TODO: implementar con selectores reales
    log.info("booking.stub", action="reschedule", location_id=location_id, appointment_id=appointment_id)
    return {
        "status": "not_implemented",
        "reason": "awaiting_selectors",
        "action": "reschedule",
        "appointment_id": appointment_id,
        "new_slot": new_slot_datetime,
    }


async def cancel_appointment(
    ctx: BrowserContext,
    location_id: str,
    appointment_id: str,
) -> dict[str, Any]:
    # TODO: implementar con selectores reales
    log.info("booking.stub", action="cancel", location_id=location_id, appointment_id=appointment_id)
    return {
        "status": "not_implemented",
        "reason": "awaiting_selectors",
        "action": "cancel",
        "appointment_id": appointment_id,
    }
