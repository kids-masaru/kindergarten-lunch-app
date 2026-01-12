@echo off
cd /d %~dp0frontend
echo Installing Frontend Dependencies...
call npm install
echo.
echo Starting Frontend Server...
npm run dev
pause
