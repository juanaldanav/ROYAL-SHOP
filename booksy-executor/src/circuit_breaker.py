"""
Circuit breaker por location_id en Redis.
Estados: CLOSED (normal) → OPEN (bloqueado 5min) → HALF_OPEN (prueba)
"""
import time
from enum import Enum

import redis.asyncio as aioredis
import structlog

from config import settings

log = structlog.get_logger()


class CBState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerOpen(Exception):
    def __init__(self, location_id: str, retry_after: int):
        self.location_id = location_id
        self.retry_after = retry_after
        super().__init__(f"Circuit breaker OPEN for {location_id}, retry in {retry_after}s")


class CircuitBreaker:
    def __init__(self, redis_client: aioredis.Redis):
        self._redis = redis_client
        self._threshold = settings.cb_failure_threshold
        self._window = settings.cb_window_seconds
        self._recovery = settings.cb_recovery_timeout

    def _keys(self, location_id: str) -> tuple[str, str, str]:
        base = f"booksy:cb:{location_id}"
        return f"{base}:failures", f"{base}:state", f"{base}:opened_at"

    async def check(self, location_id: str) -> None:
        """Raise CircuitBreakerOpen if circuit is OPEN."""
        _, state_key, opened_key = self._keys(location_id)

        state = await self._redis.get(state_key)
        if state == CBState.OPEN:
            opened_at = float(await self._redis.get(opened_key) or 0)
            elapsed = time.time() - opened_at
            if elapsed < self._recovery:
                retry_after = int(self._recovery - elapsed)
                raise CircuitBreakerOpen(location_id, retry_after)
            else:
                await self._redis.set(state_key, CBState.HALF_OPEN)

    async def record_success(self, location_id: str) -> None:
        failures_key, state_key, _ = self._keys(location_id)
        await self._redis.delete(failures_key)
        await self._redis.set(state_key, CBState.CLOSED)

    async def record_failure(self, location_id: str) -> None:
        failures_key, state_key, opened_key = self._keys(location_id)

        failures = await self._redis.incr(failures_key)
        if failures == 1:
            await self._redis.expire(failures_key, self._window)

        log.warning("circuit_breaker.failure", location_id=location_id, failures=failures, threshold=self._threshold)

        if failures >= self._threshold:
            await self._redis.set(state_key, CBState.OPEN)
            await self._redis.set(opened_key, str(time.time()))
            await self._redis.delete(failures_key)
            log.error("circuit_breaker.opened", location_id=location_id)
