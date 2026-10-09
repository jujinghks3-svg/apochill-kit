param([switch]$RemoveStartup)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$helperPath = Join-Path $PSScriptRoot 'activity-helper.mjs'
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'Apochill App Detection.lnk'

if ($RemoveStartup) {
  if (Test-Path -LiteralPath $shortcutPath) { Remove-Item -LiteralPath $shortcutPath }
  Write-Output 'Apochill login startup removed. The scene button can stop current app sampling.'
  exit 0
}

$nodePath = (Get-Command node -CommandType Application | Select-Object -First 1).Source
if (!(Test-Path -LiteralPath $helperPath)) { throw 'Activity helper source is missing.' }
# No elevated task, execution-policy change, firewall change, or remote listener.
# Node only listens on loopback; sampling still starts/stops through the scene.
$launchCommand = '& ''' + $nodePath.Replace("'", "''") + ''' ''' + $helperPath.Replace("'", "''") + ''''
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -Command "' + $launchCommand + '"'
$shortcut.WorkingDirectory = $projectDirectory
$shortcut.WindowStyle = 7
$shortcut.Description = 'Apochill local app-name helper. Only starts sampling when connected from the scene.'
$shortcut.Save()

$running = $false
try {
  $status = Invoke-RestMethod 'http://127.0.0.1:5175/status' -Headers @{Origin='https://apochill.lastweek.chatgpt.site'} -TimeoutSec 3
  $running = $status.protocol -eq 2
} catch {}
if (!$running) {
  $diagnosticsPath = Join-Path $projectDirectory 'diagnostics'
  New-Item -ItemType Directory -Path $diagnosticsPath -Force | Out-Null
  Start-Process -FilePath $nodePath -ArgumentList ('"' + $helperPath + '"') -WorkingDirectory $projectDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $diagnosticsPath 'activity-helper.log') -RedirectStandardError (Join-Path $diagnosticsPath 'activity-helper-error.log') | Out-Null
}
Write-Output ('Login startup registered: ' + $shortcutPath)
Write-Output 'Helper is running or starting on 127.0.0.1:5175. Open Apochill and connect PC activity.'
