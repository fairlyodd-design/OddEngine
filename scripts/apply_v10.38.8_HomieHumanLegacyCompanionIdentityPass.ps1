$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$homie = Join-Path $root "ui\src\panels\Homie.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $homie)) { throw "Missing ui\src\panels\Homie.tsx. Run from C:\OddEngine." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.8] Applying Homie human legacy companion identity..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$tsx = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)

if ($tsx -notmatch 'function HomieHumanLegacyIdentity') {
$component = @'
function HomieHumanLegacyIdentity({ addQuick, onNavigate }: { addQuick: (text: string) => void; onNavigate?: (panelId: string) => void }) {
  return (
    <div className="card softCard homieHumanIdentityBoard" data-homie-human-legacy-identity="v10.38.8">
      <div className="homieHumanIdentityGrid">
        <div className="homieHumanStage">
          <div className="homieHumanAura">
            <div className="homieHumanCap" />
            <div className="homieHumanEar left" />
            <div className="homieHumanEar right" />
            <div className="homieHumanHead" />
            <div className="homieHumanGlasses">
              <div className="homieHumanLens left"><div className="homieHumanEye left" /><div className="homieHumanBrow left" /></div>
              <div className="homieHumanLens right"><div className="homieHumanEye right" /><div className="homieHumanBrow right" /></div>
              <div className="homieHumanBridge" />
            </div>
            <div className="homieHumanNose" />
            <div className="homieHumanBeard" />
            <div className="homieHumanSmile" />
            <div className="homieHumanBody" />
            <div className="homieHumanCore" />
            <div className="homieHumanHand left" />
            <div className="homieHumanHand right" />
            <div className="homieHumanFoot" />
          </div>
          <div className="homieHumanCaption">Human-inspired Homie: cap, glasses, beard, warm smile, kind eyes.</div>
        </div>

        <div className="homieHumanCopy">
          <div className="homieHumanCard">
            <h3>Homie identity direction</h3>
            <p>
              Homie is not a clone of another companion. Homie is the FairlyOdd family guide: warm, grounded,
              lightly playful, and built to help with one clear next step.
            </p>
          </div>

          <div className="homieHumanCard">
            <h3>How Homie should feel</h3>
            <div className="homieHumanPrinciples">
              <div className="homieHumanPrinciple">Present: "I am here. We can take this one step at a time."</div>
              <div className="homieHumanPrinciple">Family-safe: explains panels without dev jargon.</div>
              <div className="homieHumanPrinciple">Grounded: helps body, mind, money, home, and creative work.</div>
              <div className="homieHumanPrinciple">Legacy-aware: knows Open First matters most.</div>
            </div>
          </div>

          <div className="homieHumanCard">
            <h3>Living presence states</h3>
            <p>Idle, listening, thinking, speaking, caring, and legacy mode are visual/wording states first. No voice engine rewrite in this pass.</p>
            <div className="homieHumanPromptRow">
              <button className="tabBtn active" onClick={() => addQuick("Homie, I need one calm next step.")}>One calm step</button>
              <button className="tabBtn" onClick={() => addQuick("Homie, help my family understand this OS.")}>Family guide</button>
              <button className="tabBtn" onClick={() => addQuick("Homie, help me write an Open First note.")}>Open First note</button>
              <button className="tabBtn" onClick={() => onNavigate?.("FamilyBudget")}>Budget</button>
              <button className="tabBtn" onClick={() => onNavigate?.("Books")}>Creative works</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'@
  $tsx = $tsx.Replace('export default function Homie', $component + 'export default function Homie')
}

# Add the identity card after the v10.38.7 presence board closes and before the AI section if not present.
if ($tsx -notmatch '<HomieHumanLegacyIdentity') {
  $anchor = '      {tab === "ai" && ('
  $insert = '      <HomieHumanLegacyIdentity addQuick={addQuick} onNavigate={onNavigate} />' + "`r`n`r`n" + $anchor
  $tsx = $tsx.Replace($anchor, $insert)
}

# Warm up default prompt if old/default text exists.
$tsx = $tsx.Replace('- Help route the user to the right panel. When family, legacy, health, money, or next steps are involved, be gentle and specific.', '- Help route the user to the right panel. When family, legacy, health, money, or next steps are involved, be gentle, specific, and grounded.')
$tsx = $tsx.Replace('- Help the family route to the right panel and reflect the current house/chores priorities when relevant.', '- Help route the user to the right panel. When family, legacy, health, money, or next steps are involved, be gentle, specific, and grounded.')

[System.IO.File]::WriteAllText($homie, $tsx, $utf8NoBom)

# Append/replace CSS.
$cssPayload = Join-Path $payload "HOMIE_HUMAN_LEGACY_COMPANION_IDENTITY.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.8 Homie Human Legacy Companion Identity ===== */"
$end = "/* ===== v10.38.8 Homie Human Legacy Companion Identity END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.8";')
  if ($ver -notmatch 'HOMIE_HUMAN_LEGACY_IDENTITY_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_HUMAN_LEGACY_IDENTITY_PASS = "v10.38.8_HomieHumanLegacyCompanionIdentityPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.8] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
