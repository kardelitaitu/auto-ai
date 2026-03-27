# Auto-AI Backup Script
# Creates a zip backup of the project with configurable exclusions

param(
    [string]$OutputDir = ".\backups",
    [string]$ProjectRoot = $PSScriptRoot
)

# Excluded folders (relative to project root)
$ExcludedFolders = @(
    ".agents",
    ".llm-context",
    ".opencode",
    ".vscode",
    "node_modules",
    ".git",
    "backups",
    "logs",
    "sessions",
    "dist-exe",
    "dist",
    "api/ui/electron-dashboard/dist-exe",
    "api/ui/electron-dashboard/dist",
    "coverage",
    "api/coverage",
    "__pycache__",
    ".pytest_cache",
    ".nyc_output",
    ".test-backup-output",
    ".test-backup_output"
)

# Excluded file extensions (compressed/binary files that don't compress well)
$ExcludedExtensions = @(
    ".exe",
    ".dll",
    ".pdb",
    ".log",
    ".db",
    ".sqlite",
    ".map",
    ".asar",
    ".node",
    ".wasm",
    ".dylib",
    ".so",
    ".ico"
)

# Excluded specific files
$ExcludedFiles = @(
    "package-lock.json",
    "logs.json",
    "nul",
    "logs.txt",
    "run-summary.json",
    "AGENT-JOURNAL.md.bak",
    "patchnotes.md.bak",
    "vitest-individual.txt",
    "coverage-final.json"
)

# Create output directory if it doesn't exist
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# Add output directory to exclusions
$outputDirName = Split-Path $OutputDir -Leaf
if ($outputDirName -and $ExcludedFolders -notcontains $outputDirName) {
    $ExcludedFolders += $outputDirName
    Write-Host "Added '$outputDirName' to excluded folders" -ForegroundColor Gray
}

# Generate next sequence number by scanning output directory
$nextNum = 1
if (Test-Path $OutputDir) {
    $existingBackups = Get-ChildItem -Path $OutputDir -Filter "*.zip"
    $maxNum = 0
    foreach ($file in $existingBackups) {
        if ($file.Name -match "^(\d{4})") {
            $num = [int]$matches[1]
            if ($num -gt $maxNum) { $maxNum = $num }
        }
    }
    $nextNum = $maxNum + 1
}
$prefix = $nextNum.ToString("0000")

# Generate backup filename with specific format: XXXX auto-ai Backup d MMMM HHhMMm.zip
$dateString = Get-Date -Format "d MMMM HH'h'mm'm'"
$backupName = "$prefix auto-ai Backup $dateString.zip"
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
            $parentPath.Contains("\$folder\") -or $parentPath.Contains("/$folder/") -or
            $relativePath -eq $folder -or
            $relativePath.StartsWith("$folder\") -or $relativePath.StartsWith("$folder/"))) {
            $inExcludedFolder = $true
            break
        }
    }
    if ($inExcludedFolder) { return $false }
    
    # Check if file has excluded extension
    if ($ExcludedExtensions -contains $file.Extension.ToLower()) {
        return $false
    }
    
    # Check if file is in excluded files list (exact match or pattern)
    $fileNameLower = $file.Name.ToLower()
    foreach ($excludedFile in $ExcludedFiles) {
        if ($fileNameLower -eq $excludedFile.ToLower() -or 
            $fileNameLower.EndsWith($excludedFile.ToLower())) {
            return $false
        }
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
    $tempDir = Join-Path $env:TEMP "backup_$($nextNum.ToString('0000'))"
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
    
    # Verify backup was created correctly
    if (-not (Test-Path $backupPath)) {
        throw "Backup file was not created"
    }
    
    # Verify zip is valid and readable
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $zip = [System.IO.Compression.ZipFile]::OpenRead($backupPath)
        $entryCount = $zip.Entries.Count
        $zip.Dispose()
        
        if ($entryCount -eq 0) {
            throw "Backup zip is empty"
        }
    } catch {
        throw "Backup verification failed: $_"
    }
    
    # Get backup size
    $backupSize = (Get-Item $backupPath).Length / 1MB
    Write-Host ""
    Write-Host "Backup created successfully!" -ForegroundColor Green
    Write-Host "  Location: $backupPath" -ForegroundColor Green
    Write-Host "  Size: $([math]::Round($backupSize, 2)) MB" -ForegroundColor Green
    Write-Host "  Files: $copied (verified: $entryCount)" -ForegroundColor Green
    
} catch {
    Write-Host "Error creating backup: $_" -ForegroundColor Red
    exit 1
}
