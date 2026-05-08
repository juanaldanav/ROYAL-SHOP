from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from api.schemas import (
    AvailabilityRequest,
    BookRequest,
    CancelRequest,
    HealthResponse,
    RescheduleRequest,
)
from booksy import availability as avail_mod
from booksy import booking as booking_mod
from booksy import browser as browser_mod
from circuit_breaker import CircuitBreaker, CircuitBreakerOpen
from config import settings

import structlog
import redis.asyncio as aioredis

log = structlog.get_logger()
router = APIRouter()

# Redis y circuit breaker se inyectan desde main.py via app.state
_redis: aioredis.Redis = None
_cb: CircuitBreaker = None


def _location_credentials(location: str) -> tuple[str, str, str]:
    """Retorna (username, password, location_id) según el número de sucursal."""
    if location == "1":
        return settings.booksy_username_suc1, settings.booksy_password_suc1, settings.booksy_location_id_suc1
    elif location == "2":
        return settings.booksy_username_suc2, settings.booksy_password_suc2, settings.booksy_location_id_suc2
    else:
        raise HTTPException(status_code=400, detail=f"Unknown location: {location}")


@router.get("/health", response_model=HealthResponse)
async def health():
    from main import app
    redis_client = app.state.redis
    cb = app.state.circuit_breaker

    browser_ok = False
    try:
        b = browser_mod._browser
        browser_ok = b is not None and b.is_connected()
    except Exception:
        pass

    return {
        "status": "ok",
        "browser_ready": browser_ok,
        "circuit_breakers": {},
    }


@router.get("/availability")
async def get_availability(location: str, service: str, date_from: str, date_to: str):
    from main import app
    _, _, loc_id = _location_credentials(location)

    try:
        await app.state.circuit_breaker.check(loc_id)
        ctx = await browser_mod.get_context(loc_id)
        from datetime import datetime
        result = await avail_mod.get_availability(
            ctx, loc_id, service,
            datetime.fromisoformat(date_from),
            datetime.fromisoformat(date_to),
        )
        await app.state.circuit_breaker.record_success(loc_id)
        return result
    except CircuitBreakerOpen as e:
        raise HTTPException(status_code=503, detail=f"Service temporarily unavailable. Retry in {e.retry_after}s")
    except Exception as e:
        await app.state.circuit_breaker.record_failure(loc_id)
        log.error("availability.error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/book")
async def book(req: BookRequest):
    from main import app
    username, password, loc_id = _location_credentials(req.location)

    try:
        await app.state.circuit_breaker.check(loc_id)
        ctx = await browser_mod.get_context(loc_id)
        result = await booking_mod.book_appointment(
            ctx, loc_id, req.service, req.slot_datetime, req.client_name, req.client_phone
        )
        await app.state.circuit_breaker.record_success(loc_id)
        return result
    except CircuitBreakerOpen as e:
        raise HTTPException(status_code=503, detail=f"Service temporarily unavailable. Retry in {e.retry_after}s")
    except Exception as e:
        await app.state.circuit_breaker.record_failure(loc_id)
        log.error("book.error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reschedule")
async def reschedule(req: RescheduleRequest):
    from main import app
    _, _, loc_id = _location_credentials(req.location)

    try:
        await app.state.circuit_breaker.check(loc_id)
        ctx = await browser_mod.get_context(loc_id)
        result = await booking_mod.reschedule_appointment(ctx, loc_id, req.appointment_id, req.new_slot_datetime)
        await app.state.circuit_breaker.record_success(loc_id)
        return result
    except CircuitBreakerOpen as e:
        raise HTTPException(status_code=503, detail=f"Service temporarily unavailable. Retry in {e.retry_after}s")
    except Exception as e:
        await app.state.circuit_breaker.record_failure(loc_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cancel")
async def cancel(req: CancelRequest):
    from main import app
    _, _, loc_id = _location_credentials(req.location)

    try:
        await app.state.circuit_breaker.check(loc_id)
        ctx = await browser_mod.get_context(loc_id)
        result = await booking_mod.cancel_appointment(ctx, loc_id, req.appointment_id)
        await app.state.circuit_breaker.record_success(loc_id)
        return result
    except CircuitBreakerOpen as e:
        raise HTTPException(status_code=503, detail=f"Service temporarily unavailable. Retry in {e.retry_after}s")
    except Exception as e:
        await app.state.circuit_breaker.record_failure(loc_id)
        raise HTTPException(status_code=500, detail=str(e))
