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

Write-Host "[v10.38.9] Applying Homie living presence + voice warmth..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# -----------------------------
# HomieBuddy.tsx: source-level presence state on avatarContents.
# -----------------------------
$tsx = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)

if ($tsx -notmatch 'function getHomieLivingPresenceState') {
$helper = @'
function getHomieLivingPresenceState(args: { isListening?: boolean; isSpeaking?: boolean; mood?: string; status?: string; activeTitle?: string }) {
  const text = `${args.status || ""} ${args.activeTitle || ""}`.toLowerCase();
  if (args.isListening) return "listening";
  if (args.isSpeaking) return "speaking";
  if (text.includes("legacy") || text.includes("open first") || text.includes("family")) return "legacy";
  if (args.mood === "warn" || text.includes("care") || text.includes("overwhelm") || text.includes("tired")) return "caring";
  if (text.includes("checking") || text.includes("thinking") || text.includes("bridge")) return "thinking";
  return "idle";
}

function getHomieVoiceWarmthLine(args: { isListening?: boolean; isSpeaking?: boolean; diagnostics?: any; voiceModeLabel?: string }) {
  const permission = args.diagnostics?.permissionState || "unknown";
  if (args.isListening) return "Mic is ready. Say one short sentence and I will stay with you.";
  if (args.isSpeaking) return "Voice output is active. I am talking now.";
  if (permission === "granted") return "Mic is ready when you want it. Typed mode is safe too.";
  if (permission === "denied") return "Mic is blocked. Typed mode is safe, and you can re-enable mic permission when ready.";
  return "Bridge is checking. Typed mode is safe while I verify voice and mic.";
}

'@
  if ($tsx.Contains('export default function HomieBuddy')) {
    $tsx = $tsx.Replace('export default function HomieBuddy', $helper + 'export default function HomieBuddy')
  } elseif ($tsx.Contains('export function HomieBuddy')) {
    $tsx = $tsx.Replace('export function HomieBuddy', $helper + 'export function HomieBuddy')
  } else {
    throw "Could not find HomieBuddy export anchor."
  }
}

if ($tsx -notmatch 'livingPresenceState') {
  $anchor = 'const avatarContents = ('
  if ($tsx.Contains($anchor)) {
    $tsx = $tsx.Replace($anchor, 'const livingPresenceState = getHomieLivingPresenceState({ isListening, isSpeaking, mood, status, activeTitle });' + "`r`n" + '  const voiceWarmthLine = getHomieVoiceWarmthLine({ isListening, isSpeaking, diagnostics, voiceModeLabel });' + "`r`n" + "`r`n" + '  ' + $anchor)
  }
}

# Add data-presence-state to the human avatar root.
$tsx = $tsx.Replace('className="homieHumanBuddyCore" data-homie-buddy-human-avatar="v10.38.8g"', 'className="homieHumanBuddyCore" data-presence-state={livingPresenceState} data-homie-buddy-human-avatar="v10.38.9"')

# Add warm presence bar after consent row if missing.
if ($tsx -notmatch 'homieLivingPresenceBar') {
  $anchor = '          <div className="homieRebuildStageText">'
  if ($tsx.Contains($anchor)) {
    $insert = @'
          <div className="homieLivingPresenceBar" aria-label="Homie living presence">
            <span className={`homieLivingPresencePill ${livingPresenceState === "idle" ? "good" : ""}`}>State: {livingPresenceState}</span>
            <span className="homieLivingPresencePill">{voiceWarmthLine}</span>
          </div>

'@
    $tsx = $tsx.Replace($anchor, $insert + $anchor)
  }
}

# Warm source copy.
$tsx = $tsx.Replace('Good late night. When you are ready: what matters today - body, family, money, or creative?', 'I am here with you. What matters most right now - body, family, money, or creative?')
$tsx = $tsx.Replace('Ready for one gentle next step: body, family, money, or creative.', 'Ready for one calm next step: body, family, money, or creative.')
$tsx = $tsx.Replace('Human Homie companion lane', 'Human Homie companion lane')
$tsx = $tsx.Replace('Warm human companion lane open - body, mind,', 'Warm human companion lane open - body, mind,')

