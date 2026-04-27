$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$homie = Join-Path $root "ui\src\panels\Homie.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $homie)) { throw "Missing ui\src\panels\Homie.tsx. Run from C:\OddEngine." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.8c] Applying Homie companion lane human avatar sync..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$tsx = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)

if ($tsx -notmatch 'function HomieCompanionHumanMini') {
$component = @'
function HomieCompanionHumanMini() {
  return (
    <div className="homieCompanionHumanMini" aria-label="Human-inspired Homie companion">
      <div className="homieCompanionHumanCap" />
      <div className="homieCompanionHumanEar left" />
      <div className="homieCompanionHumanEar right" />
      <div className="homieCompanionHumanHead" />
      <div className="homieCompanionHumanBrow left" />
      <div className="homieCompanionHumanBrow right" />
      <div className="homieCompanionHumanGlasses">
        <div className="homieCompanionHumanBridge" />
      </div>
      <div className="homieCompanionHumanEye left" />
      <div className="homieCompanionHumanEye right" />
      <div className="homieCompanionHumanBeard" />
      <div className="homieCompanionHumanSmile" />
      <div className="homieCompanionHumanBody" />
      <div className="homieCompanionHumanCore" />
      <div className="homieCompanionHumanHand left" />
      <div className="homieCompanionHumanHand right" />
      <div className="homieCompanionHumanLabel">HOMIE</div>
    </div>
  );
}

'@
  $tsx = $tsx.Replace('export default function Homie', $component + 'export default function Homie')
}

if ($tsx -notmatch '<HomieCompanionHumanMini />') {
  $targets = @(
    '<div className="h">A calmer Homie lane</div>',
    '<div className="h">Human Homie companion lane</div>',
    '<h3>A calmer Homie lane</h3>',
    '<b>A calmer Homie lane</b>'
  )
  $inserted = $false
  foreach ($target in $targets) {
    if ($tsx.Contains($target)) {
      $replacement = '<HomieCompanionHumanMini />' + "`r`n" + '              <div className="homieCompanionHumanCopy">' + "`r`n" + '                <b>Human Homie companion lane</b>' + "`r`n" + '                <p>Same warm Homie identity: cap, glasses, beard, kind eyes, and one calm next step.</p>' + "`r`n" + '              </div>' + "`r`n" + '              ' + $target
      $tsx = $tsx.Replace($target, $replacement)
      $inserted = $true
      break
    }
  }

  if (-not $inserted) {
    $fallback = '<div className="small">Family legacy vault'
    if ($tsx.Contains($fallback)) {
      $tsx = $tsx.Replace($fallback, '<HomieCompanionHumanMini />' + "`r`n" + '              <div className="homieCompanionHumanCopy"><b>Human Homie companion lane</b><p>Same warm Homie identity: cap, glasses, beard, kind eyes, and one calm next step.</p></div>' + "`r`n" + '              ' + $fallback)
    }
  }
}

$tsx = $tsx.Replace("A calmer Homie lane", "Human Homie companion lane")
$tsx = $tsx.Replace("Homie is here with you.", "Homie is here with you, warm and steady.")
$tsx = $tsx.Replace("Warm companion lane open", "Warm human companion lane open")
$tsx = $tsx.Replace("Ready for a gentle today scan: body, family, money, creative.", "Ready for one gentle next step: body, family, money, or creative.")

[System.IO.File]::WriteAllText($homie, $tsx, $utf8NoBom)

$cssPayload = Join-Path $payload "HOMIE_COMPANION_LANE_HUMAN_AVATAR_SYNC.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.8c Homie Companion Lane Human Avatar Sync ===== */"
$end = "/* ===== v10.38.8c Homie Companion Lane Human Avatar Sync END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.8c";')
  if ($ver -notmatch 'HOMIE_COMPANION_LANE_HUMAN_SYNC_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_COMPANION_LANE_HUMAN_SYNC_PASS = "v10.38.8c_HomieCompanionLaneHumanAvatarSyncPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.8c] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
