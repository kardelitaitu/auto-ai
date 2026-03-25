@echo off
SETLOCAL EnableDelayedExpansion

echo ===========================================
echo   Auto-AI Full Project Setup
echo ===========================================
echo.

:: Kill any running node processes to avoid lock issues
echo [INFO] Killing any running node processes...
taskkill /F /IM node.exe >nul 2>nul
timeout /t 2 /nobreak >nul

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

:: Enable corepack for pnpm
echo [INFO] Enabling corepack for pnpm...
call corepack enable

:: Clean existing node_modules to avoid lock issues
echo [INFO] Cleaning existing node_modules...
if exist "node_modules" (
    rmdir /s /q "node_modules" 2>nul
)
if exist "pnpm-lock.yaml" (
    del /f /q "pnpm-lock.yaml" 2>nul
)

:: Initialize root .env if it doesn't exist
if exist ".env-example" (
    if not exist ".env" (
        echo [INFO] Creating root .env from .env-example...
        copy ".env-example" ".env" >nul
    )
)

echo [INFO] Running pnpm install in root...
call pnpm install --force
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Root pnpm install failed.
    pause
    exit /b 1
)

:: UI Dashboard Setup
echo.
echo [INFO] Step 2: UI Dashboard setup...
set "DASHBOARD_DIR=api\ui\electron-dashboard"

if exist "%DASHBOARD_DIR%" (
    pushd "%DASHBOARD_DIR%"
    
    :: Clean existing node_modules in dashboard
    if exist "node_modules" (
        rmdir /s /q "node_modules" 2>nul
    )
    if exist "pnpm-lock.yaml" (
        del /f /q "pnpm-lock.yaml" 2>nul
    )
    
    if exist "package.json" (
        :: Initialize dashboard .env if it doesn't exist
        if exist ".env-example" (
            if not exist ".env" (
                echo [INFO] Creating dashboard .env from .env-example...
                copy ".env-example" ".env" >nul
            )
        )
        
        echo [INFO] Running pnpm install in !DASHBOARD_DIR!...
        call pnpm install --force
        if !ERRORLEVEL! neq 0 (
            echo [ERROR] Dashboard pnpm install failed.
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
exit /b 0