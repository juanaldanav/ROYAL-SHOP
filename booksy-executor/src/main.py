from contextlib import asynccontextmanager

import redis.asyncio as aioredis
import structlog
from fastapi import FastAPI

from api.routes import router
from booksy.browser import close_all as close_browser
from circuit_breaker import CircuitBreaker
from config import settings
from observability.logger import configure_logging

configure_logging()
log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("startup.begin", port=settings.port)

    app.state.redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    app.state.circuit_breaker = CircuitBreaker(app.state.redis)

    log.info("startup.complete")
    yield

    log.info("shutdown.begin")
    await close_browser()
    await app.state.redis.aclose()
    log.info("shutdown.complete")


app = FastAPI(
    title="Booksy Executor",
    description="Playwright automation for Booksy scheduling",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(router)
