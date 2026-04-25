$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$app = Join-Path $root "ui\src\App.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $app)) { throw "Missing ui\src\App.tsx. Run from C:\OddEngine." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.2c] Applying shell summary duplicate header calm pass..." -ForegroundColor Cyan

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Surgical App.tsx cleanup: remove icon from ShellSummary title lines so ASCII icon labels
# do not create HOME Home / BRAIN OddBrain / BUDGET Family Budget duplication.
$appText = [System.IO.File]::ReadAllText($app, [System.Text.Encoding]::UTF8)
$appText = $appText.Replace('<div className="shellBarTitle">{meta.icon} {meta.title}</div>', '<div className="shellBarTitle">{meta.title}</div>')
$appText = $appText.Replace('<div className="shellTitle">{meta.icon} {meta.title}</div>', '<div className="shellTitle">{meta.title}</div>')
[System.IO.File]::WriteAllText($app, $appText, $utf8NoBom)

# Append/replace CSS block once.
$cssPayload = Join-Path $payload "SHELL_SUMMARY_DUPLICATE_HEADER_CALM.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.2c Shell Summary Duplicate Header Calm Pass ===== */"
$end = "/* ===== v10.38.2c Shell Summary Duplicate Header Calm Pass END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.2c";')
  if ($ver -notmatch 'SHELL_SUMMARY_CALM_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const SHELL_SUMMARY_CALM_PASS = "v10.38.2c_ShellSummaryDuplicateHeaderCalmPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.2c] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
