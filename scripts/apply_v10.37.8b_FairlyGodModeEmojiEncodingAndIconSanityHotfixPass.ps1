$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$component = Join-Path $root "ui\src\components\FairlyGodModeHUD.tsx"
$version = Join-Path $root "ui\src\lib\version.ts"

if (!(Test-Path $component)) { throw "Missing ui\src\components\FairlyGodModeHUD.tsx. Run from C:\OddEngine after v10.37.7/8." }

Write-Host "[v10.37.8b] Applying FairlyGodMode emoji encoding + icon sanity hotfix..." -ForegroundColor Cyan

$tsx = Get-Content $component -Raw

# Replace emoji literals in the FairlyGodMode component with ASCII-safe icon labels.
# This avoids Windows/PowerShell/UTF-8 mojibake showing as Ã / ðŸ garbage in the UI.
$tsx = $tsx -replace 'icon:\s*"[^"]*"\s*,\s*name:\s*"Family Legacy Mode"', 'icon: "Legacy", name: "Family Legacy Mode"'
$tsx = $tsx -replace 'icon:\s*"[^"]*"\s*,\s*name:\s*"Trading War Room"', 'icon: "Trade", name: "Trading War Room"'
$tsx = $tsx -replace 'icon:\s*"[^"]*"\s*,\s*name:\s*"Money Recovery Mode"', 'icon: "Money", name: "Money Recovery Mode"'
$tsx = $tsx -replace 'icon:\s*"[^"]*"\s*,\s*name:\s*"Studio Creation Mode"', 'icon: "Studio", name: "Studio Creation Mode"'
$tsx = $tsx -replace 'icon:\s*"[^"]*"\s*,\s*name:\s*"Morning Command"', 'icon: "AM", name: "Morning Command"'
$tsx = $tsx -replace 'icon:\s*"[^"]*"\s*,\s*name:\s*"Night Calm Mode"', 'icon: "PM", name: "Night Calm Mode"'
$tsx = $tsx -replace 'icon:\s*"[^"]*"\s*,\s*name:\s*"Health \+ House Mode"', 'icon: "House", name: "Health + House Mode"'

# Replace any mojibaked header/icon text if it was already baked into JSX.
$tsx = $tsx -replace '>[^<]{0,24}FairlyGodMode<', '>FairlyGodMode<'
$tsx = $tsx -replace '<div className="fairlyGodModeTitle fgGodDeckTitle">[^<]*FairlyGodMode</div>', '<div className="fairlyGodModeTitle fgGodDeckTitle">FairlyGodMode</div>'

# If panel meta icons are also mojibaked in this component output, protect the deck by hiding the icon text around titles where possible.
# Keep mode.icon text because it is now ASCII.
$tsx = $tsx -replace '\{activeMeta\.icon\} ', ''
$tsx = $tsx -replace '\{getPanelMeta\(selected\.panelId\)\.icon\} ', ''
$tsx = $tsx -replace '\{getPanelMeta\(r\.panelId\)\.icon\} ', ''

# Clean obvious mojibake fragments that can trail strings after bad decoding.
$tsx = $tsx -replace 'â€¦', '...'
$tsx = $tsx -replace 'Â', ''
$tsx = $tsx -replace 'Ã¢â‚¬Â¢', '•'
$tsx = $tsx -replace 'â€¢', '•'
$tsx = $tsx -replace 'â†’', '->'

# Save explicitly as UTF-8 without BOM.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($component, $tsx, $utf8NoBom)

if (Test-Path $version) {
  $ver = Get-Content $version -Raw
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.37.8b";')
  if ($ver -notmatch 'FAIRLYGODMODE_EMOJI_HOTFIX_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const FAIRLYGODMODE_EMOJI_HOTFIX_PASS = "v10.37.8b_FairlyGodModeEmojiEncodingAndIconSanityHotfixPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.37.8b] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
