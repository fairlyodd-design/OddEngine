$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$buddy = Join-Path $root "ui\src\components\HomieBuddy.tsx"
$version = Join-Path $root "ui\src\lib\version.ts"

if (!(Test-Path $buddy)) { throw "Missing ui\src\components\HomieBuddy.tsx. Run from C:\OddEngine." }

Write-Host "[v10.38.9b] Fixing HomieBuddy livingPresenceState reference..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$tsx = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)

# Ensure helper functions exist before HomieBuddy export.
if ($tsx -notmatch 'function getHomieLivingPresenceState') {
$helpers = @'
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
    $tsx = $tsx.Replace('export default function HomieBuddy', $helpers + 'export default function HomieBuddy')
  } elseif ($tsx.Contains('export function HomieBuddy')) {
    $tsx = $tsx.Replace('export function HomieBuddy', $helpers + 'export function HomieBuddy')
  } else {
    throw "Could not find HomieBuddy export anchor."
  }
}

# Remove any broken/incomplete prior definitions near avatarContents to avoid duplicate const errors.
$tsx = [regex]::Replace($tsx, '\s*const livingPresenceState = getHomieLivingPresenceState\(\{[^;]*?activeTitle\s*\}\);\s*', "`r`n")
$tsx = [regex]::Replace($tsx, '\s*const voiceWarmthLine = getHomieVoiceWarmthLine\(\{[^;]*?voiceModeLabel\s*\}\);\s*', "`r`n")

# Insert scoped consts immediately before avatarContents. This is the line that was missing.
$anchor = '  const avatarContents = ('
if (-not $tsx.Contains($anchor)) {
  throw "Could not find 'const avatarContents = (' anchor in HomieBuddy.tsx."
}
$insert = @'
  const livingPresenceState = getHomieLivingPresenceState({ isListening, isSpeaking, mood, status, activeTitle });
  const voiceWarmthLine = getHomieVoiceWarmthLine({ isListening, isSpeaking, diagnostics, voiceModeLabel });

'@
$tsx = $tsx.Replace($anchor, $insert + $anchor)

# Defensive fallback: if the data attribute somehow landed without the const, keep a valid idle fallback.
# Keep the intended live value now that const exists.
$tsx = $tsx.Replace('data-presence-state={livingPresenceState}', 'data-presence-state={livingPresenceState || "idle"}')

# Ensure the voice line UI cannot crash if inserted before value exists in some weird branch.
$tsx = $tsx.Replace('{voiceWarmthLine}</span>', '{voiceWarmthLine || "Typed mode is safe."}</span>')

[System.IO.File]::WriteAllText($buddy, $tsx, $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.9b";')
  if ($ver -notmatch 'HOMIE_LIVING_PRESENCE_REFERENCE_FIX_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_LIVING_PRESENCE_REFERENCE_FIX_PASS = "v10.38.9b_HomieLivingPresenceReferenceFixPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.9b] Applied. livingPresenceState is now defined before avatarContents." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
