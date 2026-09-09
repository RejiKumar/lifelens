web: cd backend && uv run alembic upgrade head 2>/dev/null; uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
