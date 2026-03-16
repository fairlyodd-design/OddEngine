$ErrorActionPreference = "Stop"

# Derive repo root automatically from this script location:
# C:\OddEngine\scripts\hotfix\NoBottomCornerHomieHotfix.ps1 -> C:\OddEngine
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")

$appPath = Join-Path $RepoRoot "ui\src\App.tsx"
$stylesPath = Join-Path $RepoRoot "ui\src\styles.css"

if (-not (Test-Path $appPath)) {
  throw "Could not find App.tsx at $appPath"
}

$app = Get-Content $appPath -Raw

# Remove LilHomieAgent import lines.
$importPattern = '(?m)^\s*import\s+(?:\{\s*)?LilHomieAgent(?:\s*\})?\s+from\s+["'']\.\/components\/LilHomieAgent["''];\s*\r?\n'
$app = [regex]::Replace($app, $importPattern, '')

# Remove self-closing mascot render lines.
$selfClosingPattern = '(?m)^\s*<LilHomieAgent\b[^>]*/>\s*\r?\n'
$app = [regex]::Replace($app, $selfClosingPattern, '')

# Remove explicit open/close block if present.
$blockPattern = '(?ms)^\s*<LilHomieAgent\b.*?<\/LilHomieAgent>\s*\r?\n?'
$app = [regex]::Replace($app, $blockPattern, '')

Set-Content -Path $appPath -Value $app -Encoding UTF8

# CSS backup kill-switch as a safety net.
$killSwitch = @"

 /* v10.25.31c — No bottom-corner Homie hotfix */
.lilHomieAgent,
.lil-homie-agent,
.homie-mascot,
.houseBuddySpot .lilHomieAgent,
.houseBuddySpot .homie-mascot {
  display: none !important;
}
"@

if (Test-Path $stylesPath) {
  $styles = Get-Content $stylesPath -Raw
  if ($styles -notmatch 'v10\.25\.31c — No bottom-corner Homie hotfix') {
    Add-Content -Path $stylesPath -Value $killSwitch -Encoding UTF8
  }
}

Write-Host ""
Write-Host "NoBottomCornerHomie hotfix applied." -ForegroundColor Green
Write-Host "Kept floating Homie. Removed LilHomieAgent mascot render from App.tsx." -ForegroundColor Green
Write-Host ""
