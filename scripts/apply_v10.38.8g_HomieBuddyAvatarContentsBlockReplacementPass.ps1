$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$buddy = Join-Path $root "ui\src\components\HomieBuddy.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"
if (!(Test-Path $buddy)) { throw "Missing ui\src\components\HomieBuddy.tsx. Run from C:\OddEngine." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.8g] Applying HomieBuddy avatarContents block replacement..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$tsx = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)

$tsx = [regex]::Replace($tsx, '\s*<div className="homieBuddyHumanSyncedNote">[\s\S]*?</div>\s*', "`r`n")
$tsx = [regex]::Replace($tsx, '\s*<div className="homieCompanionHumanSyncedCopy">[\s\S]*?</div>\s*', "`r`n")
$tsx = [regex]::Replace($tsx, '\s*<HomieCompanionHumanMini\s*/>\s*', "`r`n")
$tsx = [regex]::Replace($tsx, '\s*<HomieBuddyHumanAvatar\s*/>\s*', "`r`n")
$tsx = [regex]::Replace($tsx, '\s*<HomieDirectHumanAvatar\s*/>\s*', "`r`n")

$newBlock = @'
  // ===== v10.38.8g Homie Buddy human companion avatar =====
  const avatarContents = (
    <span className="homieHumanBuddyCore" data-homie-buddy-human-avatar="v10.38.8g" aria-label="Human-inspired Homie companion avatar">
      <span className="homieHumanBuddyAura" />
      <span className="homieHumanBuddyCap" />
      <span className="homieHumanBuddyEar left" />
      <span className="homieHumanBuddyEar right" />
      <span className="homieHumanBuddyHead" />
      <span className="homieHumanBuddyBrow left" />
      <span className="homieHumanBuddyBrow right" />
      <span className="homieHumanBuddyGlasses">
        <span className="homieHumanBuddyBridge" />
      </span>
      <span className="homieHumanBuddyEye left" />
      <span className="homieHumanBuddyEye right" />
      <span className="homieHumanBuddyBeard" />
      <span className="homieHumanBuddySmile" />
      <span className="homieHumanBuddyBody" />
      <span className="homieHumanBuddyCoreLight" />
      <span className="homieHumanBuddyHand left" />
      <span className="homieHumanBuddyHand right" />
      <span className="homieHumanBuddyFoot" />
      <span className="homieHumanBuddyName">HOMIE</span>
    </span>
  );
  // ===== v10.38.8g Homie Buddy human companion avatar END =====
'@

$patternOld = '(?s)\s*// ===== v10\.36\.63 Homie Buddy big full-body companion avatar =====\s*const avatarContents = \([\s\S]*?\);\s*// ===== v10\.36\.63 Homie Buddy big full-body companion avatar END ====='
$before = $tsx
$tsx = [regex]::Replace($tsx, $patternOld, "`r`n" + $newBlock)
if ($before -eq $tsx) {
  $patternFallback = '(?s)\s*const avatarContents = \([\s\S]*?\);\s*(?=const panel = \()'
  $before2 = $tsx
  $tsx = [regex]::Replace($tsx, $patternFallback, "`r`n" + $newBlock + "`r`n")
  if ($before2 -eq $tsx) { throw "Could not find avatarContents block in HomieBuddy.tsx." }
}

$tsx = $tsx.Replace('A calmer Homie lane', 'Human Homie companion lane')
$tsx = $tsx.Replace('Homie is here with you.', 'Homie is here with you, warm and steady.')
$tsx = $tsx.Replace('Warm companion lane open - body, mind,', 'Warm human companion lane open - body, mind,')
$tsx = $tsx.Replace('Warm companion lane open — body, mind,', 'Warm human companion lane open - body, mind,')
$tsx = $tsx.Replace('Ready for a gentle today scan: body, family, money, creative.', 'Ready for one gentle next step: body, family, money, or creative.')
[System.IO.File]::WriteAllText($buddy, $tsx, $utf8NoBom)

$cssPayload = Join-Path $payload "HOMIE_BUDDY_AVATAR_CONTENTS_BLOCK_REPLACEMENT.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.8g HomieBuddy Avatar Contents Block Replacement ===== */"
$end = "/* ===== v10.38.8g HomieBuddy Avatar Contents Block Replacement END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.8g";')
  if ($ver -notmatch 'HOMIE_BUDDY_AVATAR_CONTENTS_REPLACEMENT_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_BUDDY_AVATAR_CONTENTS_REPLACEMENT_PASS = "v10.38.8g_HomieBuddyAvatarContentsBlockReplacementPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}
Write-Host "[v10.38.8g] Applied." -ForegroundColor Green
Write-Host "[v10.38.8g] Replaced local avatarContents block in HomieBuddy.tsx." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
