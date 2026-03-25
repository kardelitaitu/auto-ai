# --- Configuration ---
$ParallelFactor = 24 # Single input for both MaxParallel and BufferSize (increased from 16)
$targetDirs = @("api") # Modular array for multi-directory scanning
$logFile = "vitest-individual.txt"
$projectRoot = $PSScriptRoot

# Session Hygiene & Timer Initialization
New-Item -Path $logFile -ItemType File -Force | Out-Null
$logBuffer = New-Object System.Collections.Generic.List[string]
$failedTests = New-Object System.Collections.Generic.List[string] # New: Failure Tracking Buffer
$timer = [System.Diagnostics.Stopwatch]::StartNew()

Write-Host "[!] Root: $projectRoot" -ForegroundColor Cyan
Write-Host "[!] Parallel Factor: $ParallelFactor (Threads & Buffer)" -ForegroundColor Cyan

# Recursive scan with Pre-Flight Validation (Fallback Logic)
$testFiles = @()
foreach ($dir in $targetDirs) {
    $targetPath = Join-Path $projectRoot $dir
    if (Test-Path -Path $targetPath) {
        Write-Host " [+] Scanning directory: $dir" -ForegroundColor DarkGray
        $testFiles += Get-ChildItem -Path $targetPath -Filter "*.test.js" -Recurse
    }
    else {
        Write-Host " [!] Fallback Triggered: Directory not found -> $dir" -ForegroundColor Yellow
    }
}

$totalFiles = $testFiles.Count
$completedCount = 0

if ($totalFiles -eq 0) {
    Write-Host "[!] System Halt: No test files found across target directories." -ForegroundColor Red
    exit
}

Write-Host "[!] Found $totalFiles test files across all target modules." -ForegroundColor Gray

# Helper for Safe Disk I/O
function Clear-LogBuffer {
    param($buffer, $path)
    if ($buffer.Count -gt 0) {
        $buffer | Out-File -FilePath $path -Append -Encoding utf8
        $buffer.Clear()
        Write-Host " [DISK WRITE] Buffer flushed to disk." -ForegroundColor DarkGray
    }
}

foreach ($file in $testFiles) {
    # Throttling & Streaming
    while ((Get-Job -State Running).Count -ge $ParallelFactor) {
        Get-Job -State Completed | ForEach-Object {
            $data = Receive-Job $_
            if ($data) { 
                $logBuffer.Add($data)
                
                # Trap Failures for Final Report
                if ($data -match "FAIL") { $failedTests.Add($data) }
                
                $completedCount++
                Write-Host "[$completedCount/$totalFiles] Finished: $($_.Name)" -ForegroundColor Green
                
                # Buffer flushes when it reaches the ParallelFactor size
                if ($logBuffer.Count -ge $ParallelFactor) { Clear-LogBuffer $logBuffer $logFile }
            }
            Remove-Job $_
        }
        Start-Sleep -Milliseconds 50
    }

    # Spawn Job with Root Context
    Start-Job -Name $file.Name -ScriptBlock {
        param($path, $name, $root, $configPath)
        $ErrorActionPreference = "Continue"
        Set-Location -Path $root
        $env:FORCE_COLOR = 0
        $env:NODE_PATH = Join-Path $root "node_modules"
        
        # Execute Vitest and capture all streams
        $ErrorLog = "$env:TEMP\vitest_err_$PID.log"
        $out = & npx vitest run "$path" --reporter=default --no-color --config "$configPath" 2>&1 | Out-String -Width 4096
        
        # Enhanced Regex for Vitest Summary - more flexible matching
        $f = if ($out -match "(?s)Test Files.*?(\d+)\s+(passed|failed)") { "$($Matches[1]) $($Matches[2])" } elseif ($out -match "Test Files\s+\d+") { "1 passed" } else { "FAIL" }
        $t = if ($out -match "(?s)Tests.*?(\d+)\s+(passed|failed)") { "$($Matches[1]) $($Matches[2])" } elseif ($out -match "Tests\s+\d+") { "1 passed" } else { "FAIL" }
        $d = if ($out -match "Duration\s+(\d+\.\d+s|\d+m\d+\.\d+s)") { $Matches[1] } elseif ($out -match "Duration\s+(\d+)s") { "$($Matches[1])s" } else { "??s" }

        if ($f -eq "FAIL" -or $f -notmatch "passed") {
            $err = "Parse Error"
            if ($out -match "(?s)Error:?\s*(.+?)(?:\r?\n|\r)") { $err = $Matches[1].Trim().Substring(0, [Math]::Min(25, $Matches[1].Trim().Length)) }
            return "{0,-45} | Files: {1,-15} | Tests: {2,-15} | Time: {3}" -f $name, "FAIL", $err, $d
        }
        return "{0,-45} | Files: {1,-15} | Tests: {2,-15} | Time: {3}" -f $name, $f, $t, $d
    } -ArgumentList $file.FullName, $file.Name, $projectRoot, (Join-Path $projectRoot "config/vitest.config.js") | Out-Null
}

# Final Sweep for remaining jobs
while ((Get-Job).Count -gt 0) {
    Get-Job -State Completed | ForEach-Object {
        $data = Receive-Job $_
        if ($data) { 
            $logBuffer.Add($data)
            
            # Trap Failures for Final Report
            if ($data -match "FAIL") { $failedTests.Add($data) }
            
            $completedCount++
            Write-Host "[$completedCount/$totalFiles] Finished: $($_.Name)" -ForegroundColor Green
        }
        Remove-Job $_
    }
    Start-Sleep -Milliseconds 100
}

# Final Benchmarking Data
$timer.Stop()
$totalTime = $timer.Elapsed
$avgTime = if ($totalFiles -gt 0) { $totalTime.TotalSeconds / $totalFiles } else { 0 }

# Failure Aggregation & Console Logging
$failureReport = ""
if ($failedTests.Count -gt 0) {
    Write-Host "`n[!] CRITICAL: $($failedTests.Count) Failed Tests Detected!" -ForegroundColor Red
    $failureReport += "`n`n--- FAILED TESTS SUMMARY ---`n"
    foreach ($fail in $failedTests) {
        Write-Host " [x] $fail" -ForegroundColor Red
        $failureReport += "$fail`n"
    }
}
else {
    Write-Host "`n[+] All modules passed execution parameters." -ForegroundColor Green
    $failureReport += "`n`n--- FAILED TESTS SUMMARY ---`n[+] ZERO FAILURES DETECTED`n"
}

# Construct Final Footer Output
$footer = @"
$failureReport
--- PERFORMANCE SUMMARY ---
Total Files Processed : $totalFiles
Total Execution Time   : $($totalTime.ToString("mm\:ss\.ff"))
Average Time per File  : $($avgTime.ToString("F2")) seconds
Parallel Factor Used   : $ParallelFactor
"@

$logBuffer.Add($footer)
Clear-LogBuffer $logBuffer $logFile

Write-Host "`n[DONE] Audit complete in $($totalTime.ToString("mm\:ss\.ff"))" -ForegroundColor Cyan
Invoke-Item $logFile