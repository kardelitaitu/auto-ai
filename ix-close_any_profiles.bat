@echo off
cd /d "%~dp0"

echo Fetching opened profiles and closing them...

powershell -Command "$urlList = 'http://127.0.0.1:53200/api/v2/profile-opened-list'; $urlClose = 'http://127.0.0.1:53200/api/v2/profile-close'; try { $listResp = Invoke-RestMethod -Uri $urlList -Method Post -Body '{}' -ContentType 'application/json' -ErrorAction Stop; $profiles = $null; if ($listResp.data -is [array]) { $profiles = $listResp.data } elseif ($listResp.data -and $listResp.data.data) { $profiles = $listResp.data.data } elseif ($listResp.data -and $listResp.data.list) { $profiles = $listResp.data.list } elseif ($listResp -is [array]) { $profiles = $listResp }; if ($profiles) { Write-Host ('Found ' + $profiles.Count + ' opened profiles.'); foreach ($p in $profiles) { $id = $p.profile_id; if ($id) { Write-Host ('Closing Profile ' + $id + '...'); try { $closeResp = Invoke-RestMethod -Uri $urlClose -Method Post -Body (@{profile_id=$id} | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop; if ($closeResp.error.code -eq 0) { Write-Host 'Success' } else { Write-Error ('Failed: ' + $closeResp.error.message) } } catch { Write-Error $_ }; Start-Sleep -Seconds 2 } } } else { Write-Host 'No opened profiles found.' } } catch { Write-Error $_ }"

echo Done.
