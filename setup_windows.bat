@echo off
SETLOCAL EnableDelayedExpansion

echo ===========================================
echo   Auto-AI Full Project Setup
echo ===========================================
echo.

:: Kill any running node processes
echo [INFO] Killing any running node processes...
taskkill /F /IM node.exe >nul 2>nul

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed.
    pause
    exit /b 1
)

:: Check for npm
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not installed.
    pause
    exit /b 1
)

:: Root Setup
echo [INFO] Step 1: Root directory setup

if not exist "package.json" (
    echo [ERROR] package.json not found.
    pause
    exit /b 1
)

:: Enable corepack for pnpm
echo [INFO] Enabling corepack for pnpm
call corepack enable

:: Clean existing node_modules
echo [INFO] Cleaning existing node_modules
if exist "node_modules" rmdir /s /q "node_modules"
if exist "pnpm-lock.yaml" del /f /q "pnpm-lock.yaml"

:: Initialize root .env if it doesn't exist
if exist ".env-example" (
    if not exist ".env" (
        echo [INFO] Creating root .env from .env-example
        copy ".env-example" ".env" >nul
    )
)

echo [INFO] Running pnpm install in root (skipping prepare script)
call pnpm install --force --ignore-scripts
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Root pnpm install failed.
    pause
    exit /b 1
)

:: Run husky install manually
echo [INFO] Setting up husky git hooks
call npx husky install
if %ERRORLEVEL% neq 0 (
    echo [WARN] Husky setup failed. Git hooks will not be installed.
) else (
    echo [INFO] Husky git hooks installed successfully.
)

:: UI Dashboard Setup
echo.
echo [INFO] Step 2: UI Dashboard setup
call :setup_dashboard

echo.
echo ===========================================
echo   Setup completed successfully
echo ===========================================
echo.
exit /b 0

:setup_dashboard
if not exist "api\ui\electron-dashboard" (
    echo [WARN] Dashboard directory not found
    exit /b 0
)

pushd "api\ui\electron-dashboard"

if exist "node_modules" rmdir /s /q "node_modules"
if exist "pnpm-lock.yaml" del /f /q "pnpm-lock.yaml"

if exist "package.json" (
    if exist ".env-example" (
        if not exist ".env" (
            echo [INFO] Creating dashboard .env from .env-example
            copy ".env-example" ".env" >nul
        )
    )
    
    echo [INFO] Running pnpm install in dashboard
    call pnpm install --force --ignore-scripts
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Dashboard pnpm install failed.
        popd
        exit /b 1
    )
) else (
    echo [WARN] package.json not found in dashboard
)

popd
exit /b 0
