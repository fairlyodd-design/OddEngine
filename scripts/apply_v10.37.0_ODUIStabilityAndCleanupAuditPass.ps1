param(
  [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$pass = "v10.37.0_ODUIStabilityAndCleanupAuditPass"
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $Root "_backup_$pass`_$stamp"

function Require-File($path) {
  if (!(Test-Path $path)) { throw "Missing required file: $path" }
}

$ui = Join-Path $Root "ui"
$src = Join-Path $ui "src"
$styles = Join-Path $src "styles.css"
$version = Join-Path $src "lib\version.ts"
$panelHeader = Join-Path $src "components\PanelHeader.tsx"
$cardFrame = Join-Path $src "components\CardFrame.tsx"

Require-File $styles
Require-File $version
Require-File $panelHeader
Require-File $cardFrame

New-Item -ItemType Directory -Force -Path $backup | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $backup "ui\src\components") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $backup "ui\src\lib") | Out-Null
Copy-Item $styles (Join-Path $backup "styles.css") -Force
Copy-Item $version (Join-Path $backup "ui\src\lib\version.ts") -Force
Copy-Item $panelHeader (Join-Path $backup "ui\src\components\PanelHeader.tsx") -Force
Copy-Item $cardFrame (Join-Path $backup "ui\src\components\CardFrame.tsx") -Force

$payloadRoot = Split-Path -Parent $PSScriptRoot
Copy-Item (Join-Path $payloadRoot "ui\src\components\PanelHeader.tsx") $panelHeader -Force
Copy-Item (Join-Path $payloadRoot "ui\src\components\CardFrame.tsx") $cardFrame -Force

$blockPath = Join-Path $payloadRoot "ODUI_STABILITY_BLOCK.css"
$css = Get-Content $styles -Raw
$block = Get-Content $blockPath -Raw
if ($css -notmatch "v10\.37\.0_ODUIStabilityAndCleanupAuditPass") {
  Add-Content -Path $styles -Value "`r`n$block`r`n"
  Write-Host "[$pass] Appended OD UI stability CSS block."
} else {
  Write-Host "[$pass] CSS block already present; leaving styles.css existing block untouched."
}

$v = Get-Content $version -Raw
$v = $v -replace 'APP_VERSION\s*=\s*"[^"]+"', 'APP_VERSION = "10.37.0"'
Set-Content -Path $version -Value $v -Encoding UTF8

Write-Host "[$pass] Applied. Backup created at: $backup"
Write-Host "Next checks: npm --prefix ui run build"
