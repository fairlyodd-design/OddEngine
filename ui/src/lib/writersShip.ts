export type WritersShipProductKind = "guide" | "planner" | "template pack" | "prompt pack" | "tracker" | "workbook";

export type WritersShipPack = {
  generatedAt: number;
  productKind: WritersShipProductKind;
  title: string;
  subtitle: string;
  audience: string;
  promise: string;
  deliverables: string[];
  launchChecklist: string[];
  gumroadBlurb: string;
  kdpDescription: string;
  fileChecklist: string[];
  nextAction: string;
};

export type WritersShipSeed = {
  prompt: string;
  activeTitle?: string;
  activeSubtitle?: string;
  activeLogline?: string;
};

function clean(input: string) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

function titleCase(input: string) {
  return clean(input)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function inferKind(text: string): WritersShipProductKind {
  const value = text.toLowerCase();
  if (/(template|pack|bundle|kit)/.test(value)) return "template pack";
  if (/(prompt|ai|chatgpt|gpt)/.test(value)) return "prompt pack";
  if (/(planner|plan|routine)/.test(value)) return "planner";
  if (/(tracker|journal|log)/.test(value)) return "tracker";
  if (/(workbook|exercise)/.test(value)) return "workbook";
  return "guide";
}

function inferAudience(text: string) {
  const value = text.toLowerCase();
  if (/(crohn|flare|chronic|health|bad day)/.test(value)) return "People managing rough-energy or chronic-condition days who need practical help fast.";
  if (/(budget|grocery|meal|family)/.test(value)) return "Families or households trying to save money and stay organized without overwhelm.";
  if (/(trading|options|journal|market)/.test(value)) return "Small-account traders who want structure, clarity, and repeatable decision support.";
  if (/(writer|author|publish|kdp|book)/.test(value)) return "Creators who want a fast, low-friction way to turn ideas into a finished product.";
  return "People who want a simple practical system they can use right away from home.";
}

function inferTopic(seed: WritersShipSeed) {
  const joined = clean([seed.prompt, seed.activeTitle, seed.activeSubtitle, seed.activeLogline].filter(Boolean).join(" "));
  const lower = joined.toLowerCase();
  if (/(crohn|flare|bad day|recovery)/.test(lower)) return "bad-day recovery planning";
  if (/(budget|grocery|meal)/.test(lower)) return "budget-friendly family planning";
  if (/(trading|options|journal)/.test(lower)) return "practical options journaling";
  if (/(fairlyodd|os|productivity|system)/.test(lower)) return "FairlyOdd OS productivity";
  if (seed.activeTitle) return clean(seed.activeTitle);
  return clean(seed.prompt) || "practical home productivity";
}

function buildTitle(seed: WritersShipSeed, topic: string, kind: WritersShipProductKind) {
  if (seed.activeTitle && clean(seed.activeTitle).length >= 4) return titleCase(seed.activeTitle);
  const base = titleCase(topic);
  if (kind === "guide") return `${base} Quickstart`;
  if (kind === "planner") return `${base} Planner`;
  if (kind === "template pack") return `${base} Pack`;
  if (kind === "prompt pack") return `${base} Prompt Pack`;
  if (kind === "tracker") return `${base} Tracker`;
  return `${base} Workbook`;
}

function buildSubtitle(topic: string, kind: WritersShipProductKind) {
  const suffix = kind === "guide"
    ? "A short practical guide you can use right away"
    : kind === "planner"
    ? "A calm structure for planning, pacing, and follow-through"
    : kind === "template pack"
    ? "Ready-to-use files, pages, and prompts"
    : kind === "prompt pack"
    ? "A swipeable set of prompts and workflows"
    : kind === "tracker"
    ? "A simple repeatable logging system"
    : "A practical workbook you can finish in small sessions";
  return `${titleCase(topic)} — ${suffix}`;
}

function defaultDeliverables(kind: WritersShipProductKind, title: string) {
  const common = [
    `Core ${kind} PDF for ${title}`,
    "Quick-start page",
    "One-page summary / cheat sheet",
    "Cover image + thumbnail",
  ];
  if (kind === "template pack" || kind === "prompt pack") common.splice(1, 0, "Editable source files or plain-text prompt file");
  if (kind === "planner" || kind === "tracker" || kind === "workbook") common.splice(1, 0, "Printable worksheet pages");
  return common;
}

export function buildWritersShipPack(seed: WritersShipSeed): WritersShipPack {
  const prompt = clean(seed.prompt || seed.activeLogline || seed.activeTitle || "");
  const productKind = inferKind(prompt || seed.activeLogline || seed.activeTitle || "guide");
  const topic = inferTopic(seed);
  const title = buildTitle(seed, topic, productKind);
  const subtitle = clean(seed.activeSubtitle || "") || buildSubtitle(topic, productKind);
  const audience = inferAudience(prompt || topic);
  const promise = `Give the buyer a fast, concrete win around ${topic} without making them dig through fluff.`;
  const deliverables = defaultDeliverables(productKind, title);
  const launchChecklist = [
    "Polish the final product copy and remove filler text",
    "Export the main PDF or text deliverable",
    "Create a simple cover image / thumbnail",
    "Write the listing headline, bullets, and CTA",
    "Package the files into a clean upload-ready folder or ZIP",
  ];
  const fileChecklist = [
    `${title}.pdf or .md`,
    `${title}_cover.png`,
    `${title}_listing-copy.txt`,
    `${title}_readme.txt`,
  ];
  const gumroadBlurb = `${title} helps ${audience.toLowerCase()} It is built to be practical, fast to use, and easy to finish in one sitting. Inside you get ${deliverables.slice(0, 3).join(", ")}.`;
  const kdpDescription = `${title} is a short, useful ${productKind} focused on ${topic}. It is designed for readers who need clear steps, low-overwhelm structure, and something they can actually use today. Expect straightforward guidance, simple checklists, and a practical path forward.`;
  const nextAction = `Finish the smallest complete version of ${title} and export the files needed for a listing today.`;
  return {
    generatedAt: Date.now(),
    productKind,
    title,
    subtitle,
    audience,
    promise,
    deliverables,
    launchChecklist,
    gumroadBlurb,
    kdpDescription,
    fileChecklist,
    nextAction,
  };
}

export function stringifyWritersShipPack(pack: WritersShipPack) {
  return [
    `# ${pack.title}`,
    "",
    `## Subtitle`,
    pack.subtitle,
    "",
    `## Audience`,
    pack.audience,
    "",
    `## Promise`,
    pack.promise,
    "",
    `## Deliverables`,
    ...pack.deliverables.map((item) => `- ${item}`),
    "",
    `## Launch checklist`,
    ...pack.launchChecklist.map((item) => `- ${item}`),
    "",
    `## Gumroad blurb`,
    pack.gumroadBlurb,
    "",
    `## KDP description`,
    pack.kdpDescription,
    "",
    `## File checklist`,
    ...pack.fileChecklist.map((item) => `- ${item}`),
    "",
    `## Next action`,
    pack.nextAction,
    "",
  ].join("\n");
}
