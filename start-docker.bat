@echo off
echo Starting Docker LLM Server (GGUF/llama.cpp)...

:: Check if container already exists and start it
docker start docker-model-server >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo Container docker-model-server started.
    exit /b 0
)

:: Run new container if not exists
echo Creating and running new Docker container (llama.cpp)...
:: -------------------------------------------------------------------------
:: CONFIGURATION FOR GGUF MODELS
:: 1. Place your .gguf model files in a folder (e.g., C:\AiModels)
:: 2. Update the -v mapping below: -v "C:\AiModels:/models"
:: 3. Update the -m argument to point to the file inside the container: -m /models/my-model.gguf
::
:: Current settings:
:: - Port: 12434 (Host) -> 8080 (Container default)
:: - GPU: All
:: -------------------------------------------------------------------------

docker run -d --gpus all --name docker-model-server ^
    --restart always ^
    -v "%USERPROFILE%/.cache/huggingface:/models" ^
    -p 12434:8080 ^
    ghcr.io/ggerganov/llama.cpp:server-cuda ^
    -m /models/qwen2.5-7b-instruct-q4_k_m.gguf ^
    --host 0.0.0.0 ^
    --port 8080 ^
    --n-gpu-layers 99 ^
    --ctx-size 8192

if %ERRORLEVEL% neq 0 (
    echo Failed to start Docker container.
    exit /b 1
)

echo Docker Container Launched.
echo Waiting for API to be ready...

set seconds=0
:wait_loop
timeout /t 5 >nul
set /a seconds+=5
curl -s -f http://127.0.0.1:12434/health >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ... Still loading ... [Elapsed: ~%seconds%s]
    goto wait_loop
)

echo.
echo =============================================
echo   SERVER IS READY (GGUF Backend)
echo =============================================
echo.
