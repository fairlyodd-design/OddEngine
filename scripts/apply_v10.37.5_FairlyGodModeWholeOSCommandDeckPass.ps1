$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$pass = "v10.37.5_FairlyGodModeWholeOSCommandDeckPass"
Write-Host "[$pass] Applying from $root" -ForegroundColor Cyan

$appPath = Join-Path $root "ui\src\App.tsx"
$versionPath = Join-Path $root "ui\src\lib\version.ts"
$srcHud = Join-Path $root "ui\src\components\FairlyGodModeHUD.tsx"
$srcCss = Join-Path $root "ui\src\components\FairlyGodModeHUD.css"

foreach ($path in @($appPath, $versionPath)) {
  if (!(Test-Path -LiteralPath $path)) {
    throw "Missing $path. Run this from C:\OddEngine after extracting the zip into the repo root."
  }
}

if (!(Test-Path -LiteralPath $srcHud) -or !(Test-Path -LiteralPath $srcCss)) {
  throw "Missing FairlyGodModeHUD payload files. Extract this zip directly into C:\OddEngine."
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupRoot = Join-Path $root "backups\v10.37.5_$stamp"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
Copy-Item -LiteralPath $appPath -Destination (Join-Path $backupRoot "App.tsx.bak") -Force
Copy-Item -LiteralPath $versionPath -Destination (Join-Path $backupRoot "version.ts.bak") -Force
Write-Host "[$pass] Backup created: $backupRoot" -ForegroundColor DarkCyan

$app = Get-Content -LiteralPath $appPath -Raw

if ($app -notmatch 'FairlyGodModeHUD') {
  $importNeedle = 'import CardGODMode from "./components/CardGODMode";'
  if ($app -notmatch [regex]::Escape($importNeedle)) {
    throw "Could not find CardGODMode import anchor in App.tsx. App may have drifted."
  }
  $app = $app.Replace($importNeedle, "$importNeedle`r`nimport FairlyGodModeHUD from \"./components/FairlyGodModeHUD\";")
}

$hudMount = '      <FairlyGodModeHUD activePanelId={activeId} onNavigate={setActive} />'
if ($app -notmatch [regex]::Escape($hudMount)) {
  $anchor = '      <ErrorBoundary panelId={activeId} label="AI inbox rail" onNavigate={setActive}><ActivityRail activePanelId={activeId} onNavigate={setActive} /></ErrorBoundary>'
  if ($app -notmatch [regex]::Escape($anchor)) {
    throw "Could not find ActivityRail anchor in App.tsx. App may have drifted."
  }
  $app = $app.Replace($anchor, "$hudMount`r`n$anchor")
}

Set-Content -LiteralPath $appPath -Value $app -Encoding UTF8

$version = Get-Content -LiteralPath $versionPath -Raw
if ($version -match 'APP_VERSION\s*=\s*"[^"]+"') {
  $version = [regex]::Replace($version, 'APP_VERSION\s*=\s*"[^"]+"', 'APP_VERSION = "10.37.5"')
} elseif ($version -match "APP_VERSION\s*=\s*'[^']+'") {
  $version = [regex]::Replace($version, "APP_VERSION\s*=\s*'[^']+'", "APP_VERSION = '10.37.5'")
} else {
  Write-Host "[$pass] APP_VERSION anchor not found; leaving version.ts unchanged." -ForegroundColor Yellow
}
Set-Content -LiteralPath $versionPath -Value $version -Encoding UTF8

Write-Host "[$pass] Applied." -ForegroundColor Green
Write-Host "Touched:" -ForegroundColor Green
Write-Host "  ui\src\components\FairlyGodModeHUD.tsx"
Write-Host "  ui\src\components\FairlyGodModeHUD.css"
Write-Host "  ui\src\App.tsx"
Write-Host "  ui\src\lib\version.ts"
Write-Host "Next: npm --prefix ui run build" -ForegroundColor Green
