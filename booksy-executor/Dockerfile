# Multi-stage: build deps, then runtime with Playwright
# Base: microsoft/playwright python:v1.59.0-jammy (Python 3.12, Ubuntu 22.04)

FROM mcr.microsoft.com/playwright/python:v1.59.0-jammy AS base

WORKDIR /app

# uv para gestión de dependencias
COPY --from=ghcr.io/astral-sh/uv:0.7.3 /uv /uvx /usr/local/bin/

# Dependencias primero (cache layer)
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev

FROM base AS runtime

WORKDIR /app

# Instalar solo browser Chromium (más liviano que todos)
RUN playwright install chromium --with-deps

COPY --from=base /app/.venv .venv
COPY src/ src/

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/src"
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# storage_state persistido como volumen
RUN mkdir -p /app/storage_state/sessions /app/storage_state/failures

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
