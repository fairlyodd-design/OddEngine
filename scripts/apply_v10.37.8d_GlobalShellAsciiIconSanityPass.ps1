$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$app = Join-Path $root "ui\src\App.tsx"
$brain = Join-Path $root "ui\src\lib\brain.ts"
$version = Join-Path $root "ui\src\lib\version.ts"
$styles = Join-Path $root "ui\src\styles.css"

if (!(Test-Path $app)) { throw "Missing ui\src\App.tsx. Run from C:\OddEngine." }
if (!(Test-Path $brain)) { throw "Missing ui\src\lib\brain.ts. Run from C:\OddEngine." }

Write-Host "[v10.37.8d] Applying global shell ASCII/icon sanity pass..." -ForegroundColor Cyan

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Sanitize-CommonText([string]$text) {
  # Replace common mojibake sequences by deleting corrupted unicode fragments.
  # This is intentionally ASCII-only in the script itself.
  $text = [regex]::Replace($text, '[^\x00-\x7F]', '')
  $text = $text.Replace('  ', ' ')
  return $text
}

# 1) Sanitize App shell text and replace unsafe visible symbols.
$appText = [System.IO.File]::ReadAllText($app, [System.Text.Encoding]::UTF8)
$appText = Sanitize-CommonText $appText

# Restore readable shell labels that may have lost separators/icons.
$appText = $appText.Replace('How to Use (F1)', 'How to Use (F1)')
$appText = $appText.Replace('Family Night Mode is ON  UI dimmed + distractions reduced.', 'Family Night Mode is ON - UI dimmed + distractions reduced.')
$appText = $appText.Replace('LAN mode:', 'LAN mode:')
$appText = $appText.Replace('FAIRLYODD OS', 'FAIRLYODD OS')

# Replace pin glyphs with ASCII star where the JSX still has a non-ASCII-corrupted body.
$appText = [regex]::Replace($appText, '>[^<]{0,6}</button>', {
  param($m)
  if ($m.Value -match 'pinBtn') { return $m.Value }
  return $m.Value
})

# Specific known button bodies after sanitizing can become empty or corrupted. Normalize pin buttons by class blocks.
$appText = [regex]::Replace($appText, '(className="pinBtn pinned"[\s\S]*?>)[\s\S]{0,8}(</button>)', '$1*$2')
$appText = [regex]::Replace($appText, '(className=\{"pinBtn " \+ \(pinnedPanels\.includes\(it\.id\) \? "pinned" : ""\)\}[\s\S]*?>)[\s\S]{0,8}(</button>)', '$1*$2')

[System.IO.File]::WriteAllText($app, $appText, $utf8NoBom)

# 2) Replace PANEL_META icons with ASCII-safe short labels.
$brainText = [System.IO.File]::ReadAllText($brain, [System.Text.Encoding]::UTF8)

$iconMap = @{
  "Home" = "HOME"; "OddBrain" = "BRAIN"; "Homie" = "HOMIE"; "DevEngine" = "DEV";
  "Autopilot" = "AUTO"; "Builder" = "BUILD"; "Plugins" = "PLUG"; "Money" = "MONEY";
  "FamilyBudget" = "BUDGET"; "Brain" = "BRAIN"; "HappyHealthy" = "HEALTH"; "Cannabis" = "CANNA";
  "Trading" = "TRADE"; "CoinstoreBTCUSDTFutures" = "BTC"; "Poker" = "POKER"; "Grow" = "GROW";
  "Mining" = "MINE"; "CryptoGames" = "GAMES"; "Cameras" = "CAM"; "OptionsSaaS" = "SAAS";
  "News" = "NEWS"; "FamilyHealth" = "CARE"; "GroceryMeals" = "FOOD"; "DailyChores" = "CHORE";
  "Entertainment" = "MEDIA"; "Books" = "WRITE"; "RenderLab" = "RENDER"; "PublisherHub" = "PUBLISH";
  "RoutineLauncher" = "ROUTINE"; "Calendar" = "CAL"; "Preferences" = "PREF"; "Security" = "SEC"
}

foreach ($id in $iconMap.Keys) {
  $safeIcon = $iconMap[$id]
  $pattern = '(\{\s*id:"' + [regex]::Escape($id) + '"\s*,\s*icon:")[^"]*(")'
  $brainText = [regex]::Replace($brainText, $pattern, '$1' + $safeIcon + '$2')
}

# Strip remaining non-ASCII from brain metadata after icon replacements.
$brainText = Sanitize-CommonText $brainText
[System.IO.File]::WriteAllText($brain, $brainText, $utf8NoBom)

# 3) CSS tune for ASCII icon labels so the nav does not look huge.
$cssBlock = @'
/* ===== v10.37.8d Global Shell ASCII Icon Sanity ===== */
.navIcon,
.fgGodPanelIcon,
.homeAppIcon{
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif !important;
  font-size: 10px !important;
  font-weight: 950 !important;
  letter-spacing: .04em !important;
  line-height: 1 !important;
  text-align: center !important;
  overflow: hidden !important;
  text-overflow: clip !important;
  white-space: nowrap !important;
}
.navIcon{
  width: 38px !important;
  min-width: 38px !important;
}
.brandRailCard,
.shellHero,
.shellBar,
.bannerFamilyNight,
.bannerLan{
  unicode-bidi: isolate;
}
.pinBtn{
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif !important;
  font-weight: 950 !important;
}
/* ===== v10.37.8d Global Shell ASCII Icon Sanity END ===== */
'@

if (Test-Path $styles) {
  $css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
  $start = "/* ===== v10.37.8d Global Shell ASCII Icon Sanity ===== */"
  $end = "/* ===== v10.37.8d Global Shell ASCII Icon Sanity END ===== */"
  $pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
  $css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
  [System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $cssBlock + "`r`n", $utf8NoBom)
}

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.37.8d";')
  if ($ver -notmatch 'GLOBAL_ASCII_ICON_SANITY_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const GLOBAL_ASCII_ICON_SANITY_PASS = "v10.37.8d_GlobalShellAsciiIconSanityPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.37.8d] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
