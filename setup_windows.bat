@echo off
SETLOCAL EnableDelayedExpansion

echo ===========================================
echo   Auto-AI Full Project Setup
echo ===========================================
echo.

:: ============================================================================
:: Configuration
:: ============================================================================
set "MIN_NODE_VERSION=16.0.0"
set "SETUP_LOG=setup_log.txt"

:: Start logging
echo Setup started at %DATE% %TIME% > "%SETUP_LOG%"

:: ============================================================================
:: Pre-flight Checks
:: ============================================================================
echo [INFO] Running pre-flight checks...

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed. Download from https://nodejs.org/
    echo [ERROR] Node.js not installed >> "%SETUP_LOG%"
    pause
    exit /b 1
)

:: Get Node.js version
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [INFO] Node.js version: %NODE_VERSION%

:: Check Node.js major version (v16+)
for /f "tokens=1 delims=." %%a in ("%NODE_VERSION:v=%") do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 16 (
    echo [ERROR] Node.js version %NODE_VERSION% is too old. Minimum required: v%MIN_NODE_VERSION%
    pause
    exit /b 1
)

:: Check for npm
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not installed. It should come with Node.js.
    pause
    exit /b 1
)

:: Check for Python (required for node-gyp)
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    where python3 >nul 2>nul
    if %ERRORLEVEL% neq 0 (
        echo [WARN] Python not found. Native module compilation may fail.
        echo [WARN] Install Python 3.x from https://python.org/ or Microsoft Store
    ) else (
        echo [INFO] Python 3 found
    )
) else (
    echo [INFO] Python found
)

:: Check for Visual Studio Build Tools (required for native addons)
where cl >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARN] Visual Studio Build Tools not detected in PATH.
    echo [WARN] If native module compilation fails, install:
    echo [WARN]   npm install --global windows-build-tools
    echo [WARN]   OR download Visual Studio Build Tools from Microsoft
)

:: Check for package.json
if not exist "package.json" (
    echo [ERROR] package.json not found. Are you in the correct directory?
    echo [ERROR] Current directory: %CD%
    pause
    exit /b 1
)

:: Check disk space (minimum 1GB free)
for /f "tokens=3" %%a in ('dir /-c 2^>nul ^| find "bytes free"') do set FREE_SPACE=%%a
if defined FREE_SPACE (
    if %FREE_SPACE% LSS 1073741824 (
        echo [WARN] Low disk space detected. Setup may fail.
    )
)

:: ============================================================================
:: Kill Running Processes
:: ============================================================================
echo.
echo [INFO] Stopping any running node processes...
taskkill /F /IM node.exe >nul 2>nul
taskkill /F /IM electron.exe >nul 2>nul
timeout /t 2 /nobreak >nul

:: ============================================================================
:: Root Setup
:: ============================================================================
echo.
echo [INFO] Step 1: Root directory setup

:: Enable corepack for pnpm
echo [INFO] Enabling corepack for pnpm...
call corepack enable 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARN] Corepack enable failed. Installing pnpm globally...
    call npm install -g pnpm
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install pnpm. Please install manually: npm install -g pnpm
        pause
        exit /b 1
    )
)

:: Backup existing .env before cleanup
if exist ".env" (
    echo [INFO] Backing up existing .env to .env.backup
    copy /y ".env" ".env.backup" >nul
)

:: Clean existing node_modules (preserve .env.backup)
echo [INFO] Cleaning existing node_modules...
if exist "node_modules" rmdir /s /q "node_modules"
if exist "pnpm-lock.yaml" del /f /q "pnpm-lock.yaml"

:: Initialize root .env if it doesn't exist
if exist ".env-example" (
    if not exist ".env" (
        echo [INFO] Creating root .env from .env-example
        copy ".env-example" ".env" >nul
    ) else (
        echo [INFO] .env already exists, preserving existing configuration
    )
) else if exist ".env.backup" (
    echo [INFO] Restoring .env from backup
    copy /y ".env.backup" ".env" >nul
)

:: Install dependencies
echo [INFO] Running pnpm install (this may take a few minutes)...
call pnpm install --force --ignore-scripts >> "%SETUP_LOG%" 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] pnpm install failed. Check %SETUP_LOG% for details.
    echo [INFO] Trying npm install as fallback...
    call npm install --force --ignore-scripts >> "%SETUP_LOG%" 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Both pnpm and npm install failed.
        echo [ERROR] Common fixes:
        echo [ERROR]   1. Check internet connection
        echo [ERROR]   2. Clear npm cache: npm cache clean --force
        echo [ERROR]   3. Delete node_modules manually and retry
        pause
        exit /b 1
    )
)

:: ============================================================================
:: Native Module Rebuild
:: ============================================================================
echo.
echo [INFO] Step 2: Rebuilding native modules

