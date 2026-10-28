@echo off
echo Starting LifeLens backend (PROD)...
cd /d "%~dp0"
set APP_ENV=prod
set AI_PROVIDER=gemini
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
