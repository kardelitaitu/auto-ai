@echo off
echo ========================================
echo   Auto-AI Dashboard Quick Start
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] Building React dashboard...
cd ui\electron-dashboard\renderer
call npm install >nul 2>&1
call npm run build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)
cd ..\..

echo.
echo [2/4] Installing Electron...
call npm install
if %errorlevel% neq 0 (
    echo Electron install failed!
    pause
    exit /b 1
)
cd ..

echo.
echo [3/4] Starting Electron app...
echo.
echo IMPORTANT: Ensure main.js is running first!
echo   - Dashboard server runs on http://localhost:3001
echo   - Electron app will connect via Socket.io
echo.

cd ui\electron-dashboard
call npx electron .

echo.
echo Electron closed.
pause
    exit /b 1
)
cd ..\..\..\

echo.
echo [3/3] Opening dashboard in browser...
echo.
echo NOTE: Make sure main.js is running with dashboard enabled!
echo Dashboard should be at: http://localhost:3001
echo.

start http://localhost:3001

echo Done! The dashboard should open in your browser.
echo If it doesn't, manually go to: http://localhost:3001
echo.
pause
