$ErrorActionPreference = "Stop"

$rootCandidates = @(
  $PSScriptRoot,
  (Split-Path -Parent $PSScriptRoot)
) | Select-Object -Unique

$root = $null
foreach ($candidate in $rootCandidates) {
  $homieCandidate = Join-Path $candidate "ui\src\panels\Homie.tsx"
  if (Test-Path -LiteralPath $homieCandidate) {
    $root = $candidate
    break
  }
}

if (-not $root) {
  throw "Could not find ui\src\panels\Homie.tsx under $PSScriptRoot or its parent."
}

$homiePath = Join-Path $root "ui\src\panels\Homie.tsx"

function Normalize-LF([string]$text) {
  return ($text -replace "`r`n", "`n")
}

function Require-Replace([string]$text, [string]$find, [string]$replace, [string]$label) {
  if (-not $text.Contains($find)) {
    throw "Could not find anchor for $label"
  }
  return $text.Replace($find, $replace)
}

function Insert-Before-Card-With-Marker([string]$text, [string]$marker, [string]$insert, [string]$label) {
  $markerIndex = $text.IndexOf($marker)
  if ($markerIndex -lt 0) {
    throw "Could not find marker for $label"
  }
  $cardIndex = $text.LastIndexOf('<div className="card', $markerIndex)
  if ($cardIndex -lt 0) {
    throw "Could not find card start for $label"
  }
  return $text.Substring(0, $cardIndex) + $insert + $text.Substring($cardIndex)
}

$homieText = Normalize-LF (Get-Content -Raw -LiteralPath $homiePath)

if ($homieText -notmatch 'loadVoiceEngineSnapshot') {
  $homieText = Require-Replace $homieText 'import { DAILY_CHORES_EVENT, buildDailyChoresContext, computeDailyChoresSnapshot, loadDailyChoresState } from "../lib/dailyChoresCommand";' @'
import { DAILY_CHORES_EVENT, buildDailyChoresContext, computeDailyChoresSnapshot, loadDailyChoresState } from "../lib/dailyChoresCommand";
import { getVoiceEngineBadges, loadVoiceEngineSnapshot, summarizeVoiceEngine, type VoiceEngineSnapshot } from "../lib/voice";
'@ 'Homie voice imports'
}

if ($homieText -notmatch 'const \[voiceSnapshot, setVoiceSnapshot\]') {
  $homieText = Require-Replace $homieText '  const [tab, setTab] = useState<"ai" | "guide">("ai");
  const [choresTick, setChoresTick] = useState(0);' @'
  const [tab, setTab] = useState<"ai" | "guide">("ai");
  const [choresTick, setChoresTick] = useState(0);
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceEngineSnapshot>(() => loadVoiceEngineSnapshot());
'@ 'Homie voice state'
}

if ($homieText -notmatch 'oddengine:voice-engine-changed') {
  $homieText = Require-Replace $homieText @'
  const choresSnapshot = useMemo(() => {
    void choresTick;
    return computeDailyChoresSnapshot(loadDailyChoresState());
  }, [choresTick]);
'@ @'
  const choresSnapshot = useMemo(() => {
    void choresTick;
    return computeDailyChoresSnapshot(loadDailyChoresState());
  }, [choresTick]);

  useEffect(() => {
    const onVoiceEngine = () => setVoiceSnapshot(loadVoiceEngineSnapshot());
    try {
      window.addEventListener("oddengine:voice-engine-changed", onVoiceEngine as any);
      window.addEventListener("storage", onVoiceEngine as any);
    } catch {
      // ignore
    }
    return () => {
      try {
        window.removeEventListener("oddengine:voice-engine-changed", onVoiceEngine as any);
        window.removeEventListener("storage", onVoiceEngine as any);
      } catch {
        // ignore
      }
    };
  }, []);
'@ 'Homie voice effect'
}

