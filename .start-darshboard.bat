@echo off
setlocal
cd /d "%~dp0"

echo [1/2] Building UI Dashboard Frontend...
cd "api/ui/electron-dashboard/renderer"
call npm run build

echo.
echo [2/2] Launching Electron Dashboard...
cd ".."
call npm start

pause
