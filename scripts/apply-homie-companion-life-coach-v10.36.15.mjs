import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const homiePath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const prefsPath = path.join(root, "ui", "src", "lib", "prefs.ts");
const stylesPath = path.join(root, "ui", "src", "styles.css");
const coachSrc = path.join(root, "ui", "src", "lib", "homieCompanionCoach.ts");
const reportPath = path.join(root, "v10.36.15-homie-companion-life-coach-report.json");
const passName = "v10.36.15_HomieCompanionLifeCoachAndVoicePresencePass";

const report = { passName, ok: false, steps: [], errors: [] };
function step(message){ console.log(`OK: ${message}`); report.steps.push(message); }
function fail(message){ console.error(`\nERROR: ${message}\n`); report.errors.push(message); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)); process.exit(1); }
function read(file){ if(!fs.existsSync(file)) fail(`Missing required file: ${path.relative(root,file)}`); return fs.readFileSync(file, "utf8"); }
function write(file, content){ fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }
function backup(file){ const rel = path.relative(root,file); const bak = `${file}.bak_v10.36.15_${Date.now()}`; fs.copyFileSync(file,bak); step(`backup created for ${rel}: ${path.basename(bak)}`); }

const coachFile = `export type HomieCompanionMood = "idle" | "good" | "warn";

export type HomieCompanionMessage = {
  id: string;
  role: "user" | "homie" | "system";
  text: string;
  ts: number;
  source?: "typed" | "voice" | "quick";
};

export type HomieCompanionContext = {
  activePanelTitle: string;
  activePanelId: string;
  status: string;
  mood: HomieCompanionMood;
  source?: "typed" | "voice" | "quick";
};

export type HomieCompanionReply = {
  text: string;
  mood: HomieCompanionMood;
  tags: string[];
  nextStep?: string;
};

const HISTORY_KEY = "oddengine:homie:companion-history:v1";
const MEMORY_KEY = "oddengine:homie:companion-memory:v1";
const MAX_HISTORY = 18;

type HomieMemory = {
  lastCheckInAt?: number;
  checkInCount?: number;
  recentThemes?: string[];
  preferredTone?: "gentle" | "hype" | "legacy";
};

function nowId(prefix = "homie") {
  return \`\${prefix}_\${Math.random().toString(36).slice(2, 8)}_\${Date.now().toString(36)}\`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: any) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function loadHomieCompanionHistory(): HomieCompanionMessage[] {
  const raw = readJson<HomieCompanionMessage[]>(HISTORY_KEY, []);
  return Array.isArray(raw) ? raw.slice(-MAX_HISTORY) : [];
}

export function saveHomieCompanionHistory(messages: HomieCompanionMessage[]) {
  writeJson(HISTORY_KEY, messages.slice(-MAX_HISTORY));
}

function loadMemory(): HomieMemory {
  return readJson<HomieMemory>(MEMORY_KEY, {});
}

function saveMemory(memory: HomieMemory) {
  writeJson(MEMORY_KEY, memory);
}

export function createHomieMessage(role: HomieCompanionMessage["role"], text: string, source: HomieCompanionMessage["source"] = "typed"): HomieCompanionMessage {
  return { id: nowId(role), role, text, ts: Date.now(), source };
}

const commandStarters = ["open ", "go to ", "switch to ", "run ", "build ", "scan ", "refresh ", "probe ", "start ", "launch ", "copy ", "install ", "grant ", "repair ", "update ", "focus ", "load chain", "voice bridge", "panel health", "morning digest", "daily digest", "what matters now", "do this next"];

export function shouldHomieCompanionAnswer(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;
  if (lower.startsWith("homie ") || lower.startsWith("hey homie") || lower.startsWith("coach me") || lower.startsWith("life coach")) return true;
  if (lower.includes("how am i doing") || lower.includes("i feel") || lower.includes("i'm feeling") || lower.includes("i am feeling")) return true;
  if (lower.includes("overwhelmed") || lower.includes("stressed") || lower.includes("scared") || lower.includes("tired") || lower.includes("sad")) return true;
  if (lower.includes("help me focus") || lower.includes("check in") || lower.includes("talk to me") || lower.includes("motivate me")) return true;
  return !commandStarters.some((starter) => lower.startsWith(starter) || lower === starter.trim());
}

function detectThemes(text: string): string[] {
  const lower = text.toLowerCase();
  const themes: string[] = [];
  if (/family|wife|kids|legacy|stacy|home/.test(lower)) themes.push("family");
  if (/trade|trading|money|income|budget|bills|debt/.test(lower)) themes.push("money");
  if (/studio|song|book|movie|writer|creative|render/.test(lower)) themes.push("creative");
  if (/health|doctor|pain|sick|tired|energy|medical/.test(lower)) themes.push("health");
  if (/overwhelm|stress|anxious|panic|scared|sad|angry|burned out/.test(lower)) themes.push("grounding");
  if (/win|solid|great|done|passed|pushed|green|worked/.test(lower)) themes.push("celebration");
  return themes.length ? themes : ["general"];
}

function cleanPrompt(text: string) {
  return text.replace(/^hey homie[:,]?\\s*/i, "").replace(/^homie[:,]?\\s*/i, "").replace(/^coach me[:,]?\\s*/i, "").trim();
}

function themeLine(themes: string[], ctx: HomieCompanionContext) {
  if (themes.includes("family")) return "I’m keeping this anchored to the family legacy lane.";
  if (themes.includes("money")) return "I’m hearing the money-pressure lane, so we keep it practical and low-chaos.";
  if (themes.includes("creative")) return "That sounds like a Studio/creative lane moment — make the next move small enough to finish.";
  if (themes.includes("health")) return "Health lane first: protect energy, keep notes, and don’t pretend you have to brute-force everything.";
  if (themes.includes("grounding")) return "Pause with me for a second: unclench your jaw, breathe in slow, and let’s shrink the problem.";
  if (themes.includes("celebration")) return "That’s a real win. We lock the checkpoint, breathe, then choose the next clean move.";
  return \`I’m here with you in \${ctx.activePanelTitle}.\`;
}

function nextStepFor(themes: string[], text: string) {
  const lower = text.toLowerCase();
  if (themes.includes("grounding")) return "Do one tiny stabilizer: water, shoulders down, then name the single next action out loud.";
  if (themes.includes("family")) return "Pick one thing that makes tomorrow easier for the family and do only the first 10 minutes.";
  if (themes.includes("money")) return "Do the lowest-risk money move first: review, protect capital, then act only if the setup is clear.";
  if (themes.includes("creative")) return "Turn the idea into one deliverable: title, outline, or first draft — not the whole universe at once.";
  if (themes.includes("health")) return "Write the symptom/question down and keep the next step realistic; urgent symptoms go to a real clinician.";
  if (lower.includes("what should")) return "Choose the next move that reduces chaos, protects the family, or creates a saved checkpoint.";
  return "Give me one sentence on what feels heaviest, and I’ll help cut it down to the next move.";
}

export function buildHomieCompanionReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply {
  const cleaned = cleanPrompt(text);
  const themes = detectThemes(cleaned || text);
  const memory = loadMemory();
  const recentThemes = [...themes, ...(memory.recentThemes || [])].filter(Boolean).slice(0, 10);
  const checkIn = /check in|how am i|how are we|life coach|coach me|ground me|help me focus/i.test(text);
  const replyParts: string[] = [];
  if (themes.includes("celebration")) replyParts.push("That’s solid, Homie. I’m proud of that one — we don’t skip the win.");
  else if (checkIn) replyParts.push("I’m with you. Let’s do the real companion check-in: body, mind, family, next move.");
  else replyParts.push("I hear you, Homie.");
  replyParts.push(themeLine(themes, ctx));
  if (themes.includes("grounding")) replyParts.push("We’re not solving the whole life stack in one breath. We’re getting you steady, then moving one clean inch forward.");
  else if (themes.includes("family")) replyParts.push("The mission is not perfection — it’s leaving something useful, loving, and usable behind them one checkpoint at a time.");
  else if (themes.includes("money")) replyParts.push("No revenge moves, no panic clicks. Protect the floor first; then we look for the cleanest next edge.");
  else if (themes.includes("creative")) replyParts.push("Let’s make it real enough to save: one artifact, one checkpoint, one pass your family can actually open later.");
  const nextStep = nextStepFor(themes, cleaned || text);
  replyParts.push(\`Next move: \${nextStep}\`);
  saveMemory({ ...memory, lastCheckInAt: Date.now(), checkInCount: (memory.checkInCount || 0) + (checkIn ? 1 : 0), recentThemes });
  const mood: HomieCompanionMood = themes.includes("grounding") || themes.includes("health") ? "warn" : "good";
  return { text: replyParts.join(" "), mood, tags: themes, nextStep };
}

export function buildHomieCompanionCheckIn(ctx: HomieCompanionContext): HomieCompanionReply {
  return buildHomieCompanionReply(\`check in from \${ctx.activePanelTitle}\`, ctx);
}
`;

