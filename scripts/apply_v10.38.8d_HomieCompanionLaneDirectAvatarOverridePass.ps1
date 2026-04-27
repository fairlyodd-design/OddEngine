$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$homie = Join-Path $root "ui\src\panels\Homie.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $homie)) { throw "Missing ui\src\panels\Homie.tsx. Run from C:\OddEngine." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.8d] Applying direct companion avatar override..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$tsx = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)

if ($tsx -notmatch 'function HomieDirectHumanAvatar') {
$component = @'
function HomieDirectHumanAvatar() {
  return (
    <div className="homieCompanionDirectHumanSlot">
      <div className="homieDirectHumanMini" aria-label="Human-inspired Homie avatar">
        <div className="homieDirectHumanCap" />
        <div className="homieDirectHumanEar left" />
        <div className="homieDirectHumanEar right" />
        <div className="homieDirectHumanHead" />
        <div className="homieDirectHumanBrow left" />
        <div className="homieDirectHumanBrow right" />
        <div className="homieDirectHumanGlasses">
          <div className="homieDirectHumanBridge" />
        </div>
        <div className="homieDirectHumanEye left" />
        <div className="homieDirectHumanEye right" />
        <div className="homieDirectHumanBeard" />
        <div className="homieDirectHumanSmile" />
        <div className="homieDirectHumanBody" />
        <div className="homieDirectHumanCore" />
        <div className="homieDirectHumanHand left" />
        <div className="homieDirectHumanHand right" />
        <div className="homieDirectHumanLabel">HOMIE</div>
      </div>
    </div>
  );
}

'@
  $tsx = $tsx.Replace('export default function Homie', $component + 'export default function Homie')
}

if ($tsx -notmatch 'data-homie-companion-avatar-override="v10.38.8d"') {
  $patterns = @(
    '<div className="homieCompanionStage">',
    '<div className="homieBuddyStage">',
    '<div className="companionAvatarStage">',
    '<div className="homieCompanionAvatar">',
    '<div className="homieBuddyAvatar">'
  )
  $patched = $false
  foreach ($p in $patterns) {
    if ($tsx.Contains($p)) {
      $replacement = $p.Replace('>', ' data-homie-companion-avatar-override="v10.38.8d">') + "`r`n" + '              <HomieDirectHumanAvatar />'
      $tsx = $tsx.Replace($p, $replacement)
      $patched = $true
      break
    }
  }

  if (-not $patched) {
    $anchor = '<div className="h">A calmer Homie lane</div>'
    if (-not $tsx.Contains($anchor)) { $anchor = '<div className="h">Human Homie companion lane</div>' }
    if ($tsx.Contains($anchor)) {
      $inject = '<div data-homie-companion-avatar-override="v10.38.8d" style={{ minHeight: 310 }}><HomieDirectHumanAvatar /></div>' + "`r`n" + '              '
      $tsx = $tsx.Replace($anchor, $inject + $anchor)
      $patched = $true
    }
  }
}

if ($tsx -notmatch 'homieCompanionHumanSyncedCopy') {
  $anchors = @('<div className="h">A calmer Homie lane</div>', '<div className="h">Human Homie companion lane</div>', '<b>A calmer Homie lane</b>', '<b>Human Homie companion lane</b>')
  foreach ($a in $anchors) {
    if ($tsx.Contains($a)) {
      $copy = '<div className="homieCompanionHumanSyncedCopy"><b>Human Homie companion lane</b><p>Same warm face as the main Homie: cap, glasses, beard, kind eyes, and one calm next step.</p></div>' + "`r`n" + '              ' + $a
      $tsx = $tsx.Replace($a, $copy)
      break
    }
  }
}

$tsx = $tsx.Replace("A calmer Homie lane", "Human Homie companion lane")
$tsx = $tsx.Replace("Homie is here with you.", "Homie is here with you, warm and steady.")
$tsx = $tsx.Replace("Warm companion lane open", "Warm human companion lane open")
$tsx = $tsx.Replace("Ready for a gentle today scan: body, family, money, creative.", "Ready for one gentle next step: body, family, money, or creative.")
[System.IO.File]::WriteAllText($homie, $tsx, $utf8NoBom)

$cssPayload = Join-Path $payload "HOMIE_COMPANION_DIRECT_AVATAR_OVERRIDE.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.8d Homie Companion Lane Direct Avatar Override ===== */"
$end = "/* ===== v10.38.8d Homie Companion Lane Direct Avatar Override END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.8d";')
  if ($ver -notmatch 'HOMIE_COMPANION_DIRECT_AVATAR_OVERRIDE_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_COMPANION_DIRECT_AVATAR_OVERRIDE_PASS = "v10.38.8d_HomieCompanionLaneDirectAvatarOverridePass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.8d] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
