<#
.SYNOPSIS
    Diagnostic Execution Variant - Maximum RAM Unlocked (64GB)
.DESCRIPTION
    Forces linear execution to isolate test hangs.
    Exploits high-end hardware by granting V8 a 64GB heap allocation.
#>

$ErrorActionPreference = "Continue"
$LogFile = ".\vitest_diagnostic.log"

# ==============================================================================
# Module A: Session Hygiene & Logging Overlay
# ==============================================================================
function Write-Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $FormattedMessage = "$Timestamp - [SYSTEM] - $Message"
    
    # Dual-stream output: Console + File
    Write-Host $FormattedMessage -ForegroundColor Cyan
    $FormattedMessage | Out-File -FilePath $LogFile -Append -Encoding utf8
}

if (Test-Path $LogFile) { Remove-Item $LogFile -Force }

# ==============================================================================
# Module B: Environment Orchestration (64GB V8 Heap)
# ==============================================================================
Write-Log "Injecting V8 parameters: 64GB Heap (65536 MB) + GC Exposed..."
$env:NODE_OPTIONS = "--max-old-space-size=65536 --expose-gc"

Write-Log "Executing single-thread sequential telemetry..."

# ==============================================================================
# Module C: Execution & Telemetry Routing
# ==============================================================================
try {
    # 2>&1 merges the error stream into the success stream for complete capture
    npx vitest run --reporter=verbose `
        --poolOptions.threads.maxThreads=1 `
        --poolOptions.threads.minThreads=1 `
        --no-fileParallelism `
        --logHeapUsage 2>&1 | Tee-Object -FilePath $LogFile -Append
}
finally {
    $ExecStatus = $LASTEXITCODE
    
    if ($ExecStatus -eq 0) {
        Write-Log "Diagnostic trace complete. No hangs detected. Exit code: $ExecStatus"
    } else {
        Write-Log "[ERROR] Trace collapsed or hung. Exit code: $ExecStatus"
    }
    
    # Purge the environment override to maintain host hygiene
    Remove-Item Env:\NODE_OPTIONS
    
    exit $ExecStatus
}