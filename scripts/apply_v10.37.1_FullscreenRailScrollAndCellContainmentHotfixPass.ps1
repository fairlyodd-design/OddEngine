$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$StylesPath = Join-Path $RepoRoot "ui\src\styles.css"
$CssPatchPath = Join-Path $RepoRoot "ODUI_FULLSCREEN_RAIL_AND_CELL_CONTAINMENT.css"
$MarkerStart = "/* === v10.37.1_FULLSCREEN_RAIL_SCROLL_AND_CELL_CONTAINMENT_START === */"
$MarkerEnd = "/* === v10.37.1_FULLSCREEN_RAIL_SCROLL_AND_CELL_CONTAINMENT_END === */"

Write-Host "[OddEngine] Applying v10.37.1 Fullscreen Rail Scroll + Cell Containment hotfix..." -ForegroundColor Cyan

if (!(Test-Path $StylesPath)) {
  throw "Could not find ui\src\styles.css. Run this from C:\OddEngine after unzipping the pass into the repo root."
}
if (!(Test-Path $CssPatchPath)) {
  throw "Could not find ODUI_FULLSCREEN_RAIL_AND_CELL_CONTAINMENT.css in repo root."
}

$styles = Get-Content $StylesPath -Raw
$patch = Get-Content $CssPatchPath -Raw
$block = "`r`n$MarkerStart`r`n$patch`r`n$MarkerEnd`r`n"

$escapedStart = [regex]::Escape($MarkerStart)
$escapedEnd = [regex]::Escape($MarkerEnd)
$regex = "(?s)`r?`n?$escapedStart.*?$escapedEnd`r?`n?"

if ($styles -match $escapedStart) {
  $styles = [regex]::Replace($styles, $regex, $block)
  Write-Host "[OddEngine] Replaced existing v10.37.1 CSS block." -ForegroundColor Yellow
} else {
  $styles = $styles.TrimEnd() + $block
  Write-Host "[OddEngine] Added v10.37.1 CSS block." -ForegroundColor Green
}

Set-Content -Path $StylesPath -Value $styles -Encoding UTF8

$VersionPath = Join-Path $RepoRoot "ui\src\lib\version.ts"
if (Test-Path $VersionPath) {
  $version = Get-Content $VersionPath -Raw
  $version = [regex]::Replace($version, 'APP_VERSION\s*=\s*"[^"]+"', 'APP_VERSION = "10.37.1"')
  Set-Content -Path $VersionPath -Value $version -Encoding UTF8
  Write-Host "[OddEngine] Version marker updated to 10.37.1." -ForegroundColor Green
}

Write-Host "[OddEngine] Done. Now run: npm --prefix ui run build" -ForegroundColor Green
