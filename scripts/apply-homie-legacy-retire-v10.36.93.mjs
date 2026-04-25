import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.93";
const root = process.cwd();
const homiePath = path.join(root, "ui", "src", "panels", "Homie.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
function ensure(filePath) {
  if (!fs.existsSync(filePath)) fail("Missing file: " + filePath);
}
function backup(filePath) {
  const dst = filePath + ".bak_" + VERSION;
  if (!fs.existsSync(dst)) fs.copyFileSync(filePath, dst);
}
function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) fail("Could not find anchor: " + label);
  return text.replace(from, to);
}

ensure(homiePath);
backup(homiePath);

let src = fs.readFileSync(homiePath, "utf8");

if (!src.includes('import HomieUnifiedAvatar from "../components/HomieUnifiedAvatar";')) {
  src = replaceOnce(
    src,
    'import { getOperatorBrainSnapshot, runOperatorBrainNextAction } from "../lib/operatorBrain";',
    'import { getOperatorBrainSnapshot, runOperatorBrainNextAction } from "../lib/operatorBrain";\nimport HomieUnifiedAvatar from "../components/HomieUnifiedAvatar";',
    "Homie import HomieUnifiedAvatar"
  );
}

if (!src.includes('const [showLegacyAvatar, setShowLegacyAvatar] = useState(false);')) {
  src = replaceOnce(
    src,
    '  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceEngineSnapshot>(() => loadVoiceEngineSnapshot());',
    '  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceEngineSnapshot>(() => loadVoiceEngineSnapshot());\n  const [showLegacyAvatar, setShowLegacyAvatar] = useState(false);',
    "Homie showLegacyAvatar state"
  );
}

if (!src.includes('const homiePanelRef = useRef<HTMLDivElement | null>(null);')) {
  src = replaceOnce(
    src,
    '  const [busy, setBusy] = useState(false);\n  const chatRef = useRef<HTMLDivElement | null>(null);',
    '  const [busy, setBusy] = useState(false);\n  const chatRef = useRef<HTMLDivElement | null>(null);\n  const homiePanelRef = useRef<HTMLDivElement | null>(null);',
    "Homie homiePanelRef"
  );
}

if (!src.includes('data-homie-legacy-stage-retired="v10.36.93"')) {
  src = replaceOnce(
    src,
    '  const guide = useMemo(',
    `  useEffect(() => {
    if (tab !== "ai") return;
    const raf = requestAnimationFrame(() => {
      const rootEl = homiePanelRef.current;
      if (!rootEl) return;

      const legacyCard = Array.from(rootEl.querySelectorAll<HTMLElement>(".card")).find((el) => {
        const text = el.textContent || "";
        return text.includes("Homie 3D Companion - full body mode") || text.includes("Legacy avatar stage") || text.includes("Homie 3D Companion — full body mode");
      });

      if (legacyCard) {
        legacyCard.style.display = showLegacyAvatar ? "" : "none";
        legacyCard.setAttribute("data-homie-legacy-stage-retired", "v10.36.93");
      }

      const olderUnified = rootEl.querySelector<HTMLElement>('[data-homie-visual-unify="v10.36.92"]');
      if (olderUnified) {
        olderUnified.style.display = "none";
        olderUnified.setAttribute("data-homie-visual-unify-retired", "v10.36.93");
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [tab, showLegacyAvatar, busy, voiceSnapshot.listening]);

  const guide = useMemo(`,
    "Homie legacy hide effect"
  );
}

if (!src.includes('data-homie-unified-lead="v10.36.93"')) {
  src = replaceOnce(
    src,
    '{tab === "ai" && (\n        <>\n',
    `{tab === "ai" && (
        <>
          <div className="card softCard" data-homie-unified-lead="v10.36.93" style={{ marginTop: 12, borderColor: "rgba(154,230,255,0.24)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Unified companion lead</div>
                <div className="sub">This is now the main Homie visual lane. Web and desktop should lead with the same hoodie companion instead of the older purple stage.</div>
              </div>
              <span className={\`badge \${voiceSnapshot.listening ? "good" : "muted"}\`}>{voiceSnapshot.listening ? "Listening" : "Lead visual ready"}</span>
            </div>

            <div className="grid2" style={{ alignItems: "start", marginTop: 12 }}>
              <div className="card" style={{ background: "rgba(6,12,24,0.38)", borderColor: "rgba(154,230,255,0.14)" }}>
                <HomieUnifiedAvatar
                  mood={voiceSnapshot.listening ? "good" : "idle"}
                  isListening={voiceSnapshot.listening}
                  isSpeaking={busy}
                  gesture={voiceSnapshot.listening ? "tilt" : "none"}
                />
              </div>

              <div className="card" style={{ background: "rgba(6,12,24,0.38)", borderColor: "rgba(154,230,255,0.14)" }}>
                <div className="h">Why this is the main stage now</div>
                <div className="sub">Startup, bridge, and rendering are working. The real issue was visual priority. This pass retires the old stage from the lead position and keeps the good companion styling front and center.</div>

                <div className="assistantChipWrap" style={{ marginTop: 12 }}>
                  <span className="badge">Unified lead</span>
                  <span className="badge">Web + desktop aligned</span>
                  <span className="badge">Desktop-safe fallback</span>
                  <span className="badge">Good companion styling first</span>
                </div>

                <div className="timelineCard" style={{ marginTop: 12 }}>
                  <b>Best next move:</b> shape tone in Clone Studio, then keep the older experimental stage hidden unless you explicitly want to compare it.
                </div>

                <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                  <button className="tabBtn active" onClick={() => addQuick("Keep Homie in the unified companion lead lane and leave the legacy preview hidden unless I ask for it.")}>Lock this lead lane</button>
                  <button className="tabBtn" onClick={() => onNavigate("HomieCloneStudio")}>Open Clone Studio</button>
                  <button className="tabBtn" onClick={() => onNavigate("Books")}>Open Writers Lounge</button>
                  <button className="tabBtn" onClick={() => onNavigate("Preferences")}>Open Preferences</button>
                </div>

                <div className="small" style={{ marginTop: 10 }}>
                  Honest note: this pass fixes the priority problem. It does not delete the old experimental stage - it hides it behind a small disclosure.
                </div>
              </div>
            </div>
          </div>

          <div className="card softCard" data-homie-legacy-disclosure="v10.36.93" style={{ marginTop: 12, borderColor: "rgba(154,230,255,0.14)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Legacy preview</div>
                <div className="sub">Older purple experimental stage. Hidden by default so it does not define the main visual impression.</div>
              </div>
              <button className="tabBtn" onClick={() => setShowLegacyAvatar((v) => !v)}>
                {showLegacyAvatar ? "Hide legacy preview" : "Show legacy preview"}
              </button>
            </div>
            <div className="small" style={{ marginTop: 10 }}>
              The older "Full body avatar / Web fallback" stage is no longer the lead lane. Use this only if you want to compare against the newer unified hoodie companion.
            </div>
          </div>

`,
    "Homie AI tab opening"
  );
}

const pageAnchor = '<div className="page" style={{ maxWidth: 1100, margin: "0 auto" }}>';
if (src.includes(pageAnchor) && !src.includes('ref={homiePanelRef}')) {
  src = src.replace(pageAnchor, '<div ref={homiePanelRef} className="page" style={{ maxWidth: 1100, margin: "0 auto" }}>');
}

fs.writeFileSync(homiePath, src, "utf8");

console.log("[" + VERSION + "] Applied Homie legacy stage retire + unified companion lead pass.");
console.log("Touched:");
console.log("- ui/src/panels/Homie.tsx");
