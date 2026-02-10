@echo off
cd /d "%~dp0"

SET START_ID=1999
SET END_ID=2000

echo Opening profiles %START_ID% to %END_ID%...

FOR /L %%i IN (%START_ID%,1,%END_ID%) DO (
    echo Opening Profile ID %%i...
    powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://127.0.0.1:53200/api/v2/profile-open' -Method Post -Body (@{profile_id=%%i} | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop; if ($response.error.code -eq 0) { Write-Host 'Success' } else { Write-Error ('Failed: ' + $response.error.message) } } catch { Write-Error $_ }"
)
echo Waiting 10 seconds for browser startup...
timeout /t 10 /nobreak >nul
echo Done. Closing . .
timeout /t 1 /nobreak >nul
exit