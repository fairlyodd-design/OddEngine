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
Write-Host "[v10.37.6] Applying FairlyGodMode polish + truth reasons..." -ForegroundColor Cyan
Copy-Item -Force (Join-Path $payload "FairlyGodModeHUD.tsx") (Join-Path $componentDir "FairlyGodModeHUD.tsx")
Copy-Item -Force (Join-Path $payload "FairlyGodModeHUD.css") (Join-Path $componentDir "FairlyGodModeHUD.css")
$cssPath = Join-Path $payload "FAIRLYGODMODE_POLISH_AND_TRUTH_REASONS.css"
if (Test-Path $cssPath) {
  $css = Get-Content $styles -Raw
  $block = Get-Content $cssPath -Raw
  $start = "/* ===== v10.37.6 FairlyGodMode Command Deck Polish + Truth Reasons ===== */"
  $end = "/* ===== v10.37.6 FairlyGodMode Command Deck Polish + Truth Reasons END ===== */"
  $pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
  $css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
  Set-Content -Path $styles -Value ($css + "`r`n`r`n" + $block + "`r`n") -Encoding UTF8
}
$appText = Get-Content $app -Raw
if ($appText -notmatch 'FairlyGodModeHUD') {
  $importAnchor = 'import CardGODMode from "./components/CardGODMode";'
  $importLine = 'import FairlyGodModeHUD from "./components/FairlyGodModeHUD";'
  if ($appText.Contains($importAnchor)) { $appText = $appText.Replace($importAnchor, $importAnchor + "`r`n" + $importLine) } else { throw "Could not find CardGODMode import anchor in App.tsx." }
}
$mount = '<FairlyGodModeHUD activePanelId={activeId} onNavigate={setActive} />'
if ($appText -notmatch [regex]::Escape($mount)) {
  $anchor = '<HomieBuddy activePanelId={activeId} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} />'
  if ($appText.Contains($anchor)) { $appText = $appText.Replace($anchor, $mount + "`r`n      " + $anchor) } else { throw "Could not find HomieBuddy main-shell mount anchor in App.tsx." }
}
Set-Content -Path $app -Value $appText -Encoding UTF8
if (Test-Path $version) {
  $ver = Get-Content $version -Raw
  $ver = [regex]::Replace($ver, '10\.37\.[0-9a-zA-Z\.-]*', '10.37.6')
  if ($ver -notmatch '10\.37\.6') { $ver = $ver.TrimEnd() + "`r`n" + 'export const ODUI_FAIRLYGODMODE_POLISH_PASS = "v10.37.6_FairlyGodModeCommandDeckPolishAndTruthReasonPass";' + "`r`n" }
  Set-Content -Path $version -Value $ver -Encoding UTF8
}
Write-Host "[v10.37.6] Applied." -ForegroundColor Green

