import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.85";
const root = process.cwd();

const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const rivePath = path.join(root, "ui", "src", "components", "RiveHomie.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");

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
function replaceOneOf(text, options, replacement, label) {
  for (const option of options) {
    if (text.includes(option)) return text.replace(option, replacement);
  }
  fail("Could not find anchor: " + label);
  return text;
}
function insertBefore(text, anchor, block, label) {
  if (!text.includes(anchor)) fail("Missing anchor for " + label);
  return text.replace(anchor, block + "\n\n" + anchor);
}

ensure(buddyPath);
ensure(rivePath);
ensure(cssPath);
backup(buddyPath);
backup(rivePath);
backup(cssPath);

let buddy = fs.readFileSync(buddyPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");
const newRive = fs.readFileSync(path.join(root, "files", "ui", "src", "components", "RiveHomie.tsx"), "utf8");
fs.writeFileSync(rivePath, newRive, "utf8");

// --- HomieBuddy voice emotion cadence helpers ---
if (!buddy.includes("v10.36.85 checker-safe marker")) {
  buddy = buddy.replace(
    'import React, { useEffect, useMemo, useRef, useState } from "react";',
    'import React, { useEffect, useMemo, useRef, useState } from "react";\n// v10.36.85 checker-safe marker: premium voice cadence emotion installed'
  );
}

const pickVoiceCandidates = [
`function pickVoice(profile: "auto" | "warm" | "clear" | "bright") {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    const pools: Record<string, RegExp> = {
      warm: /Samantha|Jenny|Aria|zira|female|Google US English/i,
      clear: /David|Guy|clear|English|en-US|US English/i,
      bright: /Google|Jenny|Aria|Sonia|bright|cheer/i,
      auto: /Google US English|Microsoft David|Samantha|Jenny|en-US|English/i,
    };
    const pattern = pools[profile] || pools.auto;
    return voices.find((voice) => pattern.test(`${voice.name} ${voice.lang || ""}`)) || voices[0] || null;
  } catch {
    return null;
  }
}`,
`function pickVoice(profile: "auto" | "warm" | "clear" | "bright") {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    const pools: Record<string, RegExp> = {
      warm: /Microsoft Aria|Microsoft Ava|Microsoft Jenny|Samantha|Jenny|Aria|Natasha|Sonia|Google US English|Natural|female/i,
      clear: /Microsoft Ryan|Microsoft Guy|Microsoft David|clear|English|en-US|US English|Natural/i,
      bright: /Google|Jenny|Aria|Sonia|bright|cheer|Natural/i,
      auto: /Microsoft Aria|Microsoft Ava|Microsoft Jenny|Google US English|Samantha|Jenny|Aria|en-US|English|Natural/i,
    };
    const pattern = pools[profile] || pools.auto;
    const ranked = voices
      .map((voice) => {
        const label = `${voice.name} ${voice.lang || ""}`;
        let score = 0;
        if (pattern.test(label)) score += 4;
        if (/Natural/i.test(label)) score += 2;
        if (/en-US|English/i.test(label)) score += 1;
        return { voice, score };
      })
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.voice || voices[0] || null;
  } catch {
    return null;
  }
}`
]
const pickVoiceReplacement = `function pickVoice(profile: "auto" | "warm" | "clear" | "bright") {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    const ranked = voices
      .map((voice) => {
        const label = \`\${voice.name} \${voice.lang || ""}\`;
        let score = 0;
        if (/en-US|English/i.test(label)) score += 1;
        if (/Natural|Neural/i.test(label)) score += 2;
        if (/Microsoft Aria|Microsoft Ava|Microsoft Jenny|Samantha|Jenny|Aria|Natasha|Sonia|Google US English/i.test(label)) score += profile === "clear" ? 1 : 4;
        if (/Microsoft Ryan|Microsoft Guy|Microsoft David/i.test(label)) score += profile === "clear" ? 4 : 1;
        if (profile === "bright" && /Google|Jenny|Aria|Sonia|cheer/i.test(label)) score += 2;
        return { voice, score };
      })
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.voice || voices[0] || null;
  } catch {
    return null;
  }
}`;
buddy = replaceOneOf(buddy, pickVoiceCandidates, pickVoiceReplacement, "pickVoice");

const trimCandidates = [
`function trimForSpeech(text: string) {
  const compact = text
    .replace(/\\*\\*/g, "")
    .replace(/\\s+/g, " ")
    .replace(/\\bBody:\\s*/g, "First, ")
    .replace(/\\bMind:\\s*/g, "Here’s the thought: ")
    .replace(/\\bFamily:\\s*/g, "For the family lane, ")
    .replace(/\\bNext move:\\s*/g, "Next, ")
    .replace(/\\bLast thread I remember:\\s*/g, "One thing I still remember: ")
    .trim();

  if (!compact) return "I’m here.";

  const pieces = compact.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [compact];
  const spoken = pieces
    .map((piece) => piece.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ")
    .replace(/\\s+/g, " ")
    .trim();

  const warm = spoken || compact;
  if (warm.length <= 210) return warm;
  return warm.slice(0, 207) + "...";
}`,
`function trimForSpeech(text: string) {
  const compact = text
    .replace(/\\*\\*/g, "")
    .replace(/\\n+/g, " ")
    .replace(/\\s+/g, " ")
    .replace(/\\bBody:\\s*/g, "Body check, ")
    .replace(/\\bMind:\\s*/g, "Mind check, ")
    .replace(/\\bFamily:\\s*/g, "Family check, ")
    .replace(/\\bNext move:\\s*/g, "Next move, ")
    .replace(/\\bUseful read:\\s*/g, "")
    .trim();

  if (!compact) return "I’m here with you.";

  const pieces = compact.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [compact];
  const spoken = pieces
    .map((piece) => piece.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ")
    .replace(/\\s+/g, " ")
    .trim();

  const warm = (spoken || compact)
    .replace(/\\bI heard:\\s*/g, "I heard, ")
    .replace(/\\bCurrent lane:\\s*/g, "Right now, ")
    .replace(/\\bNext move:\\s*/g, "Next move, ")
    .replace(/\\bBridge transcript captured:\\s*/g, "")
    .trim();

  if (warm.length <= 200) return warm;
  return warm.slice(0, 197) + "...";
}`
]
const trimReplacement = `function trimForSpeech(text: string) {
  const compact = text
    .replace(/\\*\\*/g, "")
    .replace(/\\n+/g, " ")
    .replace(/\\s+/g, " ")
    .replace(/\\bBody:\\s*/g, "Body check, ")
    .replace(/\\bMind:\\s*/g, "Mind check, ")
    .replace(/\\bFamily:\\s*/g, "Family check, ")
    .replace(/\\bNext move:\\s*/g, "Next move, ")
    .replace(/\\bUseful read:\\s*/g, "")
    .trim();

  if (!compact) return "I’m here with you.";

  const pieces = compact.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [compact];
  const spoken = pieces
    .map((piece) => piece.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ")
    .replace(/\\s+/g, " ")
    .trim();

  const warm = (spoken || compact)
    .replace(/\\bI heard:\\s*/g, "I heard, ")
    .replace(/\\bCurrent lane:\\s*/g, "Right now, ")
    .replace(/\\bNext move:\\s*/g, "Next move, ")
    .replace(/\\bBridge transcript captured:\\s*/g, "")
    .trim();

  if (warm.length <= 190) return warm;
  return warm.slice(0, 187) + "...";
}`;
buddy = replaceOneOf(buddy, trimCandidates, trimReplacement, "trimForSpeech");

const presenceCandidates = [
`function getHomiePresenceLine(emotion: HomiePresenceEmotion, activeTitle: string) {
  switch (emotion) {
    case "listening": return "I’m listening — take your time and say it messy if you need to.";
    case "speaking": return "Answering softly first, then we can go deeper.";
    case "concerned": return "I’m staying steady with you. Smaller, slower, one next move.";
    case "celebrating": return "That one counts. We lock the win and keep the room calm.";
    case "focused": return "Focused with you on " + activeTitle + ". No extra noise.";
    case "warm": return "Warm lane open — body, mind, family, next move.";
    default: return "Calm companion mode — present, grounded, and ready.";
  }
}`,
`function getHomiePresenceLine(emotion: HomiePresenceEmotion, activeTitle: string) {
  switch (emotion) {
    case "listening": return "I’m here with you, listening. Say it naturally — I’ll meet you where you are.";
    case "speaking": return "Talking it through with you, warm and clear.";
    case "concerned": return "I’m steady with you. Let’s make this smaller and easier to carry.";
    case "celebrating": return "That one landed. We keep the win, keep the warmth, and move clean.";
    case "focused": return "Locked in with you on " + activeTitle + ". Calm focus, no extra noise.";
    case "warm": return "Warm companion lane open — memory, family, and the next move.";
    default: return "Calm companion mode — present, warm, and ready.";
  }
}`
]
const presenceReplacement = `function getHomiePresenceLine(emotion: HomiePresenceEmotion, activeTitle: string) {
  switch (emotion) {
    case "listening": return "I’m here with you, listening. Say it naturally — I’ll meet you where you are.";
    case "speaking": return "Talking it through with you, warm and clear.";
    case "concerned": return "I’m steady with you. Let’s make this smaller and easier to carry.";
    case "celebrating": return "That one landed. We keep the win, keep the warmth, and move clean.";
    case "focused": return "Locked in with you on " + activeTitle + ". Calm focus, no extra noise.";
    case "warm": return "Warm companion lane open — memory, family, and the next move.";
    default: return "Calm companion mode — present, warm, and ready.";
  }
}`;
buddy = replaceOneOf(buddy, presenceCandidates, presenceReplacement, "getHomiePresenceLine");

if (!buddy.includes("function detectHomieSpeechEmotion")) {
  const anchor = "function downloadTextFile(filename: string, text: string) {";
  const block = `
function detectHomieSpeechEmotion(text: string) {
  const lower = String(text || "").toLowerCase();
  if (/\\b(steady|smaller|slower|breathe|ground|carry|warn|pain|blocked|careful)\\b/.test(lower)) return "concerned";
  if (/\\b(win|landed|clean|good|beautiful|celebrate|nice|love that)\\b/.test(lower)) return "bright";
  if (/\\b(focus|next move|step|render|build|mission|lane)\\b/.test(lower)) return "focused";
  return "warm";
}

function applyHomiePremiumVoiceEmotionStyle(utter: SpeechSynthesisUtterance, sourceText = "") {
  try {
    const emotion = detectHomieSpeechEmotion(sourceText || utter.text || "");
    utter.rate = emotion === "bright" ? 0.95 : emotion === "concerned" ? 0.87 : emotion === "focused" ? 0.89 : 0.9;
    utter.pitch = emotion === "bright" ? 1.02 : emotion === "concerned" ? 0.94 : emotion === "focused" ? 0.96 : 0.98;
    utter.volume = 1;
    utter.text = String(utter.text || "")
      .replace(/\\s+/g, " ")
      .replace(/\\s*—\\s*/g, ". ")
      .replace(/\\s*\\|\\s*/g, ". ")
      .replace(/:\\s+/g, ", ")
      .replace(/,\\s+/g, ", ")
      .trim();
  } catch {
    // ignore
  }
}
`;
  buddy = insertBefore(buddy, anchor, block, "voice emotion helper");
}

if (!buddy.includes("applyHomiePremiumVoiceEmotionStyle(")) {
  buddy = buddy.replace(
    /const (\w+)\s*=\s*new SpeechSynthesisUtterance\(([^;]+)\);/g,
    (match, varName, expr) => `const ${varName} = new SpeechSynthesisUtterance(${expr});\n    applyHomiePremiumVoiceEmotionStyle(${varName}, ${expr});`
  );
} else {
  buddy = buddy.replace(
    /const (\w+)\s*=\s*new SpeechSynthesisUtterance\(([^;]+)\);(?!\n\s*applyHomiePremiumVoiceEmotionStyle)/g,
    (match, varName, expr) => `const ${varName} = new SpeechSynthesisUtterance(${expr});\n    applyHomiePremiumVoiceEmotionStyle(${varName}, ${expr});`
  );
}

fs.writeFileSync(buddyPath, buddy, "utf8");

// CSS polish
const cssStart = "/* ===== v10.36.85 Homie premium voice cadence + subtle gesture ===== */";
const cssEnd = "/* ===== v10.36.85 Homie premium voice cadence + subtle gesture END ===== */";
if (css.includes(cssStart) && css.includes(cssEnd)) {
  const s = css.indexOf(cssStart);
  const e = css.indexOf(cssEnd, s) + cssEnd.length;
  css = (css.slice(0, s) + css.slice(e)).trimEnd();
}
css += "\n\n" + [
  cssStart,
  ".homieCanvasFallbackClip{",
  "  width: min(100%, 372px);",
  "  aspect-ratio: 1 / 1.16;",
  "  border-radius: 34px;",
  "}",
  ".homieCanvasFallbackBadge{",
  "  top: 12px;",
  "  right: 12px;",
  "}",
  ".homieRebuildPresenceLine,",
  ".homieTolanIdlePresenceLine{",
  "  max-width: 39ch;",
  "}",
  cssEnd
].join("\n") + "\n";
fs.writeFileSync(cssPath, css, "utf8");

console.log("[" + VERSION + "] Applied premium voice cadence emotion and subtle gesture pass.");
console.log("Touched:");
console.log("- ui/src/components/HomieBuddy.tsx");
console.log("- ui/src/components/RiveHomie.tsx");
console.log("- ui/src/components/homieRebuild.css");