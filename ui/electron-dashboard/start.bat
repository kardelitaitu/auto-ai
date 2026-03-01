@echo off
echo Starting Auto-AI Dashboard...
echo.
cd /d "%~dp0"

REM Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Electron is installed
npm list electron >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Electron is not installed
    echo Installing Electron...
    npm install
)

REM Start the dashboard
echo Starting dashboard...
echo.
echo If the dashboard doesn't appear, check:
echo 1. Auto-AI is running with dashboard enabled
echo 2. Port 3001 is available
echo 3. Firewall settings
echo.
echo Press Ctrl+C to stop the dashboard
echo.

REM Start Electron
./node_modules/.bin/electron .

pause