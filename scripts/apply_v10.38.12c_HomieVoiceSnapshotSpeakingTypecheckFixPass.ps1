$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$homie = Join-Path $root "ui\src\panels\Homie.tsx"
$version = Join-Path $root "ui\src\lib\version.ts"

if (!(Test-Path $homie)) { throw "Missing ui\src\panels\Homie.tsx. Run from C:\OddEngine." }

Write-Host "[v10.38.12c] Fixing VoiceEngineSnapshot.speaking typecheck issue..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$tsx = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)

# Add type-safe helper near other voice helpers.
if ($tsx -notmatch 'function isHomieVoiceSnapshotSpeaking') {
$helper = @'
function isHomieVoiceSnapshotSpeaking(snapshot: VoiceEngineSnapshot) {
  const loose = snapshot as VoiceEngineSnapshot & {
    speaking?: boolean;
    isSpeaking?: boolean;
    ttsPlaying?: boolean;
    status?: string;
    mode?: string;
  };
  const text = `${loose.status || ""} ${loose.mode || ""}`.toLowerCase();
  return Boolean(loose.speaking || loose.isSpeaking || loose.ttsPlaying || text.includes("speaking") || text.includes("talking"));
}

'@

  $anchors = @(
    'function getHomieWarmVoiceLine(snapshot: VoiceEngineSnapshot) {',
    'function explainVoicePlain(snapshot: VoiceEngineSnapshot) {',
    'export default function Homie'
  )

  $patched = $false
  foreach ($anchor in $anchors) {
    if ($tsx.Contains($anchor)) {
      $tsx = $tsx.Replace($anchor, $helper + $anchor)
      $patched = $true
      break
    }
  }

  if (-not $patched) {
    throw "Could not find a safe anchor for isHomieVoiceSnapshotSpeaking helper."
  }
}

# Replace direct snapshot.speaking usage in Homie.tsx.
$tsx = $tsx.Replace('snapshot.speaking', 'isHomieVoiceSnapshotSpeaking(snapshot)')
$tsx = $tsx.Replace('voiceSnapshot.speaking', 'isHomieVoiceSnapshotSpeaking(voiceSnapshot)')

# Safety cleanup if replacement accidentally created weird helper chaining.
$tsx = $tsx.Replace('isHomieVoiceSnapshotSpeaking(isHomieVoiceSnapshotSpeaking(voiceSnapshot))', 'isHomieVoiceSnapshotSpeaking(voiceSnapshot)')
$tsx = $tsx.Replace('isHomieVoiceSnapshotSpeaking(isHomieVoiceSnapshotSpeaking(snapshot))', 'isHomieVoiceSnapshotSpeaking(snapshot)')

[System.IO.File]::WriteAllText($homie, $tsx, $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.12c";')
  if ($ver -notmatch 'HOMIE_VOICE_SNAPSHOT_SPEAKING_TYPECHECK_FIX_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_VOICE_SNAPSHOT_SPEAKING_TYPECHECK_FIX_PASS = "v10.38.12c_HomieVoiceSnapshotSpeakingTypecheckFixPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.12c] Applied. Direct .speaking access removed from Homie.tsx." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
