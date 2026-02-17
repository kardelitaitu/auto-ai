@echo off
SETLOCAL EnableDelayedExpansion

echo ==========================================
echo   Auto-AI Setup Script
echo ==========================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check for npm
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not installed. npm is usually bundled with Node.js.
    pause
    exit /b 1
)

:: Check for package.json
if not exist "package.json" (
    echo [ERROR] package.json not found in the current directory.
    pause
    exit /b 1
)

echo [INFO] Found package.json. Starting npm install...
echo.

call npm install

if %ERRORLEVEL% equ 0 (
    echo.
    echo ==========================================
    echo   Setup completed successfully!
    echo ==========================================
) else (
    echo.
    echo [ERROR] npm install failed. Please check the logs above.
)

echo.
exit