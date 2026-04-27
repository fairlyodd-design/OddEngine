$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$homie = Join-Path $root "ui\src\panels\Homie.tsx"
$hud = Join-Path $root "ui\src\components\FairlyGodModeHUD.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $homie)) { throw "Missing ui\src\panels\Homie.tsx. Run from C:\OddEngine." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.7] Applying Homie presence/calm/memory/operator polish..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$tsx = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)

$tsx = [regex]::Replace($tsx, 'title="Homie[^"]*"', 'title="Homie"')
$tsx = $tsx.Replace('subtitle="Dev buddy + family guide + local AI helper"', 'subtitle="Warm OS companion, family guide, and local AI helper"')
$tsx = [regex]::Replace($tsx, 'You are Homie[^,]*, the built-in assistant for OddEngine\.', 'You are Homie, the warm built-in companion for FairlyOdd OS.')
$tsx = $tsx.Replace('- Be short, clear, and practical.', '- Be calm, clear, kind, and practical.')
$tsx = $tsx.Replace('- Help the family route to the right panel and reflect the current house/chores priorities when relevant.', '- Help route the user to the right panel. When family, legacy, health, money, or next steps are involved, be gentle and specific.')

if ($tsx -notmatch 'function buildHomieThemeList') {
$helpers = @'
function buildHomieThemeList(activePanelId?: string) {
  const legacy = loadJSON<any>("oddengine:fairlygodmode:legacyOpenFirst:v1", {});
  const mode = loadJSON<any>("oddengine:fairlygodmode:activeMode:v1", {});
  const themes = new Set<string>();
  themes.add("next move");
  if (activePanelId) themes.add(activePanelId);
  if (legacy?.familyMessage || legacy?.importantNotes) themes.add("family legacy");
  if (mode?.name) themes.add(mode.name);
  themes.add("body / mind");
  themes.add("money");
  themes.add("studio");
  return Array.from(themes).slice(0, 7);
}

function summarizeHomieMemory(messages: ChatMsg[]) {
  const recent = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content.replace(/\s+/g, " ").slice(0, 110));
  return recent.length ? recent : ["No recent check-ins yet. Start with: Homie, what should I do next?"];
}

function getLegacyOpenFirstBrief() {
  const legacy = loadJSON<any>("oddengine:fairlygodmode:legacyOpenFirst:v1", {});
  return {
    title: legacy?.welcomeTitle || "Open First",
    body:
      legacy?.familyMessage ||
      legacy?.welcomeBody ||
      "Legacy mode is ready. Add family notes, open-first guidance, and important next steps in FG/GOD -> Legacy.",
    important: legacy?.importantNotes || "No important notes saved yet.",
  };
}

function explainVoicePlain(snapshot: VoiceEngineSnapshot) {
  const summary = summarizeVoiceEngine(snapshot);
  if (snapshot.listening) return "Mic/listening lane is active. Homie is ready to hear you.";
  if (snapshot.speaking) return "Voice output is active. Homie is talking.";
  if (summary.toLowerCase().includes("degraded")) return "Voice is partly available, but one lane needs attention. Typed Homie stays safe.";
  if (summary.toLowerCase().includes("unavailable")) return "Voice is limited right now. Typed Homie and FairlyGodMode commands still work.";
  return summary || "Voice status is calm. Typed commands are always safe.";
}

'@
  $tsx = $tsx.Replace('export default function Homie', $helpers + 'export default function Homie')
}

if ($tsx -notmatch 'const homieThemes = useMemo') {
  $anchor = 'const operatorBrain = useMemo(() => getOperatorBrainSnapshot(), [choresTick, activePanelId]);'
  $insert = $anchor + "`r`n" + @'
  const homieThemes = useMemo(() => buildHomieThemeList(activePanelId), [activePanelId, messages.length]);
  const homieRecentMemory = useMemo(() => summarizeHomieMemory(messages), [messages]);
  const homieLegacyBrief = useMemo(() => getLegacyOpenFirstBrief(), [messages.length, activePanelId]);
  const homieVoicePlain = useMemo(() => explainVoicePlain(voiceSnapshot), [voiceSnapshot]);
'@
  $tsx = $tsx.Replace($anchor, $insert)
}

