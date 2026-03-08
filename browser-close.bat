@echo off
cd /d "%~dp0"

:CloseLoop
echo [LOG] Attempting to close chrome profiles (Method 1: API Soft Close)...

:: Step 1: Attempt graceful close via API (with 5s timeout)
powershell -Command "$urlList='http://127.0.0.1:53200/api/v2/profile-opened-list'; $urlClose='http://127.0.0.1:53200/api/v2/profile-close'; try { $listResp = Invoke-RestMethod -Uri $urlList -Method Post -Body '{}' -ContentType 'application/json' -TimeoutSec 5 -ErrorAction Stop; $profiles = $null; if ($listResp.data -is [array]) { $profiles = $listResp.data } elseif ($listResp.data -and $listResp.data.data) { $profiles = $listResp.data.data } elseif ($listResp.data -and $listResp.data.list) { $profiles = $listResp.data.list } elseif ($listResp -is [array]) { $profiles = $listResp }; if ($profiles) { foreach ($p in $profiles) { $id = $p.profile_id; if ($id) { Invoke-RestMethod -Uri $urlClose -Method Post -Body (@{profile_id=$id} | ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 5 -ErrorAction SilentlyContinue; Write-Host ('Closed Profile: ' + $id) } } } else { Write-Host 'No profiles open via API.' } } catch { Write-Host 'API not accessible or error.' }"

echo [LOG] Waiting for graceful shutdown...
timeout /t 2 /nobreak >nul

echo [LOG] Ensuring all processes are dead (Method 2: Forced Termination)...
tasklist /FI "IMAGENAME eq chrome.exe" 2>NUL | find /I /N "chrome.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [DETECTED] chrome.exe is still running. Terminating...
    taskkill /F /IM "chrome.exe" /T >NUL 2>&1
    timeout /t 1 /nobreak >nul
    echo [LOG] Checking again.
    goto :CloseLoop
)

echo [SUCCESS] All ixBrowser/chrome profiles and processes are closed.
timeout /t 2 /nobreak >nul
exit
