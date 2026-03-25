@echo off
SETLOCAL EnableDelayedExpansion

echo ===========================================
echo   Auto-AI Full Project Setup
echo ===========================================
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

:: Root Setup
echo [INFO] Step 1: Root directory setup...
if not exist "package.json" (
    echo [ERROR] package.json not found in the current directory.
    pause
    exit /b 1
)

:: Initialize root .env if it doesn't exist
if exist ".env.example" (
    if not exist ".env" (
        echo [INFO] Creating root .env from .env.example...
        copy ".env.example" ".env" >nul
    )
)

echo [INFO] Running npm install in root...
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Root npm install failed.
    pause
    exit /b 1
)

:: UI Dashboard Setup
echo.
echo [INFO] Step 2: UI Dashboard setup...
set "DASHBOARD_DIR=api\ui\electron-dashboard"

if exist "%DASHBOARD_DIR%" (
    pushd "%DASHBOARD_DIR%"
    
    if exist "package.json" (
        :: Initialize dashboard .env if it doesn't exist
        if exist ".env.example" (
            if not exist ".env" (
                echo [INFO] Creating dashboard .env from .env.example...
                copy ".env.example" ".env" >nul
            )
        )
        
        echo [INFO] Running npm install in !DASHBOARD_DIR!...
        call npm install
        if !ERRORLEVEL! neq 0 (
            echo [ERROR] Dashboard npm install failed.
            popd
            pause
            exit /b 1
        )
    ) else (
        echo [WARN] package.json not found in !DASHBOARD_DIR!. skipping install.
    )
    popd
) else (
    echo [WARN] Dashboard directory not found at !DASHBOARD_DIR!.
)

echo.
echo ===========================================
echo   Setup completed successfully!
echo ===========================================
echo.
pause
exit /b 0