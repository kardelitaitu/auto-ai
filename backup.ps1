# Auto-AI Backup Script
# Creates a zip backup of the project with configurable exclusions

param(
    [string]$OutputDir = ".\backups",
    [string]$ProjectRoot = $PSScriptRoot
)

# Excluded folders (relative to project root)
$ExcludedFolders = @(
    "node_modules",
    ".git",
    "backups",
    "logs",
    "sessions"
)

# Excluded file extensions
$ExcludedExtensions = @(
    ".exe",
    ".dll",
    ".pdb",
    ".log",
    ".db",
    ".sqlite"
)

# Excluded specific files
$ExcludedFiles = @(
    "package-lock.json",
    "logs.json",
    "logs.txt",
    "run-summary.json"
)

# Create output directory if it doesn't exist
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# Generate backup filename with timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupName = "auto-ai_$timestamp.zip"
$backupPath = Join-Path $OutputDir $backupName

# Get all files, filtering out exclusions
$allFiles = Get-ChildItem -Path $ProjectRoot -Recurse -File | Where-Object {
    $file = $_
    $relativePath = $file.FullName.Substring($ProjectRoot.Length + 1)
    $parentPath = Split-Path $relativePath -Parent
    
    # Check if file is in excluded folder (any level in path)
    $inExcludedFolder = $false
    foreach ($folder in $ExcludedFolders) {
        if ($parentPath -and ($parentPath -eq $folder -or
            $parentPath.StartsWith("$folder\") -or $parentPath.StartsWith("$folder/") -or
            $parentPath.Contains("\$folder\") -or $parentPath.Contains("/$folder/"))) {
            $inExcludedFolder = $true
            break
        }
    }
    if ($inExcludedFolder) { return $false }
    
    # Check if file has excluded extension
    if ($ExcludedExtensions -contains $file.Extension.ToLower()) {
        return $false
    }
    
    # Check if file is in excluded files list
    if ($ExcludedFiles -contains $file.Name) {
        return $false
    }
    
    return $true
}

Write-Host "Creating backup: $backupName" -ForegroundColor Cyan
Write-Host "Project root: $ProjectRoot" -ForegroundColor Gray
Write-Host "Excluded folders: $($ExcludedFolders -join ', ')" -ForegroundColor Gray
Write-Host "Excluded extensions: $($ExcludedExtensions -join ', ')" -ForegroundColor Gray
Write-Host "Excluded files: $($ExcludedFiles -join ', ')" -ForegroundColor Gray
Write-Host "Files to backup: $($allFiles.Count)" -ForegroundColor Gray
Write-Host ""

# Create zip file
try {
    # Use .NET compression to create zip
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    
    # Create temp directory structure for zip
    $tempDir = Join-Path $env:TEMP "backup_$timestamp"
    if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    # Copy files to temp directory preserving structure
    $copied = 0
    foreach ($file in $allFiles) {
        $relativePath = $file.FullName.Substring($ProjectRoot.Length + 1)
        $destPath = Join-Path $tempDir $relativePath
        $destDir = Split-Path $destPath -Parent
        
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        
        Copy-Item -Path $file.FullName -Destination $destPath -Force
        $copied++
        
        if ($copied % 100 -eq 0) {
            Write-Host "  Copied $copied / $($allFiles.Count) files..." -ForegroundColor DarkGray
        }
    }
    
    # Remove existing zip if present
    if (Test-Path $backupPath) { Remove-Item $backupPath -Force }
    
    # Create zip archive
    [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $backupPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    
    # Cleanup temp directory
    Remove-Item $tempDir -Recurse -Force
    
    # Get backup size
    $backupSize = (Get-Item $backupPath).Length / 1MB
    Write-Host ""
    Write-Host "Backup created successfully!" -ForegroundColor Green
    Write-Host "  Location: $backupPath" -ForegroundColor Green
    Write-Host "  Size: $([math]::Round($backupSize, 2)) MB" -ForegroundColor Green
    Write-Host "  Files: $copied" -ForegroundColor Green
    
} catch {
    Write-Host "Error creating backup: $_" -ForegroundColor Red
    exit 1
}