if (!fs.existsSync(homiePath)) fail("HomieBuddy.tsx was not found.");
backup(homiePath);
backup(stylesPath);
if (fs.existsSync(prefsPath)) backup(prefsPath);
write(coachSrc, coachFile);
step("wrote ui/src/lib/homieCompanionCoach.ts");

let homie = read(homiePath);
if (!homie.includes("homieCompanionCoach")) {
  const anchor = `import { COMMAND_SUGGESTIONS, executeCommand } from "../lib/commandCenter";`;
  if (!homie.includes(anchor)) fail("Could not find commandCenter import anchor.");
  homie = homie.replace(anchor, `${anchor}\nimport {\n  buildHomieCompanionCheckIn,\n  buildHomieCompanionReply,\n  createHomieMessage,\n  loadHomieCompanionHistory,\n  saveHomieCompanionHistory,\n  shouldHomieCompanionAnswer,\n  type HomieCompanionMessage,\n} from "../lib/homieCompanionCoach";`);
  step("inserted companion coach import");
} else step("companion coach import already present");

if (!homie.includes("companionMode, setCompanionMode")) {
  const anchor = `const [showDiagnostics, setShowDiagnostics] = useState(mode === "standalone");`;
  if (!homie.includes(anchor)) fail("Could not find diagnostics state anchor.");
  homie = homie.replace(anchor, `${anchor}\n  const [companionMode, setCompanionMode] = useState(() => (prefs.ai as any).homieCompanionMode !== false);\n  const [companionInput, setCompanionInput] = useState("");\n  const [companionMessages, setCompanionMessages] = useState<HomieCompanionMessage[]>(() => loadHomieCompanionHistory());`);
  step("inserted companion mode state");
} else step("companion mode state already present");

