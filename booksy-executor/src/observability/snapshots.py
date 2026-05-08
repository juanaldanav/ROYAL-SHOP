"""Guarda screenshot + HTML + URL cuando Playwright falla."""
import os
import time
from pathlib import Path

import structlog
from playwright.async_api import Page

from config import settings

log = structlog.get_logger()


async def save_failure_snapshot(page: Page, context: str = "") -> str:
    ts = int(time.time())
    snap_dir = Path(settings.failure_snapshots_dir) / str(ts)
    snap_dir.mkdir(parents=True, exist_ok=True)

    try:
        await page.screenshot(path=str(snap_dir / "screenshot.png"), full_page=True)
        content = await page.content()
        (snap_dir / "page.html").write_text(content, encoding="utf-8")
        (snap_dir / "meta.txt").write_text(
            f"url={page.url}\ncontext={context}\ntimestamp={ts}\n",
            encoding="utf-8",
        )
        log.info("snapshot.saved", path=str(snap_dir), url=page.url)
    except Exception as e:
        log.warning("snapshot.failed", error=str(e))

    return str(snap_dir)
