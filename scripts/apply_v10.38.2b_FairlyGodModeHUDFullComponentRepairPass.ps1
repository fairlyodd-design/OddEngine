$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$componentDir = Join-Path $root "ui\src\components"
$component = Join-Path $componentDir "FairlyGodModeHUD.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $componentDir)) { throw "Missing ui\src\components. Run from C:\OddEngine." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.2b] Replacing FairlyGodModeHUD.tsx with clean full component..." -ForegroundColor Cyan

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$sourceComponent = Join-Path $payload "FairlyGodModeHUD.tsx"
$sourceCss = Join-Path $payload "FAIRLYGODMODE_HUD_REPAIR.css"
if (!(Test-Path $sourceComponent)) { throw "Missing payload\FairlyGodModeHUD.tsx" }
if (!(Test-Path $sourceCss)) { throw "Missing payload\FAIRLYGODMODE_HUD_REPAIR.css" }

$tsx = [System.IO.File]::ReadAllText($sourceComponent, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($component, $tsx, $utf8NoBom)

$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($sourceCss, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.2b FairlyGodMode HUD Full Repair ===== */"
$end = "/* ===== v10.38.2b FairlyGodMode HUD Full Repair END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.2b";')
  if ($ver -notmatch 'FAIRLYGODMODE_HUD_REPAIR_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const FAIRLYGODMODE_HUD_REPAIR_PASS = "v10.38.2b_FairlyGodModeHUDFullComponentRepairPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.2b] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
