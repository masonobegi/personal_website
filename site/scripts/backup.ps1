# -----------------------------------------------------------------------------
#  Pull a full content backup from the live site to a local folder.
#
#  Grabs everything the client can edit in the dashboard — site text, team
#  members, articles (drafts included) and custom pages — and writes it to a
#  dated JSON file. Keeps the most recent N and deletes older ones.
#
#  Usage:
#    .\scripts\backup.ps1 -Password "the-admin-password"
#    .\scripts\backup.ps1 -Password "..." -OutDir "D:\backups\olp" -Keep 60
#
#  To run it automatically, see the Task Scheduler command at the bottom.
# -----------------------------------------------------------------------------

param(
  [Parameter(Mandatory = $true)][string]$Password,
  [string]$Site = "https://oswegolegacypartners.com",
  [string]$OutDir = "$env:USERPROFILE\OneDrive\Desktop\olp-backups",
  [int]$Keep = 30
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

# The backup endpoint authenticates with the same signed session cookie the
# dashboard uses, so log in first and reuse the session.
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

try {
  $login = Invoke-WebRequest -Uri "$Site/api/admin/login" `
    -Method POST `
    -Body (@{ password = $Password } | ConvertTo-Json) `
    -ContentType "application/json" `
    -WebSession $session -UseBasicParsing -TimeoutSec 30
} catch {
  Write-Error "Login failed. Check the password. ($($_.Exception.Message))"
  exit 1
}

try {
  $res = Invoke-WebRequest -Uri "$Site/api/admin/backup" `
    -WebSession $session -UseBasicParsing -TimeoutSec 600
} catch {
  Write-Error "Backup request failed. ($($_.Exception.Message))"
  exit 1
}

# Parse before writing, so a truncated or error response never lands on disk
# looking like a valid backup.
try {
  $data = $res.Content | ConvertFrom-Json
} catch {
  Write-Error "Response was not valid JSON — nothing written."
  exit 1
}

if (-not $data.version) {
  Write-Error "Response is missing a version field — not a backup. Nothing written."
  exit 1
}

$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$path = Join-Path $OutDir "olp-backup-$stamp.json"
$res.Content | Out-File -FilePath $path -Encoding utf8

$sizeMb = [math]::Round((Get-Item $path).Length / 1MB, 2)
Write-Host "Saved $path ($sizeMb MB)"
Write-Host "  team: $($data.counts.team)  articles: $($data.counts.articles)  pages: $($data.counts.pages)  landing: $($data.counts.landing)  submissions: $($data.counts.submissions)  files: $($data.counts.files)"

# Prune old snapshots, newest kept.
$old = Get-ChildItem -Path $OutDir -Filter "olp-backup-*.json" |
       Sort-Object LastWriteTime -Descending |
       Select-Object -Skip $Keep
if ($old) {
  $old | Remove-Item -Force
  Write-Host "Removed $($old.Count) old backup(s), keeping the newest $Keep."
}

# -----------------------------------------------------------------------------
#  Run it weekly (paste into PowerShell once, as your own user):
#
#    $a = New-ScheduledTaskAction -Execute "powershell.exe" `
#      -Argument '-NoProfile -File "C:\Users\mason\OneDrive\Desktop\gibbs_website\scripts\backup.ps1" -Password "PUT-IT-HERE"'
#    $t = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 9am
#    Register-ScheduledTask -TaskName "OLP site backup" -Action $a -Trigger $t
#
#  Note the password sits in the task definition — fine on your own machine,
#  not something to put on a shared one.
# -----------------------------------------------------------------------------
