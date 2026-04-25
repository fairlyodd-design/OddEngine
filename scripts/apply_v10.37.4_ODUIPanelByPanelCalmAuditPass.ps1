$ErrorActionPreference = "Stop"

$repo = (Get-Location).Path
$stylesPath = Join-Path $repo "ui\src\styles.css"
$versionPath = Join-Path $repo "ui\src\lib\version.ts"
$payloadCss = Join-Path $repo "payload\ODUI_PANEL_BY_PANEL_CALM_AUDIT.css"

if (!(Test-Path $stylesPath)) { throw "Missing ui\src\styles.css. Run this from C:\OddEngine." }
if (!(Test-Path $payloadCss)) { throw "Missing payload\ODUI_PANEL_BY_PANEL_CALM_AUDIT.css. Extract the ZIP into C:\OddEngine first." }

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $repo "backups\v10.37.4_$stamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item $stylesPath (Join-Path $backupDir "styles.css.bak") -Force
if (Test-Path $versionPath) { Copy-Item $versionPath (Join-Path $backupDir "version.ts.bak") -Force }

$css = Get-Content $stylesPath -Raw
$start = "/* ===== v10.37.4 ODUI Panel By Panel Calm Audit ===== */"
$end = "/* ===== v10.37.4 ODUI Panel By Panel Calm Audit END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end) + "\s*"
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
$block = Get-Content $payloadCss -Raw
Set-Content -Path $stylesPath -Value ($css + "`r`n`r`n" + $block.Trim() + "`r`n") -Encoding UTF8

if (Test-Path $versionPath) {
  $version = Get-Content $versionPath -Raw
  if ($version -match 'APP_VERSION') {
    $version = [regex]::Replace($version, '10\.37\.3[^"`'']*', '10.37.4')
    if ($version -notmatch '10\.37\.4') {
      $version = $version.TrimEnd() + "`r`n// v10.37.4_ODUIPanelByPanelCalmAuditPass`r`n"
    }
    Set-Content -Path $versionPath -Value $version -Encoding UTF8
  }
}

Write-Host "[OddEngine] v10.37.4 panel calm audit applied." -ForegroundColor Green
Write-Host "Touched: ui\src\styles.css"
Write-Host "Backup: $backupDir"
