@echo off
:: Change to the script directory
cd /d "%~dp0"

:: Force Node.js to not use cached modules by setting a fresh working directory
:: This ensures all imports are re-evaluated
set NODE_OPTIONS=--no-warnings

:: Run with fresh module resolution
node main.js %*
