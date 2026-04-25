import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.95";
const root = process.cwd();
const homiePath = path.join(root, "ui", "src", "panels", "Homie.tsx");
const unifiedAvatarPath = path.join(root, "ui", "src", "components", "HomieUnifiedAvatar.tsx");

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
function sanitizeLegacyCard(card) {
  let out = card;

  if (!out.includes('data-homie-legacy-preview="v10.36.95"')) {
    out = out.replace('<div className="card"', '<div className="card" data-homie-legacy-preview="v10.36.95"');
  }

  out = out.replace(/>Full body avatar</g, '>Legacy avatar<');
  out = out.replace(/>Web fallback</g, '>Older preview<');
  out = out.replace(/Homie 3D Companion — full body mode/g, 'Legacy avatar stage');
  out = out.replace(/Homie 3D Companion - full body mode/g, 'Legacy avatar stage');
  out = out.replace(/Definitely not just an orb anymore lol\./g, 'Older experimental stage kept only for comparison against the unified hoodie companion.');
  out = out.replace(/cam off • mic off • web fallback/g, 'legacy preview • hidden by default • comparison only');

  return out;
}
function findAiSectionRange(text) {
  const start = text.indexOf('{tab === "ai" && (');
  if (start === -1) return null;

  const end = text.indexOf('{tab === "guide" && (', start);
  if (end === -1) return null;

  return { start, end };
}

ensure(homiePath);
ensure(unifiedAvatarPath);
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

const aiRange = findAiSectionRange(src);
if (!aiRange) fail('Could not find the AI tab render section.');

let aiSection = src.slice(aiRange.start, aiRange.end);
let aiInner = aiSection;

// strip prior injected visual-lead cards if any
for (const marker of [
  'data-homie-visual-unify="v10.36.92"',
  'data-homie-unified-lead="v10.36.93"',
  'data-homie-unified-lead="v10.36.93b"',
  'data-homie-unified-lead="v10.36.94"',
  'data-homie-legacy-disclosure="v10.36.93"',
  'data-homie-legacy-disclosure="v10.36.93b"',
  'data-homie-legacy-toggle="v10.36.94"',
  'data-homie-hard-render-split="v10.36.94"',
]) {
  if (aiInner.includes(marker)) aiInner = removeEnclosingCardByNeedle(aiInner, marker);
}

const legacyNeedles = [
  "Homie 3D Companion — full body mode",
  "Homie 3D Companion - full body mode",
  "Legacy avatar stage",
];
let legacyRange = null;
for (const needle of legacyNeedles) {
  legacyRange = findEnclosingCardRange(aiInner, needle);
  if (legacyRange) break;
}
if (!legacyRange) fail("Could not find the legacy purple avatar card inside the AI tab.");
const legacyCard = sanitizeLegacyCard(aiInner.slice(legacyRange.start, legacyRange.end));
let remainingAi = (aiInner.slice(0, legacyRange.start) + aiInner.slice(legacyRange.end)).replace(/\n{3,}/g, "\n\n");

// remove the raw tab wrapper so we only keep the content fragment
remainingAi = remainingAi
  .replace(/^\{tab === "ai" && \(\s*<>\s*/s, "")
  .replace(/\s*<\/>\s*\)\}\s*$/s, "")
  .trim();

const leadBlock = `      {tab === "ai" && (
        <>
          <div className="card softCard" data-homie-ai-direct-rewrite="v10.36.95" data-homie-unified-lead="v10.36.95" style={{ marginTop: 12, borderColor: "rgba(154,230,255,0.24)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Unified companion lead</div>
                <div className="sub">This AI tab was directly rewritten so the hoodie companion is the only default lead stage. The old purple stage now lives behind a true legacy preview lower down.</div>
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
                <div className="h">Direct rewrite complete</div>
                <div className="sub">This stops trying to hide the wrong stage after render. The AI tab now renders the right companion first and only brings back the older stage through the legacy disclosure below.</div>

                <div className="assistantChipWrap" style={{ marginTop: 12 }}>
                  <span className="badge">Single lead lane</span>
                  <span className="badge">Legacy hidden by default</span>
                  <span className="badge">Web + desktop aligned</span>
                  <span className="badge">Desktop-safe fallback</span>
                </div>

                <div className="timelineCard" style={{ marginTop: 12 }}>
                  <b>Best next move:</b> keep shaping the good companion in Clone Studio and only open the legacy stage when you explicitly want to compare.
                </div>

                <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                  <button className="tabBtn active" onClick={() => addQuick("Keep Homie in the unified companion lead lane and only show the legacy preview when I explicitly ask for it.")}>Lock this lead lane</button>
                  <button className="tabBtn" onClick={() => onNavigate("HomieCloneStudio")}>Open Clone Studio</button>
                  <button className="tabBtn" onClick={() => onNavigate("Books")}>Open Writers Lounge</button>
                  <button className="tabBtn" onClick={() => onNavigate("Preferences")}>Open Preferences</button>
                </div>

                <div className="small" style={{ marginTop: 10 }}>
                  Honest note: the older experimental stage still exists, but it no longer renders as the default visual owner of the AI tab.
                </div>
              </div>
            </div>
          </div>

`;

const legacyToggleBlock = `
          <div className="card softCard" data-homie-legacy-toggle="v10.36.95" style={{ marginTop: 12, borderColor: "rgba(154,230,255,0.14)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Legacy preview</div>
                <div className="sub">Older purple experimental stage. Hidden by default so it cannot define the main visual impression.</div>
              </div>
              <button className="tabBtn" onClick={() => setShowLegacyAvatar((v) => !v)}>
                {showLegacyAvatar ? "Hide legacy preview" : "Show legacy preview"}
              </button>
            </div>
            <div className="small" style={{ marginTop: 10 }}>
              This is the only doorway to the older stage now.
            </div>
          </div>

          {showLegacyAvatar ? (
${legacyCard}
          ) : null}
        </>
      )}

`;

const rewrittenAi = leadBlock + remainingAi + "\n\n" + legacyToggleBlock;

src = src.slice(0, aiRange.start) + rewrittenAi + src.slice(aiRange.end);

fs.writeFileSync(homiePath, src, "utf8");

console.log("[" + VERSION + "] Applied Homie AI tab direct rewrite single visual lane pass.");
console.log("Touched:");
console.log("- ui/src/panels/Homie.tsx");