:: Check if better-sqlite3 is in dependencies
findstr /C:"better-sqlite3" package.json >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [INFO] Rebuilding better-sqlite3 native module...

    :: Try npm rebuild first (more reliable on Windows)
    call npm rebuild better-sqlite3 >> "%SETUP_LOG%" 2>&1
    set REBUILD_RC=!ERRORLEVEL!
    if !REBUILD_RC! neq 0 (
        echo [WARN] npm rebuild failed, trying pnpm rebuild...
        call pnpm rebuild better-sqlite3 >> "%SETUP_LOG%" 2>&1
        set REBUILD_RC=!ERRORLEVEL!
    )

    :: Verify native bindings exist (check both flat and pnpm layouts)
    set BINDING_FOUND=0
    if exist "node_modules\better-sqlite3\build\Release\better_sqlite3.node" set BINDING_FOUND=1
    if exist "node_modules\better-sqlite3\build\Release" (
        dir /b "node_modules\better-sqlite3\build\Release\*.node" >nul 2>nul
        if !ERRORLEVEL! equ 0 set BINDING_FOUND=1
    )

    if !BINDING_FOUND! equ 1 (
        echo [SUCCESS] better-sqlite3 native module compiled successfully
    ) else (
        echo [ERROR] better-sqlite3 native module compilation FAILED
        echo [ERROR] This usually means missing build tools.
        echo.
        echo [INFO] To fix this issue, run ONE of these commands as Administrator:
        echo [INFO]   Option 1: npm install --global windows-build-tools
        echo [INFO]   Option 2: Install Visual Studio Build Tools from Microsoft
        echo [INFO]   Option 3: choco install python visualstudio2019buildtools -y
        echo.
        echo [INFO] After installing build tools, run this script again.
    )
) else (
    echo [INFO] better-sqlite3 not found in dependencies, skipping rebuild
)

:: Rebuild other native modules if present
for %%m in (sharp) do (
    findstr /C:"%%m" package.json >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        echo [INFO] Rebuilding %%m...
        call npm rebuild %%m >> "%SETUP_LOG%" 2>nul
    )
)

:: ============================================================================
:: Git Hooks Setup
:: ============================================================================
echo.
echo [INFO] Step 3: Setting up git hooks...

:: Check if in git repository
git rev-parse --git-dir >nul 2>nul
if %ERRORLEVEL% equ 0 (
    call npx husky install >> "%SETUP_LOG%" 2>nul
    if %ERRORLEVEL% neq 0 (
        echo [WARN] Husky setup failed. Git hooks will not be installed.
        echo [WARN] This is not critical for basic functionality.
    ) else (
        echo [SUCCESS] Git hooks installed successfully
    )
) else (
    echo [INFO] Not a git repository, skipping husky setup
)

:: ============================================================================
:: UI Dashboard Setup
:: ============================================================================
echo.
echo [INFO] Step 4: UI Dashboard setup
call :setup_dashboard

:: ============================================================================
:: Verification
:: ============================================================================
echo.
echo [INFO] Step 5: Verifying installation...

:: Test basic node execution
node -e "console.log('Node.js is working')" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js execution test failed
    pause
    exit /b 1
)

:: Test if main modules can be loaded
node -e "import('./api/index.js').then(() => console.log('OK')).catch(e => process.exit(1))" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARN] Module loading test failed. There may be dependency issues.
    echo [WARN] Try running: pnpm install
) else (
    echo [SUCCESS] Core modules load successfully
)

:: ============================================================================
:: Summary
:: ============================================================================
echo.
echo ===========================================
echo   Setup completed
echo ===========================================
echo.
echo Log file: %SETUP_LOG%
echo.
echo Next steps:
echo   1. Edit .env file with your API keys
echo   2. Start browsers with remote debugging enabled
echo   3. Run: node main.js pageview
echo.
echo For issues, check the log file or run:
echo   pnpm install
echo   npm rebuild better-sqlite3
echo.
exit /b 0

:: ============================================================================
:: Dashboard Setup Function
:: ============================================================================
:setup_dashboard
if not exist "api\ui\electron-dashboard" (
    echo [INFO] Dashboard directory not found, skipping
    exit /b 0
)

pushd "api\ui\electron-dashboard" 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARN] Cannot access dashboard directory
    exit /b 0
)

echo [INFO] Setting up dashboard...

:: Backup dashboard .env
if exist ".env" (
    copy /y ".env" ".env.backup" >nul 2>nul
)

if exist "node_modules" rmdir /s /q "node_modules"
if exist "pnpm-lock.yaml" del /f /q "pnpm-lock.yaml"

if exist "package.json" (
    if exist ".env-example" (
        if not exist ".env" (
            echo [INFO] Creating dashboard .env from .env-example
            copy ".env-example" ".env" >nul
        ) else (
            echo [INFO] Dashboard .env exists, preserving configuration
        )
    ) else if exist ".env.backup" (
        copy /y ".env.backup" ".env" >nul 2>nul
    )
    
    echo [INFO] Installing dashboard dependencies...
    call pnpm install --force --ignore-scripts >> "%SETUP_LOG%" 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [WARN] Dashboard pnpm install failed, trying npm...
        call npm install --force --ignore-scripts >> "%SETUP_LOG%" 2>&1
    )
    
    :: Rebuild native modules if present
    if exist "node_modules\better-sqlite3" (
        echo [INFO] Rebuilding dashboard native modules...
        call npm rebuild better-sqlite3 >> "%SETUP_LOG%" 2>nul
    )
    
    echo [SUCCESS] Dashboard setup complete
) else (
    echo [WARN] Dashboard package.json not found
)

popd
exit /b 0