if (!homie.includes("function handleCompanionConversation")) {
  const runBlock = `  function run(text: string) {
    const result = executeCommand({ text, activePanelId, onNavigate, onOpenHowTo, onStatus: (message) => announce(message, "good") });
    if (result?.message) announce(result.message, result.ok ? "good" : "warn");
  }`;
  if (!homie.includes(runBlock)) fail("Could not find run(text) block to replace.");
  const replacement = `  function appendCompanionMessages(nextMessages: HomieCompanionMessage[]) {
    setCompanionMessages((prev) => {
      const next = [...prev, ...nextMessages].slice(-18);
      saveHomieCompanionHistory(next);
      return next;
    });
  }

  function handleCompanionConversation(text: string, source: "typed" | "voice" | "quick" = "typed") {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const ctx = { activePanelTitle: activeTitle, activePanelId, status, mood, source };
    const reply = buildHomieCompanionReply(trimmed, ctx);
    appendCompanionMessages([
      createHomieMessage("user", trimmed, source),
      createHomieMessage("homie", reply.text, source),
    ]);
    announce(reply.text, reply.mood, source === "voice" || voiceEnabled);
    return true;
  }

  function runCompanionQuick(text: string) {
    handleCompanionConversation(text, "quick");
  }

  function run(text: string) {
    if (companionMode && shouldHomieCompanionAnswer(text)) {
      handleCompanionConversation(text, "voice");
      return;
    }
    const result = executeCommand({ text, activePanelId, onNavigate, onOpenHowTo, onStatus: (message) => announce(message, "good") });
    if (result?.message) announce(result.message, result.ok ? "good" : "warn");
  }`;
  homie = homie.replace(runBlock, replacement);
  step("replaced command-only run() with companion-aware run()");
} else step("companion conversation functions already present");

