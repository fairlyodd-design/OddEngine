import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const root = process.cwd();
const targets = [
  "ui/src/styles.css",
  "ui/src/App.tsx",
  "ui/src/panels/Home.tsx",
  "ui/src/panels/Trading.tsx",
  "ui/src/components/ActivityRail.tsx",
  "ui/src/panels/Homie.tsx"
].map((p) => path.join(root, p));

const cp1252Special = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f]
]);

function encodeCp1252Like(s) {
  const bytes = [];
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (code <= 0xff) bytes.push(code);
    else if (cp1252Special.has(code)) bytes.push(cp1252Special.get(code));
    else return null;
  }
  return Uint8Array.from(bytes);
}

const decoder = new TextDecoder("utf-8", { fatal: false });

function mojibakeScore(s) {
  let score = 0;
  const markers = [
    "\u00c3", "\u00c2", "\u00e2", "\u00f0\u0178", "\u00ef\u00bf\u00bd",
    "\u00e2\u20ac", "\u00f0\u0178\u2018", "\u00f0\u0178\u201d"
  ];
  for (const marker of markers) score += (s.split(marker).length - 1) * 3;
  score += (s.match(/[\u0080-\u009f]/g) || []).length * 2;
  return score;
}

function fixSegment(segment) {
  const bytes = encodeCp1252Like(segment);
  if (!bytes) return segment;
  const decoded = decoder.decode(bytes);
  if (!decoded || decoded.includes("\ufffd")) return segment;
  return mojibakeScore(decoded) < mojibakeScore(segment) ? decoded : segment;
}

function repairText(input) {
  let text = input;

  const direct = [
    ["\u00e2\u20ac\u201d", "\u2014"],
    ["\u00e2\u20ac\u201c", "\u2013"],
    ["\u00e2\u20ac\u00a2", "\u2022"],
    ["\u00e2\u20ac\u00a6", "\u2026"],
    ["\u00e2\u20ac\u02dc", "\u2018"],
    ["\u00e2\u20ac\u2122", "\u2019"],
    ["\u00e2\u20ac\u0153", "\u201c"],
    ["\u00e2\u20ac\u009d", "\u201d"],
    ["\u00e2\u201e\u00a2", "\u2122"],
    ["\u00c2\u00a0", " "],
    ["\u00c2\u00ae", "\u00ae"],
    ["\u00c2\u00a9", "\u00a9"],
    ["\u00f0\u0178\u2018\u0160", "\ud83d\udc4a"],
    ["\u00f0\u0178\u0090\u00a6\u00e2\u20ac\u008d\u00f0\u0178\u201d\u00a5", "\ud83d\udc26\u200d\ud83d\udd25"],
    ["\u00f0\u0178\u201d\u00a5", "\ud83d\udd25"],
    ["\u00f0\u0178\u0092\u00b0", "\ud83d\udcb0"],
    ["\u00f0\u0178\u008f\u00a7", "\ud83c\udfe7"]
  ];
  for (const [bad, good] of direct) text = text.split(bad).join(good);

  const segmentPattern = /[\u00c2\u00c3\u00e2\u00f0][\u0080-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u2018-\u201d\u2020-\u2026\u20ac\u2122\u02c6\u02dc]{1,18}/g;
  text = text.replace(segmentPattern, (segment) => fixSegment(segment));

  return text;
}

let changed = 0;
for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, "utf8");
  const after = repairText(before).replace(/^\uFEFF/, "");
  const beforeScore = mojibakeScore(before);
  const afterScore = mojibakeScore(after);
  if (after !== before && afterScore <= beforeScore) {
    fs.writeFileSync(file, after, "utf8");
    changed++;
    console.log(`repaired ${path.relative(root, file)} mojibakeScore ${beforeScore} -> ${afterScore}`);
  } else {
    console.log(`checked ${path.relative(root, file)} mojibakeScore ${beforeScore}`);
  }
}

console.log(`mojibake repair complete. files changed: ${changed}`);
