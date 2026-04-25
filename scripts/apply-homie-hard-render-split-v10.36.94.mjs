import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.94";
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
function findEnclosingCardRange(text, needle) {
  const idx = text.indexOf(needle);
  if (idx === -1) return null;

  const start = text.lastIndexOf('<div className="card', idx);
  if (start === -1) return null;

  const tokenRe = /<div\b|<\/div>/g;
  tokenRe.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tokenRe.exec(text))) {
    if (match[0].startsWith("<div")) depth += 1;
    else depth -= 1;
    if (depth === 0) {
      return { start, end: tokenRe.lastIndex };
    }
  }
  return null;
}
function removeEnclosingCardByNeedle(text, needle) {
  const range = findEnclosingCardRange(text, needle);
  if (!range) return text;
  return (text.slice(0, range.start) + text.slice(range.end)).replace(/\n{3,}/g, "\n\n");
}
function wrapLegacyCardWithGate(text) {
  const needles = [
    "Homie 3D Companion — full body mode",
    "Homie 3D Companion - full body mode",
    "Legacy avatar stage",
  ];
  let range = null;
  for (const needle of needles) {
    range = findEnclosingCardRange(text, needle);
    if (range) break;
  }
  if (!range) fail("Could not find legacy avatar card block to gate.");

  const original = text.slice(range.start, range.end);
  if (original.includes("data-homie-hard-render-legacy-gate=\"v10.36.94\"")) return text;

  const gated = `{showLegacyAvatar ? (
${original.replace('<div className="card"', '<div className="card" data-homie-hard-render-legacy-gate="v10.36.94"')}
) : null}`;

  return text.slice(0, range.start) + gated + text.slice(range.end);
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

// remove prior experimental inserted lead/disclosure blocks so there is only one main lead lane
for (const marker of [
  'data-homie-visual-unify="v10.36.92"',
  'data-homie-unified-lead="v10.36.93"',
  'data-homie-unified-lead="v10.36.93b"',
  'data-homie-legacy-disclosure="v10.36.93"',
  'data-homie-legacy-disclosure="v10.36.93b"',
]) {
  if (src.includes(marker)) src = removeEnclosingCardByNeedle(src, marker);
}

if (!src.includes('data-homie-hard-render-split="v10.36.94"')) {
  src = replaceOnce(
    src,
    '{tab === "ai" && (\n        <>\n',
    `{tab === "ai" && (
        <>
          <div className="card softCard" data-homie-hard-render-split="v10.36.94" data-homie-unified-lead="v10.36.94" style={{ marginTop: 12, borderColor: "rgba(154,230,255,0.24)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Unified companion lead</div>
                <div className="sub">This is now the actual top/default Homie visual lane. The hoodie companion renders first, and the older purple stage only appears through the legacy toggle below.</div>
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
                <div className="h">Render split fixed</div>
                <div className="sub">Startup is fine. Bridge is fine. Rendering is fine. The real issue was render-tree order. This pass makes the newer companion the real lead stage and gates the legacy stage behind a toggle.</div>

                <div className="assistantChipWrap" style={{ marginTop: 12 }}>
                  <span className="badge">Lead stage first</span>
                  <span className="badge">Legacy hidden by default</span>
                  <span className="badge">Web + desktop aligned</span>
                  <span className="badge">Desktop-safe fallback</span>
                </div>

                <div className="timelineCard" style={{ marginTop: 12 }}>
                  <b>Best next move:</b> keep shaping the good companion lane in Clone Studio and only open legacy preview if you explicitly want side-by-side comparison.
                </div>

                <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                  <button className="tabBtn active" onClick={() => addQuick("Keep Homie in the unified companion lead lane and only show legacy preview when I explicitly ask for it.")}>Lock this lead lane</button>
                  <button className="tabBtn" onClick={() => onNavigate("HomieCloneStudio")}>Open Clone Studio</button>
                  <button className="tabBtn" onClick={() => onNavigate("Books")}>Open Writers Lounge</button>
                  <button className="tabBtn" onClick={() => onNavigate("Preferences")}>Open Preferences</button>
                </div>

                <div className="small" style={{ marginTop: 10 }}>
                  Honest note: the old experimental stage still exists, but it is no longer allowed to own the top of the panel by default.
                </div>
              </div>
            </div>
          </div>

          <div className="card softCard" data-homie-legacy-toggle="v10.36.94" style={{ marginTop: 12, borderColor: "rgba(154,230,255,0.14)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Legacy preview</div>
                <div className="sub">Older Full body avatar / Web fallback stage. Hidden by default so it cannot define the main visual impression.</div>
              </div>
              <button className="tabBtn" onClick={() => setShowLegacyAvatar((v) => !v)}>
                {showLegacyAvatar ? "Hide legacy preview" : "Show legacy preview"}
              </button>
            </div>
            <div className="small" style={{ marginTop: 10 }}>
              This is now the only doorway to the older purple stage.
            </div>
          </div>

`,
    "Homie AI opening fragment"
  );
}

// hard gate the legacy stage in the actual render tree
src = wrapLegacyCardWithGate(src);

// remove the loud legacy chips from the default visible lane copy if present
src = src.replace(/>Full body avatar</g, '>Legacy avatar</');
src = src.replace(/>Web fallback</g, '>Older preview</');

fs.writeFileSync(homiePath, src, "utf8");

console.log("[" + VERSION + "] Applied Homie hard render split + legacy stage toggle pass.");
console.log("Touched:");
console.log("- ui/src/panels/Homie.tsx");