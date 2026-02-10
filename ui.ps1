# Load Windows Forms Assembly
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# --- Configuration ---
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$tasksDir = Join-Path $scriptDir "tasks"
$nodeExecutable = "node"
$mainScript = Join-Path $scriptDir "main.js"
$global:nodeProcess = $null

# --- Theme Colors ---
$colorBg = [System.Drawing.Color]::FromArgb(45, 45, 45)       # #2D2D2D
$colorPanel = [System.Drawing.Color]::FromArgb(60, 60, 60)    # #3C3C3C
$colorText = [System.Drawing.Color]::FromArgb(240, 240, 240)  # #F0F0F0
$colorBtn = [System.Drawing.Color]::FromArgb(70, 70, 70)      # #464646
$colorBtnHover = [System.Drawing.Color]::FromArgb(90, 90, 90) # #5A5A5A
$colorBtnDisabled = [System.Drawing.Color]::FromArgb(55, 55, 55) # #373737
$colorInput = [System.Drawing.Color]::FromArgb(35, 35, 35)    # #232323

# --- Create Form ---
$form = New-Object System.Windows.Forms.Form
$form.Text = "Auto Task Controller"
$form.Size = New-Object System.Drawing.Size(350, 235)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = $colorBg
$form.ForeColor = $colorText

# --- Helper: Create Styled Button ---
function Create-StyledButton($text, $x, $y, $w, $h) {
    $btn = New-Object System.Windows.Forms.Button
    $btn.Text = $text
    $btn.Location = New-Object System.Drawing.Point($x, $y)
    $btn.Size = New-Object System.Drawing.Size($w, $h)
    $btn.FlatStyle = "Flat"
    $btn.FlatAppearance.BorderSize = 0
    $btn.BackColor = $colorBtn
    $btn.ForeColor = $colorText
    $btn.Cursor = [System.Windows.Forms.Cursors]::Hand
    $btn.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    return $btn
}

# --- Helper: Create Styled ComboBox ---
function Create-StyledComboBox($x, $y, $w) {
    $cb = New-Object System.Windows.Forms.ComboBox
    $cb.Location = New-Object System.Drawing.Point($x, $y)
    $cb.Size = New-Object System.Drawing.Size($w, 25)
    $cb.DropDownStyle = "DropDownList"
    $cb.BackColor = $colorInput
    $cb.ForeColor = $colorText
    $cb.FlatStyle = "Flat"
    $cb.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    return $cb
}

# --- UI Elements ---

# Left Column: Buttons
$btnStart = Create-StyledButton "START" 20 20 80 40
$btnStart.BackColor = [System.Drawing.Color]::FromArgb(40, 167, 69) # Greenish
$form.Controls.Add($btnStart)

$btnStop = Create-StyledButton "STOP" 20 70 80 40
$btnStop.BackColor = $colorBtnDisabled
$btnStop.Enabled = $false
$form.Controls.Add($btnStop)

# Right Column: Dropdowns
$dropdowns = @()
$yPos = 20
for ($i = 0; $i -lt 5; $i++) {
    $cb = Create-StyledComboBox 120 $yPos 190
    $form.Controls.Add($cb)
    $dropdowns += $cb
    $yPos += 35
}

# --- Logic ---

# 1. Load Tasks
$tasks = @("----")
if (Test-Path $tasksDir) {
    $files = Get-ChildItem -Path $tasksDir -Filter "*.js" | Where-Object { $_.Name -ne "_template.js" }
    foreach ($file in $files) {
        $tasks += $file.BaseName
    }
}

# 2. Populate Dropdowns
foreach ($cb in $dropdowns) {
    foreach ($task in $tasks) {
        $cb.Items.Add($task) | Out-Null
    }
    $cb.SelectedIndex = 0
}

# 3. Start Action
$btnStart.Add_Click({
        $selectedTasks = @()
        foreach ($cb in $dropdowns) {
            if ($cb.SelectedItem -ne "----" -and $cb.SelectedItem -ne $null) {
                $selectedTasks += $cb.SelectedItem
            }
        }

        if ($selectedTasks.Count -eq 0) {
            [System.Windows.Forms.MessageBox]::Show("Please select at least one task.", "Warning", "OK", "Warning")
            return
        }

        # Disable UI
        $btnStart.Enabled = $false
        $btnStart.BackColor = $colorBtnDisabled
        $btnStop.Enabled = $true
        $btnStop.BackColor = [System.Drawing.Color]::FromArgb(220, 53, 69) # Reddish
        foreach ($cb in $dropdowns) { $cb.Enabled = $false }

        # Start Process
        $argsList = @("main.js") + $selectedTasks
        try {
            $psi = New-Object System.Diagnostics.ProcessStartInfo
            $psi.FileName = $nodeExecutable
            $psi.Arguments = $argsList -join " "
            $psi.WorkingDirectory = $scriptDir
            $psi.UseShellExecute = $true # Use shell to spawn separate window if needed, or false for hidden
            # To keep it clean, let's spawn a new window so user can see logs
        
            $global:nodeProcess = [System.Diagnostics.Process]::Start($psi)
        
            # Start Timer to monitor process
            $timer.Start()
        }
        catch {
            [System.Windows.Forms.MessageBox]::Show("Failed to start process: $_", "Error", "OK", "Error")
            # Reset UI
            $btnStart.Enabled = $true
            $btnStart.BackColor = [System.Drawing.Color]::FromArgb(40, 167, 69)
            $btnStop.Enabled = $false
            $btnStop.BackColor = $colorBtnDisabled
            foreach ($cb in $dropdowns) { $cb.Enabled = $true }
        }
    })

# 4. Stop Action
# 4. Stop Action
$btnStop.Add_Click({
        if ($global:nodeProcess -and -not $global:nodeProcess.HasExited) {
            # Create stop signal file
            $stopFile = Join-Path $scriptDir "stop.signal"
            New-Item -ItemType File -Path $stopFile -Force | Out-Null
        
            # Wait for graceful shutdown (up to 5 seconds)
            $timeout = 10
            while ($timeout -gt 0 -and -not $global:nodeProcess.HasExited) {
                Start-Sleep -Milliseconds 500
                $timeout--
                [System.Windows.Forms.Application]::DoEvents() # Keep UI responsive
            }
        
            # Force kill if still running
            if (-not $global:nodeProcess.HasExited) {
                try {
                    Stop-Process -Id $global:nodeProcess.Id -Force -ErrorAction SilentlyContinue
                }
                catch {
                    # Ignore
                }
            }
        
            # Cleanup signal file if it still exists
            if (Test-Path $stopFile) {
                Remove-Item $stopFile -Force -ErrorAction SilentlyContinue
            }
        }
    
        # UI Reset handled by Timer, but force it here for responsiveness
        $timer_Tick_Action.Invoke()
    })

# 5. Process Monitor Timer
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1000 # Check every 1 second
$timer_Tick_Action = {
    if ($global:nodeProcess -eq $null -or $global:nodeProcess.HasExited) {
        $timer.Stop()
        $global:nodeProcess = $null
        
        # Reset UI
        $btnStart.Enabled = $true
        $btnStart.BackColor = [System.Drawing.Color]::FromArgb(40, 167, 69)
        $btnStop.Enabled = $false
        $btnStop.BackColor = $colorBtnDisabled
        foreach ($cb in $dropdowns) { $cb.Enabled = $true }
    }
}
$timer.Add_Tick($timer_Tick_Action)

# --- Show Form ---
$form.ShowDialog() | Out-Null
$form.Dispose()
