$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$appPath = Join-Path $root "ui\src\App.tsx"
$versionPath = Join-Path $root "ui\src\lib\version.ts"
$componentDir = Join-Path $root "ui\src\components"
$payloadRoot = Join-Path $root "files"

if (!(Test-Path $appPath)) { throw "Missing ui\src\App.tsx. Run this from C:\OddEngine." }
if (!(Test-Path $componentDir)) { throw "Missing ui\src\components. Run this from C:\OddEngine." }
if (!(Test-Path $payloadRoot)) { throw "Missing payload files folder. Extract the ZIP into C:\OddEngine first." }

Write-Host "[OddEngine] Applying v10.37.5b FairlyGodMode apply-script hotfix..." -ForegroundColor Cyan

$componentSrc = Join-Path $payloadRoot "ui\src\components\FairlyGodModeHUD.tsx"
$cssSrc = Join-Path $payloadRoot "ui\src\components\FairlyGodModeHUD.css"
$componentDst = Join-Path $componentDir "FairlyGodModeHUD.tsx"
$cssDst = Join-Path $componentDir "FairlyGodModeHUD.css"

foreach ($p in @($componentSrc, $cssSrc)) {
  if (!(Test-Path $p)) { throw "Missing payload file: $p" }
}

Copy-Item -LiteralPath $componentSrc -Destination $componentDst -Force
Copy-Item -LiteralPath $cssSrc -Destination $cssDst -Force

$app = Get-Content -LiteralPath $appPath -Raw

if ($app -notmatch 'FairlyGodModeHUD') {
  $importNeedle = 'import CardGODMode from "./components/CardGODMode";'
  $importLine = 'import FairlyGodModeHUD from "./components/FairlyGodModeHUD";'
  if ($app.Contains($importNeedle)) {
    $app = $app.Replace($importNeedle, $importNeedle + [Environment]::NewLine + $importLine)
  } else {
    throw "Could not find CardGODMode import anchor in App.tsx."
  }
}

$forcedHomieLine = '          <HomieBuddy activePanelId={forcedPanel} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} />'
$forcedGodLine = '          <FairlyGodModeHUD activePanelId={forcedPanel} onNavigate={setActive} />'
if ($app.Contains($forcedHomieLine) -and !$app.Contains($forcedGodLine)) {
  $app = $app.Replace($forcedHomieLine, $forcedGodLine + [Environment]::NewLine + $forcedHomieLine)
}

$mainHomieLine = '      <HomieBuddy activePanelId={activeId} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} />'
$mainGodLine = '      <FairlyGodModeHUD activePanelId={activeId} onNavigate={setActive} />'
if ($app.Contains($mainHomieLine) -and !$app.Contains($mainGodLine)) {
  $app = $app.Replace($mainHomieLine, $mainGodLine + [Environment]::NewLine + $mainHomieLine)
}

Set-Content -LiteralPath $appPath -Value $app -Encoding UTF8

if (Test-Path $versionPath) {
  $version = Get-Content -LiteralPath $versionPath -Raw
  $version = [regex]::Replace($version, 'export const APP_VERSION\s*=\s*"[^"]+";', 'export const APP_VERSION = "10.37.5b";')
  Set-Content -LiteralPath $versionPath -Value $version -Encoding UTF8
}

Write-Host "[OddEngine] v10.37.5b applied." -ForegroundColor Green
Write-Host "Next: npm --prefix ui run build" -ForegroundColor Yellow
