<#
.SYNOPSIS
Enforces strict memory and processor boundaries on the WSL2 subsystem.

.DESCRIPTION
Writes a global .wslconfig file to the user profile to prevent vmmemWSL memory ballooning.
Limits WSL to 16GB RAM and flushes the current subsystem state.
#>

$WslConfigPath = Join-Path $env:USERPROFILE ".wslconfig"

Write-Host "[INIT] Auditing WSL boundary configuration..." -ForegroundColor Cyan

# The Configuration Payload
# memory=16GB: Hard clamps the vmmemWSL process.
# swap=0: Disables WSL swap to prevent unnecessary writes to your NVMe drives.
$ConfigContent = @"
[wsl2]
memory=16GB
swap=0
"@

try {
    # Injecting the constraints
    Set-Content -Path $WslConfigPath -Value $ConfigContent -Force
    Write-Host "[SUCCESS] Constraints mapped to: $WslConfigPath" -ForegroundColor Green
    
    Write-Host "[EXECUTION] Purging WSL subsystem to flush the 43GB cache..." -ForegroundColor Yellow
    
    # Forcefully shutting down WSL to apply the new architecture
    wsl --shutdown
    
    Write-Host "[RESOLVED] vmmemWSL process killed. System memory reclaimed." -ForegroundColor Green
    Write-Host "[STATUS] You may now safely restart the SGLang server." -ForegroundColor Cyan

} catch {
    Write-Host "[ERROR] Systemic failure writing .wslconfig: $($_.Exception.Message)" -ForegroundColor Red
}