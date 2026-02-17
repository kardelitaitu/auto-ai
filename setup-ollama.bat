@echo off
setlocal EnableDelayedExpansion

:: ==========================================================
:: 1. AUTO-ELEVATION (Ask for Admin Rights)
:: ==========================================================
NET SESSION >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Requesting Administrator privileges for Winget...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
echo [INFO] Running with Admin privileges.

:: ==========================================================
:: 2. INSTALL OLLAMA VIA WINGET
:: ==========================================================
echo [1/2] Installing Ollama via Winget...

:: Check if already installed to avoid error spam
winget list -e --id Ollama.Ollama >nul 2>&1
if %errorLevel% equ 0 (
    echo [INFO] Ollama is already installed.
) else (
    winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements
    if %errorLevel% neq 0 (
        echo [ERROR] Winget installation failed.
        pause
        exit /b
    )
)

echo [INFO] Waiting for installation to finalize...
timeout /t 5 /nobreak >nul

:: ==========================================================
:: 3. PULL MODEL (Handle Path Refresh)
:: ==========================================================
echo [2/2] Pulling model 'hermes3:8b'...

:: Try running ollama directly. 
:: If it fails (because PATH isn't updated in this session), try the default install path.
ollama --version >nul 2>&1
if %errorLevel% equ 0 (
    ollama pull hermes3:8b
) else (
    echo [WARN] 'ollama' command not found in current PATH (common after fresh install).
    echo [INFO] Attempting to run from Local AppData...
    
    :: Try default install location
    "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" pull hermes3:8b
    
    if %errorLevel% neq 0 (
        echo.
        echo [ERROR] Could not find Ollama executable. 
        echo Please close this window and open a new terminal to finish setting up.
        pause
        exit /b
    )
)

echo.
echo ========================================================
echo  [SUCCESS] Setup complete!
echo  You can now run: ollama run hermes3:8b
echo ========================================================
pause