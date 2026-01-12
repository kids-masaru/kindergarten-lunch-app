@echo off
cd /d %~dp0
echo Installing Backend Requirements...
pip install -r backend/requirements.txt
echo.
echo Starting Backend Server...
python -m uvicorn backend.main:app --reload --port 8001
pause
