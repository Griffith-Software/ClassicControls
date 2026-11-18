# SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
# Copyright (c) 2026 Griffith Software — https://griffith.software
#
# Adds (or removes) the Windows Task Scheduler task that runs the signed-in YouTube test
# once a day. Run it after the test profile has been signed in with
#   powershell -File scripts\canary-signed-in.ps1 -Setup
#
#   powershell -File scripts\register-signed-in-task.ps1              # daily at 09:00
#   powershell -File scripts\register-signed-in-task.ps1 -At 14:30    # pick another time
#   powershell -File scripts\register-signed-in-task.ps1 -Remove      # take it off again
#
# The task runs as the signed-in Windows user, only while that user is logged on, so the
# browser profile and the GitHub CLI sign-in are the user's own. No password is stored.
# If the PC is off at the set time, Windows runs it at the next start.

param(
  [string]$At = '09:00',
  [string]$TaskName = 'Classic Controls Signed-In Test',
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'

if ($Remove) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Output "Removed the task '$TaskName'."
  } else {
    Write-Output "There is no task named '$TaskName'."
  }
  exit 0
}

$script = Join-Path $PSScriptRoot 'canary-signed-in.ps1'
if (-not (Test-Path $script)) { throw "Can't find $script" }
$repo = Split-Path -Parent $PSScriptRoot

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`"" `
  -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::ParseExact($At, 'HH:mm', $null))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
  -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
  -Principal $principal -Description 'Checks Classic Controls on signed-in YouTube and updates the youtube-change issues on GitHub.' `
  -Force | Out-Null

Write-Output "Added the task '$TaskName': daily at $At. Results go to $env:LOCALAPPDATA\ClassicControlsTest\results."