if (!homie.includes("homieCompanionCoachCard")) {
  const anchor = `      <div className="small homieStatusLine">{status}</div>`;
  if (!homie.includes(anchor)) fail("Could not find status line UI anchor.");
  const block = `${anchor}
      <div className="homieCompanionCoachCard card">
        <div className="cluster spread start">
          <div>
            <div className="assistantSectionTitle">Companion life coach</div>
            <div className="small">Voice-first Homie: hears through mic, talks through speakers, and keeps you grounded.</div>
          </div>
          <button
            className={\`tabBtn \${companionMode ? "active" : ""}\`}
            onClick={() => {
              const next = !companionMode;
              setCompanionMode(next);
              updateHomieRoom({ homieCompanionMode: next } as any);
              announce(next ? "Companion life coach mode is on." : "Companion mode muted. Commands still work.", next ? "good" : "idle", true);
            }}
          >
            {companionMode ? "Coach on" : "Coach off"}
          </button>
        </div>
        <div className="homieCompanionMemoryStrip">
          <span className="badge good">Warm companion</span>
          <span className="badge">Life coach</span>
          <span className="badge">Mic + speakers</span>
          <span className="badge warn">Grounded, not fake-human</span>
        </div>
        <div className="homieCompanionMessages">
          {companionMessages.length === 0 ? (
            <div className="homieCompanionEmpty small">Say “Homie, check in with me” or type what’s heavy. I’ll answer like a companion first, command router second.</div>
          ) : companionMessages.slice(-6).map((msg) => (
            <div key={msg.id} className={\`homieCompanionMsg \${msg.role}\`}>
              <span>{msg.text}</span>
            </div>
          ))}
        </div>
        <div className="row mt-3">
          <input
            value={companionInput}
            onChange={(event) => setCompanionInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                const next = companionInput.trim();
                setCompanionInput("");
                handleCompanionConversation(next, "typed");
              }
            }}
            placeholder="Talk to Homie like a companion…"
          />
          <button
            className="tabBtn active"
            onClick={() => {
              const next = companionInput.trim() || "check in with me";
              setCompanionInput("");
              handleCompanionConversation(next, "typed");
            }}
          >
            Send
          </button>
        </div>
        <div className="assistantChipWrap" style={{ marginTop: 10 }}>
          <button className="tabBtn active" onClick={() => { const reply = buildHomieCompanionCheckIn({ activePanelTitle: activeTitle, activePanelId, status, mood, source: "quick" }); appendCompanionMessages([createHomieMessage("homie", reply.text, "quick")]); announce(reply.text, reply.mood, true); }}>Check in</button>
          <button className="tabBtn" onClick={() => runCompanionQuick("help me focus on the next tiny move")}>Focus me</button>
          <button className="tabBtn" onClick={() => runCompanionQuick("I feel overwhelmed, ground me")}>Ground me</button>
          <button className="tabBtn" onClick={() => runCompanionQuick("help me protect the family legacy today")}>Legacy lane</button>
          <button className="tabBtn" onClick={() => { setOpen(true); void startVoice(false); }}>Talk by mic</button>
        </div>
      </div>`;
  homie = homie.replace(anchor, block);
  step("inserted companion life-coach UI card");
} else step("companion UI already present");

write(homiePath, homie);

let prefs = read(prefsPath);
if (!prefs.includes("homieCompanionMode")) {
  prefs = prefs.replace(`  homieIdleChatter: boolean;`, `  homieIdleChatter: boolean;\n  homieCompanionMode: boolean;\n  homieCompanionCoachStyle: "gentle" | "hype" | "legacy";\n  homieCompanionDailyCheckin: boolean;\n  homieCompanionVoiceFirst: boolean;`);
  prefs = prefs.replace(`    homieIdleChatter: true,`, `    homieIdleChatter: true,\n    homieCompanionMode: true,\n    homieCompanionCoachStyle: "legacy",\n    homieCompanionDailyCheckin: true,\n    homieCompanionVoiceFirst: true,`);
  step("patched prefs with companion defaults");
} else step("prefs companion defaults already present");
write(prefsPath, prefs);

