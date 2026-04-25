$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$component = Join-Path $root "ui\src\components\FairlyGodModeHUD.tsx"
$version = Join-Path $root "ui\src\lib\version.ts"

if (!(Test-Path $component)) {
  throw "Missing ui\src\components\FairlyGodModeHUD.tsx. Run this from C:\OddEngine after v10.37.7/8."
}

Write-Host "[v10.37.8c] Applying ASCII sanitizer hotfix..." -ForegroundColor Cyan

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$tsx = [System.IO.File]::ReadAllText($component, [System.Text.Encoding]::UTF8)

# 1) Strip all non-ASCII characters from the FairlyGodMode HUD only.
# This removes mojibake text such as broken emoji bytes, smart quotes, and corrupted ellipsis.
$tsx = [regex]::Replace($tsx, '[^\x00-\x7F]', '')

# 2) Clean common broken leftovers.
$tsx = $tsx.Replace(' -> ', ' -> ')
$tsx = $tsx.Replace('...', '...')
$tsx = $tsx.Replace('FairlyGodMode', 'FairlyGodMode')

# 3) Replace mode icon fields with ASCII-safe labels.
# Handles both stripped empty icon strings and any remaining quoted icon strings.
$tsx = [regex]::Replace($tsx, 'icon:\s*"[^"]*"\s*,\s*name:\s*"Family Legacy Mode"', 'icon: "Legacy", name: "Family Legacy Mode"')
$tsx = [regex]::Replace($tsx, 'icon:\s*"[^"]*"\s*,\s*name:\s*"Trading War Room"', 'icon: "Trade", name: "Trading War Room"')
$tsx = [regex]::Replace($tsx, 'icon:\s*"[^"]*"\s*,\s*name:\s*"Money Recovery Mode"', 'icon: "Money", name: "Money Recovery Mode"')
$tsx = [regex]::Replace($tsx, 'icon:\s*"[^"]*"\s*,\s*name:\s*"Studio Creation Mode"', 'icon: "Studio", name: "Studio Creation Mode"')
$tsx = [regex]::Replace($tsx, 'icon:\s*"[^"]*"\s*,\s*name:\s*"Morning Command"', 'icon: "AM", name: "Morning Command"')
$tsx = [regex]::Replace($tsx, 'icon:\s*"[^"]*"\s*,\s*name:\s*"Night Calm Mode"', 'icon: "PM", name: "Night Calm Mode"')
$tsx = [regex]::Replace($tsx, 'icon:\s*"[^"]*"\s*,\s*name:\s*"Health \+ House Mode"', 'icon: "House", name: "Health + House Mode"')

# 4) Remove panel meta emoji render in the FairlyGodMode deck. Keep titles.
$tsx = $tsx -replace '\{activeMeta\.icon\}\s*', ''
$tsx = $tsx -replace '\{getPanelMeta\(selected\.panelId\)\.icon\}\s*', ''
$tsx = $tsx -replace '\{getPanelMeta\(r\.panelId\)\.icon\}\s*', ''
$tsx = $tsx -replace '\{meta\.icon\}\s*', ''

# 5) Make the deck title plain and safe if previous patch left bad leading text.
$tsx = [regex]::Replace($tsx, '<div className="fairlyGodModeTitle fgGodDeckTitle">.*?FairlyGodMode</div>', '<div className="fairlyGodModeTitle fgGodDeckTitle">FairlyGodMode</div>')

[System.IO.File]::WriteAllText($component, $tsx, $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.37.8c";')
  if ($ver -notmatch 'FAIRLYGODMODE_ASCII_HOTFIX_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const FAIRLYGODMODE_ASCII_HOTFIX_PASS = "v10.37.8c_FairlyGodModeAsciiSanitizerHotfixPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.37.8c] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
