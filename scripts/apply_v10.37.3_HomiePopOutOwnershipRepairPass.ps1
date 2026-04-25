$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$payloadCss = Join-Path $repoRoot "ODUI_HOMIE_POP_OUT_REPAIR.css"
$targets = @(
  (Join-Path $repoRoot "ui\src\components\homieRebuild.css"),
  (Join-Path $repoRoot "ui\src\styles.css")
)
$marker = "v10.37.3 Homie Pop-Out Ownership Repair"

if (!(Test-Path $payloadCss)) { throw "Missing payload CSS: $payloadCss" }
$block = Get-Content $payloadCss -Raw

foreach ($target in $targets) {
  if (!(Test-Path $target)) {
    Write-Host "[OddEngine] Skipping missing target: $target"
    continue
  }

  $current = Get-Content $target -Raw
  if ($current -like "*$marker*") {
    Write-Host "[OddEngine] Already patched: $target"
    continue
  }

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  Copy-Item $target "$target.bak-v10.37.3-$stamp" -Force
  Add-Content -Path $target -Value ("`r`n" + $block + "`r`n")
  Write-Host "[OddEngine] Patched: $target"
}

$versionFile = Join-Path $repoRoot "ui\src\lib\version.ts"
if (Test-Path $versionFile) {
  $version = Get-Content $versionFile -Raw
  $version = $version -replace 'APP_VERSION\s*=\s*"[^"]+"', 'APP_VERSION = "10.37.3"'
  Set-Content -Path $versionFile -Value $version -NoNewline
  Write-Host "[OddEngine] Version marker set to 10.37.3"
}

Write-Host "[OddEngine] v10.37.3 Homie pop-out ownership repair applied."