let css = read(stylesPath);
const cssBlock = `

/* ===== v10.36.15 Homie Companion Life Coach Presence ===== */
.homieBuddyPanel{
  border-color: rgba(154, 230, 255, 0.18) !important;
}

.homieBuddyPanel::after{
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  border-radius: inherit;
  background:
    radial-gradient(260px 120px at 50% 0%, rgba(154,230,255,0.08), transparent 70%),
    radial-gradient(220px 140px at 85% 20%, rgba(255,170,220,0.07), transparent 72%);
  opacity:0.9;
}

.homieCompanionCoachCard{
  margin-top: 12px;
  position: relative;
  overflow: hidden;
  border-color: rgba(154,230,255,0.18) !important;
  background:
    radial-gradient(420px 170px at 12% 0%, rgba(154,230,255,0.11), rgba(154,230,255,0) 65%),
    radial-gradient(380px 170px at 94% 12%, rgba(255,170,220,0.10), rgba(255,170,220,0) 65%),
    rgba(8, 13, 22, 0.92) !important;
}

.homieCompanionCoachCard::before{
  content:"";
  position:absolute;
  right:-60px;
  top:-70px;
  width:160px;
  height:160px;
  border-radius:50%;
  background: radial-gradient(circle, rgba(154,230,255,0.12), transparent 70%);
  pointer-events:none;
}

.homieCompanionMemoryStrip{
  display:flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.homieCompanionMessages{
  margin-top: 10px;
  display:grid;
  gap: 8px;
  max-height: 190px;
  overflow:auto;
  padding-right: 4px;
}

.homieCompanionMsg{
  display:flex;
  line-height:1.36;
  font-size: 12.5px;
}

.homieCompanionMsg span{
  border:1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.045);
  border-radius: 15px;
  padding: 9px 10px;
  max-width: 92%;
  white-space: pre-wrap;
}

.homieCompanionMsg.user{
  justify-content:flex-end;
}

.homieCompanionMsg.user span{
  background: rgba(94,234,242,0.10);
  border-color: rgba(94,234,242,0.16);
}

.homieCompanionMsg.homie span{
  background: rgba(255,170,220,0.075);
  border-color: rgba(255,170,220,0.14);
}

.homieCompanionMsg.system span{
  background: rgba(255,209,102,0.075);
  border-color: rgba(255,209,102,0.14);
}

.homieCompanionEmpty{
  border:1px dashed rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.025);
  border-radius: 15px;
  padding: 10px;
}

.homieOrb.skin-memoji,
.homieOrb.skin-lil-homie{
  border-color: rgba(154,230,255,0.40) !important;
  box-shadow:
    0 14px 34px rgba(0,0,0,0.34),
    0 0 26px rgba(154,230,255,0.13),
    0 0 48px rgba(255,170,220,0.08) !important;
}

.homieOrb.skin-memoji.good,
.homieOrb.skin-lil-homie.good{
  box-shadow:
    0 14px 34px rgba(0,0,0,0.34),
    0 0 30px rgba(94,234,242,0.18),
    0 0 52px rgba(255,170,220,0.10) !important;
}

.homieOrb.skin-memoji.warn,
.homieOrb.skin-lil-homie.warn{
  box-shadow:
    0 14px 34px rgba(0,0,0,0.34),
    0 0 30px rgba(255,209,102,0.18),
    0 0 52px rgba(255,170,220,0.10) !important;
}

.homieHouseScene{
  border-color: rgba(154,230,255,0.14) !important;
}

.homieHouseTopbar .badge.good::after{
  content:" • alive";
  opacity:0.8;
}
/* ===== v10.36.15 Homie Companion Life Coach Presence END ===== */
`;
if (!css.includes("v10.36.15 Homie Companion Life Coach Presence")) {
  css += cssBlock;
  step("appended companion presence CSS");
} else step("companion CSS already present");
write(stylesPath, css);

// Hard validation
const finalHomie = read(homiePath);
const finalPrefs = read(prefsPath);
const finalCss = read(stylesPath);
const required = [
  [finalHomie, "buildHomieCompanionReply", "Homie companion reply import/function"],
  [finalHomie, "function handleCompanionConversation", "handleCompanionConversation"],
  [finalHomie, "homieCompanionCoachCard", "companion UI card"],
  [finalPrefs, "homieCompanionMode", "prefs companion mode"],
  [finalCss, "homieCompanionCoachCard", "companion CSS"],
  [read(coachSrc), "shouldHomieCompanionAnswer", "coach library"],
];
const missing = required.filter(([content, needle]) => !String(content).includes(String(needle))).map(([, , label]) => label);
if (missing.length) fail(`Hard validation failed. Missing: ${missing.join(", ")}`);

report.ok = true;
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log("\n✅ v10.36.15 Homie companion life coach pass applied.");
console.log(`Report written to ${path.basename(reportPath)}`);
console.log("Next: run RUN_v10.36.15_HOMIE_COMPANION_CHECK.bat");
