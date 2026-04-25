$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.2d] Applying windowed mode cell containment + responsive shell..." -ForegroundColor Cyan

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$cssPayload = Join-Path $payload "WINDOWED_CELL_CONTAINMENT_RESPONSIVE_SHELL.css"
if (!(Test-Path $cssPayload)) { throw "Missing payload\WINDOWED_CELL_CONTAINMENT_RESPONSIVE_SHELL.css" }

$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)

$start = "/* ===== v10.38.2d Windowed Mode Cell Containment + Responsive Shell ===== */"
$end = "/* ===== v10.38.2d Windowed Mode Cell Containment + Responsive Shell END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.2d";')
  if ($ver -notmatch 'WINDOWED_CELL_CONTAINMENT_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const WINDOWED_CELL_CONTAINMENT_PASS = "v10.38.2d_WindowedModeCellContainmentAndResponsiveShellPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.2d] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