if ($tsx -notmatch 'data-homie-presence-board="v10.38.7"') {
  $anchor = '      {tab === "ai" && ('
  $board = @'
      <div className="card softCard homiePresenceBoard" data-homie-presence-board="v10.38.7">
        <div className="homiePresenceTop">
          <div className="homiePresencePane">
            <div className="homiePresenceTitle">I am here with you.</div>
            <div className="homiePresenceText">
              Homie is tuned for calm next steps: body, mind, family, money, studio, and what to open next.
            </div>
            <div className="homiePresenceChips">
              {homieThemes.map((theme) => <span key={theme} className="homiePresenceChip">{theme}</span>)}
            </div>
            <div className="homieSoftPromptRow">
              <button className="tabBtn" onClick={() => addQuick("Homie, what should I do next?")}>Next move</button>
              <button className="tabBtn" onClick={() => addQuick("Homie, explain this panel like I am tired.")}>Explain this panel</button>
              <button className="tabBtn" onClick={() => addQuick("Homie, help me leave clear notes for my family.")}>Legacy notes</button>
              <button className="tabBtn" onClick={() => onNavigate?.("Home")}>Open Home</button>
            </div>
          </div>

          <div className="homiePresencePane">
            <div className="homiePresenceTitle">Memory + voice clarity</div>
            <div className="homieVoicePlain">
              <div className="small">Voice / mic in plain English</div>
              <div className="homiePresenceText">{homieVoicePlain}</div>
            </div>
            <div className="homieMemoryList">
              {homieRecentMemory.map((item, idx) => (
                <div key={idx} className="homieMemoryItem">{item}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="homiePresencePane" style={{ marginTop: 12 }}>
          <div className="homiePresenceTitle">{homieLegacyBrief.title} family handoff</div>
          <div className="homiePresenceText">{homieLegacyBrief.body}</div>
          <div className="homiePresenceText"><b>Important note:</b> {homieLegacyBrief.important}</div>
          <div className="homieSoftPromptRow">
            <button className="tabBtn active" onClick={() => addQuick("Homie, show me the family open-first plan.")}>Ask Homie for Open First</button>
            <button className="tabBtn" onClick={() => onNavigate?.("FamilyBudget")}>Open budget</button>
            <button className="tabBtn" onClick={() => onNavigate?.("FamilyHealth")}>Open family health</button>
          </div>
        </div>
      </div>

'@ + $anchor
  $tsx = $tsx.Replace($anchor, $board)
}

[System.IO.File]::WriteAllText($homie, $tsx, $utf8NoBom)

if (Test-Path $hud) {
  $hudText = [System.IO.File]::ReadAllText($hud, [System.Text.Encoding]::UTF8)
  $hudText = $hudText.Replace("Homie Operator Bridge", "Homie calm operator bridge")
  $hudText = $hudText.Replace("Type what you want Homie to do. This bridge routes plain language into safe FairlyGodMode actions.", "Tell Homie what you need in plain English. Homie will route safe actions, explain warnings, or guide the next step without changing risky systems.")
  $hudText = $hudText.Replace("Homie operator reply", "Homie reply")
  [System.IO.File]::WriteAllText($hud, $hudText, $utf8NoBom)
}

$cssPayload = Join-Path $payload "HOMIE_PRESENCE_CALM_MEMORY_OPERATOR_POLISH.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.7 Homie Presence Calm Memory + Operator Polish ===== */"
$end = "/* ===== v10.38.7 Homie Presence Calm Memory + Operator Polish END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.7";')
  if ($ver -notmatch 'HOMIE_PRESENCE_CALM_MEMORY_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_PRESENCE_CALM_MEMORY_PASS = "v10.38.7_HomiePresenceCalmMemoryAndOperatorPolishPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.7] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
