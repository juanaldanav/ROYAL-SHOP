"""Smoke tests — no requieren Playwright ni Redis reales."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient


@pytest.fixture
def mock_app():
    """App con redis y circuit_breaker mockeados."""
    with patch("redis.asyncio.from_url") as mock_redis:
        mock_redis.return_value = AsyncMock()
        from main import app

        app.state.redis = AsyncMock()
        app.state.circuit_breaker = AsyncMock()

        # Mock browser state
        import booksy.browser as bm
        bm._browser = None

        yield app


def test_health_returns_200(mock_app):
    with TestClient(mock_app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "browser_ready" in data


def test_availability_stub_returns_not_implemented(mock_app):
    """Verifica que el stub retorna la estructura esperada."""
    with patch("booksy.browser.get_context", new_callable=AsyncMock) as mock_ctx, \
         patch("booksy.availability.get_availability", new_callable=AsyncMock) as mock_avail:

        mock_avail.return_value = {
            "status": "not_implemented",
            "reason": "awaiting_selectors",
            "slots": [],
        }
        mock_app.state.circuit_breaker.check = AsyncMock()
        mock_app.state.circuit_breaker.record_success = AsyncMock()

        with TestClient(mock_app) as client:
            response = client.get(
                "/availability",
                params={
                    "location": "1",
                    "service": "Corte",
                    "date_from": "2026-05-10T10:00:00",
                    "date_to": "2026-05-10T18:00:00",
                }
            )

        assert response.status_code == 200
        assert response.json()["status"] == "not_implemented"


def test_unknown_location_returns_400(mock_app):
    with TestClient(mock_app) as client:
        response = client.get(
            "/availability",
            params={
                "location": "99",
                "service": "Corte",
                "date_from": "2026-05-10T10:00:00",
                "date_to": "2026-05-10T18:00:00",
            }
        )
    assert response.status_code == 400
