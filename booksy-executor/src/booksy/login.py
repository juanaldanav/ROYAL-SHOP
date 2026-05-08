"""Login a Booksy con persistent context. Solo hace login si la sesión expiró."""
import structlog
from playwright.async_api import BrowserContext

from booksy.selectors import find_with_fallback
from booksy.browser import save_session
from observability.snapshots import save_failure_snapshot

log = structlog.get_logger()

BOOKSY_URL = "https://booksy.com"
LOGIN_URL = "https://booksy.com/en-us/authentication/login"


async def ensure_logged_in(ctx: BrowserContext, location_id: str, username: str, password: str) -> None:
    """Verifica sesión activa; si no, hace login completo."""
    page = await ctx.new_page()
    try:
        # Intenta ir al dashboard de la cuenta
        await page.goto(f"{BOOKSY_URL}/biz/dashboard", wait_until="networkidle", timeout=30000)

        # Si redirige a login, la sesión expiró
        if "login" in page.url or "authentication" in page.url:
            log.info("login.session_expired", location_id=location_id)
            await _do_login(page, location_id, username, password)
        else:
            log.info("login.session_valid", location_id=location_id)
    except Exception as e:
        await save_failure_snapshot(page, context=f"ensure_logged_in:{location_id}")
        raise
    finally:
        await page.close()


async def _do_login(page, location_id: str, username: str, password: str) -> None:
    log.info("login.starting", location_id=location_id)
    await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)

    email_field = await find_with_fallback(page, "login_email")
    await email_field.fill(username)

    pwd_field = await find_with_fallback(page, "login_password")
    await pwd_field.fill(password)

    login_btn = await find_with_fallback(page, "login_button")
    await login_btn.click()

    # Esperar navegación post-login
    await page.wait_for_url("**/dashboard**", timeout=15000)
    log.info("login.success", location_id=location_id)

    # Persistir sesión
    await save_session(location_id)
