@echo off
setlocal
cd /d "D:\RARK\AI Native\Projects\lifelens\backend"
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 > uvicorn.log 2>&1
endlocal