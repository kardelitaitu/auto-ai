<#
.SYNOPSIS
    Auto-AI Framework - Bare-Metal Orchestrator (V4)
.DESCRIPTION
    Bypasses PS wrappers using native .NET Process execution.
    Achieves maximum hardware saturation on high-core-count architectures.
#>

$ErrorActionPreference = "Continue"
$ParallelFactor = 30 # Saturated for 32 threads
$targetDirs = @("api", "tasks")
$logFile = "vitest-individual2.log"
$projectRoot = $PSScriptRoot

# ==============================================================================
# Module A: Session Hygiene & Environment
# ==============================================================================
New-Item -Path $logFile -ItemType File -Force | Out-Null
$logBuffer = New-Object System.Collections.Generic.List[string]
$failedTests = New-Object System.Collections.Generic.List[string]
$timer = [System.Diagnostics.Stopwatch]::StartNew()

# Inject 8GB Heap limit per isolated process to ensure stability
$env:NODE_OPTIONS = "--max-old-space-size=8192"

Write-Host "`n=== [SYSTEM_NODE] Bare-Metal Test Orchestrator ===" -ForegroundColor Cyan
Write-Host "Target Root : $projectRoot"
Write-Host "Concurrency : $ParallelFactor Native .NET Processes"
Write-Host "Execution   : [System.Diagnostics.Process]"
Write-Host "====================================================`n" -ForegroundColor Cyan

# ==============================================================================
# Module B: Discovery & Queue Generation
# ==============================================================================
$testFiles = @()
foreach ($dir in $targetDirs) {
    $targetPath = Join-Path $projectRoot $dir
    if (Test-Path -Path $targetPath) {
        $found = Get-ChildItem -Path $targetPath -Filter "*.test.js" -Recurse
        if ($found) { $testFiles += $found }
        Write-Host " [+] Mapped directory: $dir ($($found.Count) files)" -ForegroundColor DarkGray
    }
}

$totalFiles = $testFiles.Count
if ($totalFiles -eq 0) {
    Write-Host "[!] System Halt: No test files found." -ForegroundColor Red
    exit
}

$Queue = [System.Collections.Queue]::new($testFiles)
$ActiveProcesses = New-Object System.Collections.Generic.List[PSCustomObject]
$completedCount = 0

function Flush-LogBuffer {
    param($buffer, $path)
    if ($buffer.Count -gt 0) {
        $buffer | Out-File -FilePath $path -Append -Encoding utf8
        $buffer.Clear()
    }
}

# ==============================================================================
# Module C: Continuous Process Pumping (The Core Engine)
# ==============================================================================
# Keep the engine running while there are files in queue OR processes still active
while ($Queue.Count -gt 0 -or $ActiveProcesses.Count -gt 0) {
    
    # 1. Spawn logic: Fill empty slots up to the ParallelFactor
    while ($ActiveProcesses.Count -lt $ParallelFactor -and $Queue.Count -gt 0) {
        $file = $Queue.Dequeue()
        
        # Configure native OS process
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "npx.cmd"
        $psi.Arguments = "vitest run `"$($file.FullName)`" --reporter=default --no-color --config `"$(Join-Path $projectRoot 'config/vitest.config.js')`""
        $psi.WorkingDirectory = $projectRoot
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $psi
        $process.Start() | Out-Null
        
        $ActiveProcesses.Add([PSCustomObject]@{
            Process = $process
            File = $file
        })
    }

    # 2. Reap logic: Check for finished processes and extract telemetry
    $StillActive = New-Object System.Collections.Generic.List[PSCustomObject]
    
    foreach ($item in $ActiveProcesses) {
        if ($item.Process.HasExited) {
            # Read streams directly from RAM
            $out = $item.Process.StandardOutput.ReadToEnd() + $item.Process.StandardError.ReadToEnd()
            $item.Process.Dispose() # Crucial memory hygiene
            
            # String Extraction
            $f = if ($out -match "Test Files\s+(.+passed.*)") { $Matches[1].Trim() } else { "FAIL" }
            $t = if ($out -match "Tests\s+(.+passed.*)") { $Matches[1].Trim() } else { "FAIL" }
            $d = if ($out -match "Duration\s+([^\s\(]+)") { $Matches[1].Trim() } else { "??s" }

            $logString = ""
            if ($f -eq "FAIL") {
                $err = "Check Imports/Context"
                if ($out -match "Error: (.+)") { $err = $Matches[1].Trim() }
                $logString = "{0,-45} | Files: {1,-15} | Tests: {2,-15} | Time: {3}" -f $item.File.Name, "FAIL", $err, $d
                $failedTests.Add($logString)
            } else {
                $logString = "{0,-45} | Files: {1,-15} | Tests: {2,-15} | Time: {3}" -f $item.File.Name, $f, $t, $d
            }
            
            $logBuffer.Add($logString)
            $completedCount++
            
            $StatusColor = if ($f -eq "FAIL") { "Red" } else { "Green" }
            Write-Host "[$completedCount/$totalFiles] Finished: $($item.File.Name)" -ForegroundColor $StatusColor
            
            if ($logBuffer.Count -ge $ParallelFactor) { Flush-LogBuffer $logBuffer $logFile }
        } else {
            $StillActive.Add($item)
        }
    }
    
    $ActiveProcesses = $StillActive
    
    # Micro-sleep to prevent the while-loop from monopolizing CPU cycle polling
    [System.Threading.Thread]::Sleep(15) 
}

# ==============================================================================
# Module D: Final Reporting
# ==============================================================================
$timer.Stop()
$totalTime = $timer.Elapsed
$avgTime = if ($totalFiles -gt 0) { $totalTime.TotalSeconds / $totalFiles } else { 0 }

Flush-LogBuffer $logBuffer $logFile

Write-Host "`n[DONE] Execution complete in $($totalTime.ToString("mm\:ss\.ff")). HW saturated." -ForegroundColor Cyan