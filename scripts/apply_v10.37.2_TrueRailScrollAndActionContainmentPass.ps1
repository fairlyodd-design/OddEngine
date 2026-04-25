$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$cssPath = Join-Path $repoRoot "ui\src\styles.css"
$versionPath = Join-Path $repoRoot "ui\src\lib\version.ts"
$payloadCss = Join-Path $repoRoot "payload\ODUI_TRUE_RAIL_SCROLL_AND_ACTION_CONTAINMENT.css"

if (!(Test-Path $cssPath)) { throw "Missing ui\src\styles.css. Run this from the OddEngine root after unzipping into C:\OddEngine." }
if (!(Test-Path $payloadCss)) { throw "Missing payload CSS: $payloadCss" }

$backupDir = Join-Path $repoRoot ("backups\v10.37.2_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $cssPath (Join-Path $backupDir "styles.css.bak") -Force
if (Test-Path $versionPath) { Copy-Item $versionPath (Join-Path $backupDir "version.ts.bak") -Force }

$css = Get-Content $cssPath -Raw
$start = "/* === v10.37.2_TRUE_RAIL_SCROLL_AND_ACTION_CONTAINMENT_PASS_START ==="
$end = "/* === v10.37.2_TRUE_RAIL_SCROLL_AND_ACTION_CONTAINMENT_PASS_END === */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "").TrimEnd()
$block = Get-Content $payloadCss -Raw
Set-Content -Path $cssPath -Value ($css + "`r`n`r`n" + $block + "`r`n") -Encoding UTF8

if (Test-Path $versionPath) {
  $ver = Get-Content $versionPath -Raw
  if ($ver -match 'APP_VERSION') {
    $ver = [regex]::Replace($ver, 'APP_VERSION\s*=\s*"[^"]+"', 'APP_VERSION = "10.37.2"')
    $ver = [regex]::Replace($ver, "APP_VERSION\s*=\s*'[^']+'", "APP_VERSION = '10.37.2'")
    Set-Content -Path $versionPath -Value $ver -Encoding UTF8
  }
}

Write-Host "[OddEngine] Applied v10.37.2 rail scroll + action containment fix."
Write-Host "[OddEngine] Backup saved to $backupDir"
