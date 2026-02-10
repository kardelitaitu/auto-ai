# Add auto directory to PATH
# Run this as Administrator

$autoPath = "C:\My Script\auto"

# Get current user PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

# Check if already in PATH
if ($currentPath -split ';' | Where-Object { $_ -eq $autoPath }) {
    Write-Host "✓ '$autoPath' is already in PATH" -ForegroundColor Green
} else {
    # Add to PATH
    $newPath = "$currentPath;$autoPath"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "✓ Added '$autoPath' to PATH" -ForegroundColor Green
    Write-Host "! Please restart your terminal for changes to take effect" -ForegroundColor Yellow
}

# Display current PATH
Write-Host "`nCurrent user PATH entries:" -ForegroundColor Cyan
[Environment]::GetEnvironmentVariable("Path", "User") -split ';' | ForEach-Object { Write-Host "  - $_" }