if ($homieText -notmatch 'const recoveryGuide = useMemo') {
  $homieText = Require-Replace $homieText '  const guide = useMemo(' @'
  const recoveryGuide = useMemo(() => {
    const issues = devSnap?.issues || [];
    const currentPanel = activePanelId || "Home";

    if (!desktop) {
      return {
        tone: "warn",
        badge: "Web mode",
        headline: "Recovery is limited in browser mode.",
        body: `Homie can still route you and explain next steps, but local AI, DevEngine recovery, and the full voice lane work best in Desktop mode. Current panel: ${currentPanel}.`,
      };
    }

    if (issues.length) {
      const first = issues[0];
      const playbookHint = first.recommendedPlaybooks?.length
        ? `Safest next move: review or run ${first.recommendedPlaybooks[0]} first.`
        : "Safest next move: open DevEngine and review the latest logs before changing files.";
      return {
        tone: "bad",
        badge: `${issues.length} recovery item${issues.length === 1 ? "" : "s"}`,
        headline: first.title || "Homie spotted a live issue.",
        body: `${first.explanation || "Homie detected an issue in the current local workflow."}\n\n${playbookHint}\n\nCurrent panel: ${currentPanel}`,
      };
    }

    if (ollamaRunning === false) {
      return {
        tone: "warn",
        badge: "AI lane degraded",
        headline: "Homie chat is waiting on Ollama.",
        body: "Typed routing, panel status, and recovery guidance still work, but full local AI replies will stay degraded until Ollama is back at 127.0.0.1:11434.",
      };
    }

    if (voiceSnapshot.externalState === "degraded" || voiceSnapshot.cloudState === "degraded" || voiceSnapshot.pushToTalkState === "degraded") {
      return {
        tone: "warn",
        badge: "Voice degraded",
        headline: "Homie voice is up, but one lane is degraded.",
        body: summarizeVoiceEngine(voiceSnapshot) + "\n\nSafest next move: check Preferences or use typed commands while the voice lane settles.",
      };
    }

    if (voiceSnapshot.externalState === "unavailable" || voiceSnapshot.cloudState === "unavailable" || voiceSnapshot.pushToTalkState === "unavailable") {
      return {
        tone: "warn",
        badge: "Voice limited",
        headline: "Voice is not fully available right now.",
        body: summarizeVoiceEngine(voiceSnapshot) + "\n\nSafest next move: typed commands stay ready, and Homie can still route you to the right panel while voice is down.",
      };
    }

    return {
      tone: "good",
      badge: "Phoenix ready",
      headline: "Homie recovery lane is standing by.",
      body: "Local AI, route-ready help, and voice status look stable. If the OS feels shaky, start here for the calm next move instead of guessing.",
    };
  }, [activePanelId, desktop, devSnap, ollamaRunning, voiceSnapshot]);

  const guide = useMemo(
'@ 'Homie recovery guide memo'
}

if ($homieText -notmatch 'Phoenix recovery \+ voice status') {
  $recoveryBlock = @'
          <div className="card softCard" style={{ marginTop: 12, borderColor: "rgba(56,189,248,0.28)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Phoenix recovery + voice status</div>
                <div className="sub">Homie turns red moments into the calm next move: what broke, what still works, and where to go first.</div>
              </div>
              <span className={`badge ${recoveryGuide.tone}`}>{recoveryGuide.badge}</span>
            </div>

            <div className="timelineCard" style={{ marginTop: 12 }}>{recoveryGuide.headline}</div>
            <div className="small" style={{ marginTop: 10, whiteSpace: "pre-wrap", opacity: 0.92 }}>{recoveryGuide.body}</div>

            <div className="assistantChipWrap" style={{ marginTop: 12 }}>
              {getVoiceEngineBadges(voiceSnapshot).map((badge) => (
                <span key={badge.label} className={`badge ${badge.tone}`}>{badge.label}</span>
              ))}
            </div>
            <div className="small" style={{ marginTop: 8 }}>{summarizeVoiceEngine(voiceSnapshot)}</div>

            <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={() => addQuick("Tell me the safest recovery path right now in plain English.")}>Ask recovery guide</button>
              <button className="tabBtn" onClick={() => addQuick("What voice path is active right now and what should I do next?")}>Ask voice status</button>
              <button className={`tabBtn ${voiceSnapshot.listening ? "active" : ""}`} onClick={() => window.dispatchEvent(new CustomEvent("oddengine:voice-request", { detail: { source: "homie", action: voiceSnapshot.listening ? "stop" : "listen" } }))}>{voiceSnapshot.listening ? "Stop voice" : "Start voice"}</button>
              <button className="tabBtn" onClick={() => onNavigate(activePanelId || "Home")}>Open current panel</button>
              <button className="tabBtn" onClick={() => onNavigate("Preferences")}>Open Preferences</button>
              <button className="tabBtn" onClick={() => window.dispatchEvent(new CustomEvent("oddengine:focus-commandbar"))}>Focus command bar</button>
            </div>
          </div>

'@
  $homieText = Insert-Before-Card-With-Marker $homieText '<div style={{ fontWeight: 700 }}>Homie AI Status</div>' $recoveryBlock 'Homie Phoenix recovery UI'
}

Set-Content -LiteralPath $homiePath -Value ($homieText -replace "`n", "`r`n") -NoNewline

Write-Host "Patched Homie successfully for v10.36.6."
