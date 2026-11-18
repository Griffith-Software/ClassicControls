# SPDX-License-Identifier: LicenseRef-Apache-2.0-with-Commons-Clause
# Copyright (c) 2026 Griffith Software — https://griffith.software
#
# Signed-in YouTube test, run twice a week on the owner's PC with a separate test Google account.
# It checks the home page and subscriptions feed hover buttons, that Watch Later really adds
# a video (and removes it again), and the subscriptions list view, then updates the
# youtube-change issues on GitHub with the GitHub CLI (gh).
#
# First time only, sign the test profile in to the test account by hand:
#   powershell -File scripts\canary-signed-in.ps1 -Setup
# Then schedule it twice a week at random times:
#   powershell -File scripts\register-signed-in-task.ps1
#
# The test account's password is never stored anywhere by this script; Chrome keeps the
# sign-in in the profile folder, which lives outside the repo.

param(
  [switch]$Setup,
  [string]$ProfileDir = (Join-Path $env:LOCALAPPDATA 'ClassicControlsTest\profile'),
  [string]$Out = (Join-Path $env:LOCALAPPDATA 'ClassicControlsTest\results'),
  [string]$Node = '',
  [switch]$NoIssues
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
New-Item -ItemType Directory -Force -Path $ProfileDir, $Out | Out-Null

# Use the portable tools next to the project when they are there (node isn't on PATH on the dev PC).
$buildTools = Join-Path (Split-Path -Parent $repo) 'build-tools'
if (-not $Node) {
  $portable = Get-ChildItem -Path $buildTools -Filter 'node-v*-win-x64' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
  $Node = if ($portable) { Join-Path $portable.FullName 'node.exe' } else { 'node' }
}
$browsers = Join-Path $buildTools 'ms-playwright'
if (Test-Path $browsers) { $env:PLAYWRIGHT_BROWSERS_PATH = $browsers }

if ($Setup) {
  & $Node tests/canary/run.mjs --signed-in --setup --profile $ProfileDir
  exit $LASTEXITCODE
}

& $Node tests/canary/run.mjs --signed-in --profile $ProfileDir --out $Out
if (-not $NoIssues) {
  & $Node tests/canary/issues.mjs --results (Join-Path $Out 'results.json')
}
