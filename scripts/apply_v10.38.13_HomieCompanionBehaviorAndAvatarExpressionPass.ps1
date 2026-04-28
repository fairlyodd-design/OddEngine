$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$homie = Join-Path $root "ui\src\panels\Homie.tsx"
$buddy = Join-Path $root "ui\src\components\HomieBuddy.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $homie)) { throw "Missing ui\src\panels\Homie.tsx. Run from C:\OddEngine." }
if (!(Test-Path $buddy)) { throw "Missing ui\src\components\HomieBuddy.tsx. Run from C:\OddEngine." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.13] Applying Homie companion behavior + avatar expression..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# CSS append/replace.
$cssPayload = Join-Path $payload "HOMIE_COMPANION_BEHAVIOR_AVATAR_EXPRESSION.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.13 Homie Companion Behavior + Avatar Expression ===== */"
$end = "/* ===== v10.38.13 Homie Companion Behavior + Avatar Expression END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

# Main Homie behavior cards. Uses existing addQuick function from Homie panel.
$h = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)

if ($h -notmatch 'data-homie-companion-behavior="v10.38.13"') {
  $anchor = '<div className="homieMoodLedgerCard" data-homie-mood-ledger="v10.38.10">'
  if (-not $h.Contains($anchor)) {
    $anchor = '<div className="homiePresencePane" style={{ marginTop: 12 }}>'
  }
  if ($h.Contains($anchor)) {
$deck = @'
        <div className="homieCompanionBehaviorDeck" data-homie-companion-behavior="v10.38.13">
          <div className="homieCompanionBehaviorCard">
            <b>How are you really?</b>
            <p>Homie can stay with the human part first: body, mind, family, money, creative, or legacy. No fixing everything at once.</p>
            <div className="homieCompanionPromptGrid">
              <button className="homieCompanionPromptBtn" onClick={() => addQuick("Homie, ask me a gentle check-in and help me name what I actually feel.")}><b>Gentle check-in</b><span>name the feeling</span></button>
              <button className="homieCompanionPromptBtn" onClick={() => addQuick("Homie, reflect my mood and give me one tiny next step.")}><b>Mood reflection</b><span>mirror + next move</span></button>
              <button className="homieCompanionPromptBtn" onClick={() => addQuick("Homie, help me make this useful for my family as a legacy note.")}><b>Family note</b><span>save something loving</span></button>
            </div>
          </div>
          <div className="homieCompanionBehaviorCard">
            <b>Steady companion mode</b>
            <p>I know the goal: protect your family, keep the OS useful, and make the next step small enough to actually do.</p>
          </div>
        </div>

'@
    $h = $h.Replace($anchor, $deck + $anchor)
  } else {
    throw "Could not find Homie.tsx UI anchor for companion behavior deck."
  }
}

# Homie copy updates, quote-safe.
$h = $h.Replace('Homie is your FairlyOdd family companion: warm, grounded, lightly playful, and built to stay with you through one clear next step.', 'Homie is your FairlyOdd family companion: warm, grounded, lightly playful, and steady enough to sit with the real human part before the next step.')
$h = $h.Replace('Ready for one tiny step, a plan, a memory, or a family note.', 'Ready for one tiny step, a plan, a memory, a family note, or just a minute to breathe.')
$h = $h.Replace('Present: "I am here with you. We can take this one step at a time."', 'Present: "I am here with you. No rush. One honest step at a time."')
[System.IO.File]::WriteAllText($homie, $h, $utf8NoBom)

# HomieBuddy mini behavior deck. Avoid hooks/new logic.
$b = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)

if ($b -notmatch 'data-homiebuddy-companion-behavior="v10.38.13"') {
  $anchor = '<div className="homieMoodLedgerLine" data-homie-buddy-mood-ledger="v10.38.10">'
  if (-not $b.Contains($anchor)) {
    $anchor = '<div className="homieRebuildStageText">'
  }
  if ($b.Contains($anchor)) {
$mini = @'
          <div className="homieBuddyCompanionMiniDeck" data-homiebuddy-companion-behavior="v10.38.13">
            <div className="homieCompanionBehaviorCard">
              <b>How are you really?</b>
              <p>Pick one: name the feeling, choose one tiny step, or save a family note.</p>
            </div>
            <div className="homieCompanionPromptGrid">
              <button className="homieCompanionPromptBtn" onClick={() => setDraft("Homie, ask me a gentle check-in and help me name what I actually feel.")}><b>Check in</b><span>feeling first</span></button>
              <button className="homieCompanionPromptBtn" onClick={() => setDraft("Homie, reflect my mood and give me one tiny next step.")}><b>Reflect</b><span>mood + step</span></button>
              <button className="homieCompanionPromptBtn" onClick={() => setDraft("Homie, help me make this useful for my family as a legacy note.")}><b>Legacy</b><span>family note</span></button>
            </div>
          </div>

'@
    $b = $b.Replace($anchor, $mini + $anchor)
  } else {
    throw "Could not find HomieBuddy.tsx UI anchor for mini behavior deck."
  }
}

$b = $b.Replace('Homie is here with you: warm, steady, and ready for one small step.', 'Homie is here with you: warm, steady, and ready to sit with the real human part first.')
$b = $b.Replace('Ready for one tiny step, a plan, a memory, or a family note.', 'Ready for one tiny step, a plan, a memory, a family note, or just a minute to breathe.')
[System.IO.File]::WriteAllText($buddy, $b, $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.13";')
  if ($ver -notmatch 'HOMIE_COMPANION_BEHAVIOR_AVATAR_EXPRESSION_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_COMPANION_BEHAVIOR_AVATAR_EXPRESSION_PASS = "v10.38.13_HomieCompanionBehaviorAndAvatarExpressionPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.13] Applied. Local/UI-only avatar expression + companion behavior." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
