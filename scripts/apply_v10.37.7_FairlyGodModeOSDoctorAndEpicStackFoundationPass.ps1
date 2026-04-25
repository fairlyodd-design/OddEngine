$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$app = Join-Path $root "ui\src\App.tsx"
$version = Join-Path $root "ui\src\lib\version.ts"
$styles = Join-Path $root "ui\src\styles.css"
$componentDir = Join-Path $root "ui\src\components"
$payload = Join-Path $root "payload"

if (!(Test-Path $app)) { throw "Missing ui\src\App.tsx. Run this from C:\OddEngine." }
if (!(Test-Path $componentDir)) { throw "Missing ui\src\components. Run this from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.37.7] Applying FairlyGodMode OS Doctor + Epic Stack Foundation..." -ForegroundColor Cyan

Copy-Item -Force (Join-Path $payload "FairlyGodModeHUD.tsx") (Join-Path $componentDir "FairlyGodModeHUD.tsx")
Copy-Item -Force (Join-Path $payload "FairlyGodModeHUD.css") (Join-Path $componentDir "FairlyGodModeHUD.css")

# Ensure App.tsx has the FairlyGodMode mount. v10.37.6 usually already did this.
$appText = Get-Content $app -Raw
if ($appText -notmatch 'FairlyGodModeHUD') {
  $importAnchor = 'import CardGODMode from "./components/CardGODMode";'
  $importLine = 'import FairlyGodModeHUD from "./components/FairlyGodModeHUD";'
  if ($appText.Contains($importAnchor)) {
    $appText = $appText.Replace($importAnchor, $importAnchor + "`r`n" + $importLine)
  } else {
    throw "Could not find CardGODMode import anchor in App.tsx."
  }
}

$mount = '<FairlyGodModeHUD activePanelId={activeId} onNavigate={setActive} />'
if ($appText -notmatch [regex]::Escape($mount)) {
  $anchor = '<HomieBuddy activePanelId={activeId} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} />'
  if ($appText.Contains($anchor)) {
    $appText = $appText.Replace($anchor, $mount + "`r`n      " + $anchor)
  } else {
    throw "Could not find HomieBuddy main-shell mount anchor in App.tsx."
  }
}
Set-Content -Path $app -Value $appText -Encoding UTF8

# Append/replace global CSS block once.
$cssPayload = Join-Path $payload "FAIRLYGODMODE_OS_DOCTOR_EPIC_STACK.css"
if (Test-Path $cssPayload) {
  $css = Get-Content $styles -Raw
  $block = Get-Content $cssPayload -Raw
  $start = "/* ===== v10.37.7 FairlyGodMode OS Doctor + Epic Stack Foundation ===== */"
  $end = "/* ===== v10.37.7 FairlyGodMode OS Doctor + Epic Stack Foundation END ===== */"
  $pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
  $css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
  Set-Content -Path $styles -Value ($css + "`r`n`r`n" + $block + "`r`n") -Encoding UTF8
}

# Safe version marker update.
if (Test-Path $version) {
  $ver = Get-Content $version -Raw
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.37.7";')
  if ($ver -notmatch 'FAIRLYGODMODE_OS_DOCTOR_PASS') {
    $ver = $ver.TrimEnd() + "`r`nexport const FAIRLYGODMODE_OS_DOCTOR_PASS = `"v10.37.7_FairlyGodModeOSDoctorAndEpicStackFoundationPass`";`r`n"
  }
  Set-Content -Path $version -Value $ver -Encoding UTF8
}

Write-Host "[v10.37.7] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
