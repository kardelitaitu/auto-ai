@echo off
title OpenCode Context-Mode Hook Injector
echo ===================================================
echo Initiating OpenCode Hooks for Context-Mode...
echo ===================================================
echo.

echo [1/3] Injecting PreToolUse hook...
call npx -y context-mode hook opencode pretooluse
if %errorlevel% neq 0 (
    echo [ERROR] Failed to inject PreToolUse hook.
) else (
    echo [SUCCESS] PreToolUse hook active.
)
echo.

echo [2/3] Injecting PostToolUse hook...
call npx -y context-mode hook opencode posttooluse
if %errorlevel% neq 0 (
    echo [ERROR] Failed to inject PostToolUse hook.
) else (
    echo [SUCCESS] PostToolUse hook active.
)
echo.

echo [3/3] Injecting SessionStart hook...
call npx -y context-mode hook opencode sessionstart
if %errorlevel% neq 0 (
    echo [ERROR] Failed to inject SessionStart hook.
) else (
    echo [SUCCESS] SessionStart hook active.
)
echo.

echo ===================================================
echo Initialization complete. Session hygiene enforced.
echo ===================================================
pause