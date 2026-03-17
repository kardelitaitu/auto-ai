<#
.SYNOPSIS
Orchestrates Gemma 3 1B via Docker Model Runner with zero-entropy CLI parsing.

.DESCRIPTION
Corrects strict CLI argument parsing for the TCP flag and removes redundant 
Linux-only installation layers. Relies on Docker Desktop's native dynamic 
vLLM routing based on the OCI artifact tag.
#>

param (
    [string]$TargetModel = "ai/gemma3-vllm:1B", 
    [int]$ApiPort = 8000,
    [string]$LogDir = "C:\Ops\ModelRunner_Logs"
)

$SessionId = $(Get-Date -Format "yyyyMMdd_HHmmss")
$LogFile = Join-Path $LogDir "Gemma3_1B_ModelRunner_$SessionId.log"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

function Write-Log ([string]$Message, [string]$Level = "INFO") {
    $Timestamp = Get-Date -Format "HH:mm:ss"
    $Line = "[$Timestamp] [$Level] $Message"
    Write-Output $Line
    Add-Content -Path $LogFile -Value $Line
}

Write-Log "Initiating high-velocity 1B orchestration with strict CLI parsing." "STRATEGY"

try {
    Write-Log "Binding internal API router to TCP $ApiPort..." "EXEC"
    # Utilizing strict assignment (--tcp=$ApiPort) to satisfy the Go-based Docker CLI parser.
    docker desktop enable model-runner --tcp=$ApiPort 2>&1 | ForEach-Object { Write-Log $_ "NET" }

    Write-Log "Fetching pre-compiled 1B Safetensors artifact: $TargetModel" "EXEC"
    docker model pull $TargetModel 2>&1 | ForEach-Object { Write-Log $_ "PULL" }

    Write-Log "Orchestration complete. System bound to http://localhost:$ApiPort/engines/v1" "SUCCESS"
} catch {
    Write-Log "Boundary failure in Model Runner pipeline: $($_.Exception.Message)" "FATAL"
    exit 1
}