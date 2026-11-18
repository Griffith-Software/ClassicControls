# SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
# Copyright (c) 2026 Griffith Software — https://griffith.software
#
# Adds (or removes) the Windows Task Scheduler task that runs the signed-in YouTube test
# twice a week at random times. Run it after the test profile has been signed in with
#   powershell -File scripts\canary-signed-in.ps1 -Setup
#
#   powershell -File scripts\register-signed-in-task.ps1              # twice a week, random times
#   powershell -File scripts\register-signed-in-task.ps1 -Remove      # take it off again
#
# The week is split into two windows, and Windows picks a new random moment inside each
# window every week:
#   run 1: any time from Monday 08:00 to Wednesday 20:00
#   run 2: any time from Thursday 08:00 to Sunday 08:00
# So it always runs twice a week, never on a fixed day or time.
#
# The task runs as the signed-in Windows user, only while that user is logged on, so the
# browser profile and the GitHub CLI sign-in are the user's own. No password is stored.
# If the PC is off or asleep at the chosen moment, Windows runs it as soon as it can.

param(
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
$start = [datetime]::Today.AddHours(8)
$triggers = @(
  New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At $start -RandomDelay (New-TimeSpan -Days 2 -Hours 12)
  New-ScheduledTaskTrigger -Weekly -DaysOfWeek Thursday -At $start -RandomDelay (New-TimeSpan -Days 3)
)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
  -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Settings $settings `
  -Principal $principal -Description 'Checks Classic Controls on signed-in YouTube and updates the youtube-change issues on GitHub.' `
  -Force | Out-Null

Write-Output "Added the task '$TaskName': twice a week at random times (Mon-Wed and Thu-Sun). Results go to $env:LOCALAPPDATA\ClassicControlsTest\results."
