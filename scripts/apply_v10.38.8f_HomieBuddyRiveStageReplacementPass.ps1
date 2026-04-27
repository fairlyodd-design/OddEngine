$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$buddy = Join-Path $root "ui\src\components\HomieBuddy.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"
if (!(Test-Path $buddy)) { throw "Missing ui\src\components\HomieBuddy.tsx. Run from C:\OddEngine." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.8f] Applying HomieBuddy Rive stage replacement..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$tsx = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)

if ($tsx -notmatch 'function HomieBuddyHumanAvatar') {
$component = @'
function HomieBuddyHumanAvatar() {
  return (
    <div className="homieBuddyHumanAvatarStage" aria-label="Human-inspired Homie companion avatar">
      <div className="homieBuddyHumanCap" />
      <div className="homieBuddyHumanEar left" />
      <div className="homieBuddyHumanEar right" />
      <div className="homieBuddyHumanHead" />
      <div className="homieBuddyHumanBrow left" />
      <div className="homieBuddyHumanBrow right" />
      <div className="homieBuddyHumanGlasses"><div className="homieBuddyHumanBridge" /></div>
      <div className="homieBuddyHumanEye left" />
      <div className="homieBuddyHumanEye right" />
      <div className="homieBuddyHumanBeard" />
      <div className="homieBuddyHumanSmile" />
      <div className="homieBuddyHumanBody" />
      <div className="homieBuddyHumanCore" />
      <div className="homieBuddyHumanHand left" />
      <div className="homieBuddyHumanHand right" />
      <div className="homieBuddyHumanLabel">HOMIE</div>
    </div>
  );
}

'@
  if ($tsx.Contains('export default function HomieBuddy')) {
    $tsx = $tsx.Replace('export default function HomieBuddy', $component + 'export default function HomieBuddy')
  } elseif ($tsx.Contains('export function HomieBuddy')) {
    $tsx = $tsx.Replace('export function HomieBuddy', $component + 'export function HomieBuddy')
  } else {
    throw "Could not find HomieBuddy export function anchor."
  }
}

$tsx = [regex]::Replace($tsx, '\s*<div className="homieBuddyHumanSyncedNote">[\s\S]*?</div>\s*', "`r`n")
$tsx = [regex]::Replace($tsx, '\s*<div className="homieCompanionHumanSyncedCopy">[\s\S]*?</div>\s*', "`r`n")
$tsx = [regex]::Replace($tsx, '\s*<HomieCompanionHumanMini\s*/>\s*', "`r`n")

$beforeRive = $tsx
$tsx = [regex]::Replace($tsx, '<RiveHomie\b[^>]*/>', '<HomieBuddyHumanAvatar />')
$tsx = [regex]::Replace($tsx, '<RiveHomie\b[^>]*>[\s\S]*?</RiveHomie>', '<HomieBuddyHumanAvatar />')
$replacedRive = ($beforeRive -ne $tsx)

$matches = [regex]::Matches($tsx, '<HomieBuddyHumanAvatar\s*/>')
if ($matches.Count -gt 1) {
  $seen = $false
  $tsx = [regex]::Replace($tsx, '<HomieBuddyHumanAvatar\s*/>', {
    param($m)
    if (-not $script:seen) { $script:seen = $true; return $m.Value }
    return ''
  })
}

if (-not $replacedRive -and $tsx -notmatch '<HomieBuddyHumanAvatar\s*/>') {
  $anchor = '<div className="assistantSectionTitle">A calmer Homie lane</div>'
  if (-not $tsx.Contains($anchor)) { $anchor = '<div className="assistantSectionTitle">Human Homie companion lane</div>' }
  if ($tsx.Contains($anchor)) {
    $tsx = $tsx.Replace($anchor, '<HomieBuddyHumanAvatar />' + "`r`n" + '              ' + $anchor)
  } else {
    throw "Could not find RiveHomie or companion lane title anchor in HomieBuddy.tsx."
  }
}

$tsx = $tsx.Replace('A calmer Homie lane', 'Human Homie companion lane')
$tsx = $tsx.Replace('Homie is here with you.', 'Homie is here with you, warm and steady.')
$tsx = $tsx.Replace('Warm companion lane open - body, mind,', 'Warm human companion lane open - body, mind,')
$tsx = $tsx.Replace('Warm companion lane open — body, mind,', 'Warm human companion lane open - body, mind,')
$tsx = $tsx.Replace('Ready for a gentle today scan: body, family, money, creative.', 'Ready for one gentle next step: body, family, money, or creative.')
[System.IO.File]::WriteAllText($buddy, $tsx, $utf8NoBom)

$cssPayload = Join-Path $payload "HOMIE_BUDDY_RIVE_STAGE_REPLACEMENT.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.8f HomieBuddy Rive Stage Replacement ===== */"
$end = "/* ===== v10.38.8f HomieBuddy Rive Stage Replacement END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.8f";')
  if ($ver -notmatch 'HOMIE_BUDDY_RIVE_STAGE_REPLACEMENT_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_BUDDY_RIVE_STAGE_REPLACEMENT_PASS = "v10.38.8f_HomieBuddyRiveStageReplacementPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}
Write-Host "[v10.38.8f] Applied." -ForegroundColor Green
if ($replacedRive) { Write-Host "[v10.38.8f] Replaced RiveHomie stage usage in HomieBuddy.tsx." -ForegroundColor Green }
else { Write-Host "[v10.38.8f] RiveHomie was not present; ensured exactly one human avatar fallback." -ForegroundColor Yellow }
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