[System.IO.File]::WriteAllText($buddy, $tsx, $utf8NoBom)

# -----------------------------
# Homie.tsx: add gentle warm check-in/voice card to main panel.
# -----------------------------
$h = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)

if ($h -notmatch 'function getHomieWarmVoiceLine') {
$helpers = @'
function getHomieWarmVoiceLine(snapshot: VoiceEngineSnapshot) {
  const summary = summarizeVoiceEngine(snapshot);
  if (snapshot.listening) return "Mic is ready. Say one short sentence and I will stay with you.";
  if (snapshot.speaking) return "Voice output is active. Homie is talking now.";
  if (summary.toLowerCase().includes("checking")) return "Bridge is checking. Typed mode is safe while voice verifies.";
  if (summary.toLowerCase().includes("unavailable")) return "Voice is limited right now. Typed mode is safe.";
  if (summary.toLowerCase().includes("degraded")) return "Voice is partly available. Typed mode is safe, and one short sentence works best.";
  return "Mic is ready when you want it. Typed mode is safe too.";
}

'@
  $h = $h.Replace('export default function Homie', $helpers + 'export default function Homie')
}

if ($h -notmatch 'const homieWarmVoiceLine') {
  $anchor = 'const homieVoicePlain = useMemo(() => explainVoicePlain(voiceSnapshot), [voiceSnapshot]);'
  if ($h.Contains($anchor)) {
    $h = $h.Replace($anchor, $anchor + "`r`n" + '  const homieWarmVoiceLine = useMemo(() => getHomieWarmVoiceLine(voiceSnapshot), [voiceSnapshot]);')
  }
}

# Add a small voice warmth card and check-in grid inside the existing presence board.
if ($h -notmatch 'homieVoiceWarmthCard') {
  $anchor = '<div className="homieVoicePlain">'
  if ($h.Contains($anchor)) {
    $replacement = @'
<div className="homieVoiceWarmthCard">
              <b>Voice warmth</b>
              <p>{homieWarmVoiceLine}</p>
            </div>
            <div className="homieWarmCheckinGrid">
              <button className="homieWarmCheckinBtn" onClick={() => addQuick("Homie, help me check my body and energy first.")}><b>Body</b><span>energy, pain, food, rest</span></button>
              <button className="homieWarmCheckinBtn" onClick={() => addQuick("Homie, help me calm my mind and pick one step.")}><b>Mind</b><span>overwhelm, focus, mood</span></button>
              <button className="homieWarmCheckinBtn" onClick={() => addQuick("Homie, help me leave one useful note for my family.")}><b>Family</b><span>legacy, care, handoff</span></button>
              <button className="homieWarmCheckinBtn" onClick={() => addQuick("Homie, help me pick the safest money next move.")}><b>Money</b><span>budget, work, safety</span></button>
            </div>
            <div className="homieVoicePlain">
'@
    $h = $h.Replace($anchor, $replacement)
  }
}

# Warm prompt language.
$h = $h.Replace('Homie is tuned for calm next steps: body, mind, family, money, studio, and what to open next.', 'Homie is here for one calm next step: body, mind, family, money, studio, or what to open next.')
$h = $h.Replace('I am here with you.', 'I am here with you.')
$h = $h.Replace('No recent check-ins yet. Start with: Homie, what should I do next?', 'No recent check-ins yet. Start with: Homie, help me pick one calm next step.')

[System.IO.File]::WriteAllText($homie, $h, $utf8NoBom)

# -----------------------------
# CSS append/replace.
# -----------------------------
$cssPayload = Join-Path $payload "HOMIE_LIVING_PRESENCE_VOICE_WARMTH.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.9 Homie Living Presence + Voice Warmth ===== */"
$end = "/* ===== v10.38.9 Homie Living Presence + Voice Warmth END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.9";')
  if ($ver -notmatch 'HOMIE_LIVING_PRESENCE_VOICE_WARMTH_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_LIVING_PRESENCE_VOICE_WARMTH_PASS = "v10.38.9_HomieLivingPresenceAndVoiceWarmthPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.9] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
