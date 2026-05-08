"""
Browser singleton con persistent context por sucursal.
Lazy-init, mutex por location para evitar race conditions.
"""
import asyncio
from pathlib import Path
from typing import Optional

import structlog
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from config import settings

log = structlog.get_logger()

# Un lock por location_id para serializar acceso concurrente
_locks: dict[str, asyncio.Lock] = {}
_contexts: dict[str, BrowserContext] = {}
_browser: Optional[Browser] = None
_playwright = None


async def _get_browser() -> Browser:
    global _browser, _playwright
    if _browser and _browser.is_connected():
        return _browser

    log.info("browser.launching")
    _playwright = await async_playwright().start()
    _browser = await _playwright.chromium.launch(
        headless=settings.headless,
        args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
        ],
    )
    log.info("browser.launched")
    return _browser


def _storage_path(location_id: str) -> str:
    p = Path(settings.storage_state_dir) / f"session_{location_id}.json"
    return str(p)


async def get_context(location_id: str) -> BrowserContext:
    """Retorna (o crea) el contexto persistente para una sucursal."""
    if location_id not in _locks:
        _locks[location_id] = asyncio.Lock()

    async with _locks[location_id]:
        if location_id in _contexts:
            ctx = _contexts[location_id]
            # Verificar que el contexto sigue vivo
            try:
                _ = ctx.pages
                return ctx
            except Exception:
                log.warning("context.stale", location_id=location_id)
                del _contexts[location_id]

        browser = await _get_browser()
        storage_path = _storage_path(location_id)

        ctx_kwargs: dict = {
            "viewport": {"width": 1280, "height": 800},
            "user_agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/136.0.0.0 Safari/537.36"
            ),
            "locale": "es-MX",
            "timezone_id": settings.barbershop_timezone,
        }

        if Path(storage_path).exists():
            log.info("context.restoring_session", location_id=location_id)
            ctx_kwargs["storage_state"] = storage_path
        else:
            log.info("context.new_session", location_id=location_id)

        ctx = await browser.new_context(**ctx_kwargs)

        # Anti-detección básica
        await ctx.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        """)

        _contexts[location_id] = ctx
        log.info("context.ready", location_id=location_id)
        return ctx


async def save_session(location_id: str) -> None:
    """Persiste el estado de la sesión (cookies + localStorage) al disco."""
    if location_id not in _contexts:
        return
    ctx = _contexts[location_id]
    storage_path = _storage_path(location_id)
    Path(storage_path).parent.mkdir(parents=True, exist_ok=True)
    await ctx.storage_state(path=storage_path)
    log.info("session.saved", location_id=location_id, path=storage_path)


async def close_all() -> None:
    global _browser, _playwright
    for loc_id in list(_contexts.keys()):
        try:
            await save_session(loc_id)
            await _contexts[loc_id].close()
        except Exception:
            pass
    _contexts.clear()
    if _browser:
        await _browser.close()
    if _playwright:
        await _playwright.stop()
    log.info("browser.closed")
