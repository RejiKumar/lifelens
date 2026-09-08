# syntax=docker/dockerfile:1
FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /uvx /bin/

WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY app ./app

RUN uv sync --no-dev --frozen

FROM python:3.13-slim AS runtime

WORKDIR /app
COPY --from=builder /app /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

RUN addgroup --system lifelens \
    && adduser --system --ingroup lifelens lifelens \
    && mkdir -p /app \
    && chown -R lifelens:lifelens /app

USER lifelens

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz')"

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]