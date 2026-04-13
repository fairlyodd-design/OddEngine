export type WritingMode = "Story Mode" | "Script Mode" | "Narration Mode" | "Social Content Mode";
export type ProductType = "short story" | "book chapter" | "screenplay scene" | "YouTube script" | "narration script";
export type SectionName = "intro" | "body" | "climax" | "outro";
export type Tone = "calm" | "tense" | "emotional" | "resolved";
export type Pacing = "slow" | "medium" | "fast";

export type SectionContract = {
  id: string;
  name: SectionName;
  label: string;
  tone: Tone;
  intensity: number;
  pacing: Pacing;
  objective: string;
  beats: string[];
  content: string;
};

export type WriterProject = {
  id: string;
  prompt: string;
  title: string;
  mode: WritingMode;
  productType: ProductType;
  summary: string;
  hook: string;
  outline: string[];
  readyForYoutube: boolean;
  exportedAt?: number;
  sections: SectionContract[];
  mergedContent: string;
  createdAt: number;
  updatedAt: number;
};

export type WriterEngineSettings = {
  realGeneration: boolean;
  model: string;
  endpoint: string;
  temperature: number;
};

export const DEFAULT_WRITER_ENGINE_SETTINGS: WriterEngineSettings = {
  realGeneration: true,
  model: "llama3.1:8b",
  endpoint: "http://127.0.0.1:11434",
  temperature: 0.8,
};

const STOP = new Set([
  "a","an","the","and","or","for","with","from","into","onto","to","of","in","on","at","by","about","my","our","your","their","his","her","its","is","are","be","that","this","these","those","it","as","after","before","through"
]);

function pickKeywords(prompt: string, count = 4) {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !STOP.has(word) && word.length > 2);
  const unique: string[] = [];
  for (const word of words) {
    if (!unique.includes(word)) unique.push(word);
    if (unique.length >= count) break;
  }
  return unique.length ? unique : ["signal", "change", "choice"];
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function uidFileSafeLocal(value: string) {
  return String(value || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function modeLabel(mode: WritingMode) {
  switch (mode) {
    case "Story Mode": return "story";
    case "Script Mode": return "screen";
    case "Narration Mode": return "voice";
    case "Social Content Mode": return "social";
  }
}

function inferMode(productType: ProductType): WritingMode {
  if (productType === "screenplay scene") return "Script Mode";
  if (productType === "YouTube script" || productType === "narration script") return "Narration Mode";
  return "Story Mode";
}

function buildTitle(prompt: string, productType: ProductType) {
  const keys = pickKeywords(prompt, 3);
  if (productType === "YouTube script") return `The ${titleCase(keys.join(" "))} Breakdown`;
  if (productType === "screenplay scene") return `${titleCase(keys[0])}: A Turning Point Scene`;
  if (productType === "narration script") return `Narrating ${titleCase(keys.join(" "))}`;
  if (productType === "book chapter") return `Chapter: ${titleCase(keys.join(" "))}`;
  return `The ${titleCase(keys.join(" "))} Shift`;
}

function buildOutline(prompt: string, productType: ProductType) {
  const keys = pickKeywords(prompt, 4);
  const subject = keys[0];
  const pressure = keys[1] || "conflict";
  const reveal = keys[2] || "truth";
  const outcome = keys[3] || "choice";
  if (productType === "screenplay scene") {
    return [
      `Open with visual tension around ${subject}.`,
      `Push the characters into a sharper conflict around ${pressure}.`,
      `Reveal what ${reveal} really means in this moment.`,
      `Land the scene on a decisive ${outcome} beat.`
    ];
  }
  if (productType === "YouTube script") {
    return [
      `Hook the viewer with a bold promise about ${subject}.`,
      `Frame the core problem using ${pressure}.`,
      `Deliver the main value and reveal the ${reveal}.`,
      `Close with a memorable takeaway and ${outcome} CTA.`
    ];
  }
  return [
    `Set the world and emotional lane around ${subject}.`,
    `Complicate the path with ${pressure}.`,
    `Heighten the stakes through ${reveal}.`,
    `Resolve the moment with a meaningful ${outcome}.`
  ];
}

function buildSummary(prompt: string, mode: WritingMode, productType: ProductType) {
  const keys = pickKeywords(prompt, 3);
  return `${productType} built in ${mode.toLowerCase()} from the prompt focus on ${keys.join(", ")}.`;
}

function buildHook(prompt: string, productType: ProductType) {
  const keys = pickKeywords(prompt, 2);
  if (productType === "YouTube script") return `What if ${keys[0]} changes everything you thought you knew about ${keys[1] || "the situation"}?`;
  return `The moment ${keys[0]} touched ${keys[1] || "the room"}, nothing stayed simple.`;
}

function sectionBlueprints(productType: ProductType) {
  if (productType === "screenplay scene") {
    return [
      { name: "intro" as const, label: "Opening Image", tone: "calm" as const, intensity: 0.28, pacing: "slow" as const, objective: "Place the reader on set and establish who owns the moment." },
      { name: "body" as const, label: "Conflict Build", tone: "tense" as const, intensity: 0.62, pacing: "medium" as const, objective: "Escalate the disagreement, pressure, or desire." },
      { name: "climax" as const, label: "Turn", tone: "emotional" as const, intensity: 0.92, pacing: "fast" as const, objective: "Force a choice, reveal, or decisive action." },
      { name: "outro" as const, label: "Button", tone: "resolved" as const, intensity: 0.35, pacing: "medium" as const, objective: "Leave the scene with a clear aftertaste and next-motion pull." },
    ];
  }
  if (productType === "YouTube script" || productType === "narration script") {
    return [
      { name: "intro" as const, label: "Hook", tone: "calm" as const, intensity: 0.35, pacing: "fast" as const, objective: "Grab attention fast and frame the promise." },
      { name: "body" as const, label: "Main Build", tone: "tense" as const, intensity: 0.58, pacing: "medium" as const, objective: "Layer the context, examples, and useful specifics." },
      { name: "climax" as const, label: "Big Payoff", tone: "emotional" as const, intensity: 0.86, pacing: "fast" as const, objective: "Deliver the strongest insight or emotional high point." },
      { name: "outro" as const, label: "Close / CTA", tone: "resolved" as const, intensity: 0.32, pacing: "medium" as const, objective: "Wrap cleanly and point the audience to the next move." },
    ];
  }
  return [
    { name: "intro" as const, label: "Opening", tone: "calm" as const, intensity: 0.24, pacing: "slow" as const, objective: "Set the scene and emotional lane." },
    { name: "body" as const, label: "Development", tone: "tense" as const, intensity: 0.57, pacing: "medium" as const, objective: "Build friction, momentum, and consequence." },
    { name: "climax" as const, label: "Peak", tone: "emotional" as const, intensity: 0.94, pacing: "fast" as const, objective: "Hit the decisive emotional or plot turn." },
    { name: "outro" as const, label: "Resolution", tone: "resolved" as const, intensity: 0.3, pacing: "slow" as const, objective: "Let the scene breathe and land the final line." },
  ];
}

function buildBeats(prompt: string, blueprint: { name: SectionName; objective: string }, productType: ProductType) {
  const keys = pickKeywords(prompt, 4);
  const [a, b, c, d] = keys;
  if (productType === "screenplay scene") {
    return [
      `Use ${a} as the visual anchor.`,
      `Let ${b || "pressure"} sharpen the dialogue.`,
      `Tilt toward ${c || "truth"} before the section ends.`
    ];
  }
  if (productType === "YouTube script") {
    return [
      `Call out ${a} in a way the viewer instantly understands.`,
      `Tie ${b || "the main problem"} to a real consequence.`,
      `Point the audience toward ${c || "the payoff"}.`
    ];
  }
  return [
    `${blueprint.objective}`,
    `Bring ${a} into focus and complicate it with ${b || "conflict"}.`,
    `Aim the end of the section toward ${c || d || "change"}.`
  ];
}

function contentPrefix(mode: WritingMode, productType: ProductType, section: SectionContract, title: string) {
  if (mode === "Script Mode" || productType === "screenplay scene") {
    if (section.name === "intro") return `INT. WRITERS LOUNGE - ${title.toUpperCase()} - NIGHT\n\nA room full of low light, electric screens, and restless intent.`;
    if (section.name === "body") return `The pressure in the room rises as every word costs a little more.`;
    if (section.name === "climax") return `Then the moment breaks open.`;
    return `Silence returns, but it is not the same silence as before.`;
  }
  if (productType === "YouTube script") {
    if (section.name === "intro") return `Hey everybody, today we're diving into ${title}.`;
    if (section.name === "body") return `Let's build this out step by step so it actually clicks.`;
    if (section.name === "climax") return `Here's the part that changes how you see the whole thing.`;
    return `So here's the takeaway you actually want to keep.`;
  }
  if (productType === "narration script") {
    if (section.name === "intro") return `Picture the first instant before everything starts to move.`;
    if (section.name === "body") return `Now the story widens and the pressure becomes impossible to ignore.`;
    if (section.name === "climax") return `At the center of it all, one truth refuses to stay hidden.`;
    return `And when it ends, the meaning lingers longer than the sound.`;
  }
  return "";
}

function generateSectionContent(project: Pick<WriterProject, "title" | "prompt" | "productType" | "mode">, section: Omit<SectionContract, "content">) {
  const keys = pickKeywords(project.prompt, 4);
  const vibe = `${section.tone} tone, ${section.pacing} pacing, intensity ${section.intensity.toFixed(2)}`;
  const prefix = contentPrefix(project.mode, project.productType, { ...section, content: "" }, project.title);

  if (project.productType === "screenplay scene") {
    const lines = [
      prefix,
      "",
      `${keys[0]?.toUpperCase() || "LEAD"}: We knew this was coming, but not like this.`,
      `${keys[1]?.toUpperCase() || "PARTNER"}: You keep saying that like it makes the room smaller.`,
      "",
      `Action: ${section.objective}`,
      `Beat: ${section.beats.join(" ")}`,
      `${keys[2]?.toUpperCase() || "LEAD"}: Then say what you came here to say.`,
      `${keys[3]?.toUpperCase() || "PARTNER"}: Maybe that's the point.`
    ];
    return lines.join("\n");
  }

  const baseParagraphs = [
    prefix,
    `${project.title} leans into ${keys[0] || "change"} right away, but it does not rush the feeling. The section's job is simple: ${section.objective.toLowerCase()} The language should feel ${vibe}, with the reader always sensing that something meaningful is shifting under the surface.`,
    `The prompt keeps pointing back to ${keys[1] || "pressure"}, so this section uses it as a live wire. ${section.beats[0]} ${section.beats[1]} That gives the writing motion instead of filler, and it keeps the scene from flattening out.`,
    `By the end of the section, ${keys[2] || "the central idea"} matters more than it did at the start. ${section.beats[2]} That little rise in consequence is what makes the next section feel earned instead of merely attached.`
  ];

  if (project.productType === "YouTube script") {
    return baseParagraphs
      .map((p, index) => index === 0 ? p : p.replace(/The section's job is simple:/, "What we're doing here is:").replace(/The language should feel/, "The delivery should feel"))
      .join("\n\n");
  }

  if (project.productType === "narration script") {
    return baseParagraphs
      .map((p, index) => index === 0 ? p : p.replace(/reader/g, "listener"))
      .join("\n\n");
  }

  return baseParagraphs.join("\n\n");
}

function normalizeEndpoint(endpoint: string) {
  return endpoint.replace(/\/$/, "");
}

function stripCodeFences(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function safeParseJSON<T>(value: string): T | null {
  const clean = stripCodeFences(value);
  try {
    return JSON.parse(clean) as T;
  } catch {
    const first = clean.indexOf("{");
    const last = clean.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try { return JSON.parse(clean.slice(first, last + 1)) as T; } catch {}
    }
    return null;
  }
}

async function ollamaGenerate(prompt: string, settings: WriterEngineSettings) {
  const response = await fetch(`${normalizeEndpoint(settings.endpoint)}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.model,
      prompt,
      stream: false,
      options: { temperature: settings.temperature },
    }),
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const json = await response.json();
  return String(json?.response || "").trim();
}

export async function probeWriterEngine(settings: WriterEngineSettings) {
  try {
    const response = await fetch(`${normalizeEndpoint(settings.endpoint)}/api/tags`);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const json = await response.json();
    const models: string[] = Array.isArray(json?.models) ? json.models.map((item: any) => String(item?.name || item?.model || "")).filter(Boolean) : [];
    return { ok: true, models };
  } catch (error: any) {
    return { ok: false, models: [] as string[], error: error?.message || "Writer engine unavailable" };
  }
}

type PlannerShape = { title: string; summary: string; hook: string; outline: string[] };

async function planProject(prompt: string, productType: ProductType, mode: WritingMode, settings: WriterEngineSettings) {
  const fallback: PlannerShape = {
    title: buildTitle(prompt, productType),
    summary: buildSummary(prompt, mode, productType),
    hook: buildHook(prompt, productType),
    outline: buildOutline(prompt, productType),
  };
  if (!settings.realGeneration) return fallback;

  const plannerPrompt = [
    "You are a professional development editor.",
    `Create a tight production plan for a ${productType} in ${mode}.`,
    "Return JSON only with these keys: title, summary, hook, outline.",
    "outline must be an array of exactly 4 concise strings matching intro, body, climax, outro.",
    "Keep the title marketable and the hook strong.",
    `USER PROMPT: ${prompt}`,
  ].join("\n");

  try {
    const raw = await ollamaGenerate(plannerPrompt, settings);
    const parsed = safeParseJSON<Partial<PlannerShape>>(raw);
    return {
      title: String(parsed?.title || fallback.title),
      summary: String(parsed?.summary || fallback.summary),
      hook: String(parsed?.hook || fallback.hook),
      outline: Array.isArray(parsed?.outline) && parsed!.outline.length ? parsed!.outline.slice(0, 4).map(String) : fallback.outline,
    };
  } catch {
    return fallback;
  }
}

async function generateRealSectionContent(project: Pick<WriterProject, "title" | "prompt" | "productType" | "mode" | "summary" | "hook" | "outline">, section: Omit<SectionContract, "content">, previousSectionsText: string, settings: WriterEngineSettings) {
  const fallback = generateSectionContent(project, section);
  if (!settings.realGeneration) return fallback;

  const styleRules = project.productType === "screenplay scene"
    ? "Write in proper screenplay style with concise action lines and dialogue labels."
    : project.productType === "YouTube script"
      ? "Write for spoken delivery, clean momentum, and viewer retention."
      : project.productType === "narration script"
        ? "Write for voiceover delivery with vivid but readable phrasing."
        : "Write polished prose with strong narrative flow.";

  const sectionPrompt = [
    "You are a professional writer creating production-ready content.",
    `Product type: ${project.productType}`,
    `Writing mode: ${project.mode}`,
    `Title: ${project.title}`,
    `Summary: ${project.summary}`,
    `Hook: ${project.hook}`,
    `Global prompt: ${project.prompt}`,
    `Outline: ${project.outline.join(" | ")}`,
    `Section name: ${section.name}`,
    `Section label: ${section.label}`,
    `Tone: ${section.tone}`,
    `Intensity: ${section.intensity.toFixed(2)}`,
    `Pacing: ${section.pacing}`,
    `Objective: ${section.objective}`,
    `Beats: ${section.beats.join(" | ")}`,
    styleRules,
    "Keep continuity with any earlier sections.",
    previousSectionsText ? `Previous sections for continuity:\n${previousSectionsText}` : "No previous section text yet.",
    "Output only the finished content for this section. No labels, no explanations, no markdown fences.",
  ].join("\n\n");

  try {
    const raw = await ollamaGenerate(sectionPrompt, settings);
    return raw || fallback;
  } catch {
    return fallback;
  }
}

export function buildWriterProject(prompt: string, productType: ProductType, mode?: WritingMode): WriterProject {
  const effectiveMode = mode || inferMode(productType);
  const title = buildTitle(prompt, productType);
  const outline = buildOutline(prompt, productType);
  const summary = buildSummary(prompt, effectiveMode, productType);
  const hook = buildHook(prompt, productType);
  const sections = sectionBlueprints(productType).map((blueprint) => {
    const sectionNoContent = {
      id: uid(),
      name: blueprint.name,
      label: blueprint.label,
      tone: blueprint.tone,
      intensity: clamp01(blueprint.intensity),
      pacing: blueprint.pacing,
      objective: blueprint.objective,
      beats: buildBeats(prompt, blueprint, productType),
    };
    return {
      ...sectionNoContent,
      content: generateSectionContent({ title, prompt, productType, mode: effectiveMode }, sectionNoContent),
    };
  });

  const now = Date.now();
  const core = {
    id: uid(),
    prompt,
    title,
    mode: effectiveMode,
    productType,
    summary,
    hook,
    outline,
    readyForYoutube: productType === "YouTube script" || effectiveMode === "Social Content Mode",
    sections,
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...core,
    mergedContent: mergeProjectContent(core),
  };
}

export async function buildWriterProjectAsync(
  prompt: string,
  productType: ProductType,
  mode: WritingMode | undefined,
  settings: WriterEngineSettings,
  onSectionStatus?: (sectionId: string, status: string) => void,
): Promise<WriterProject> {
  const effectiveMode = mode || inferMode(productType);
  const plan = await planProject(prompt, productType, effectiveMode, settings);
  const blueprints = sectionBlueprints(productType);
  const sections: SectionContract[] = [];

  for (const blueprint of blueprints) {
    const sectionBase = {
      id: uid(),
      name: blueprint.name,
      label: blueprint.label,
      tone: blueprint.tone,
      intensity: clamp01(blueprint.intensity),
      pacing: blueprint.pacing,
      objective: blueprint.objective,
      beats: buildBeats(prompt, blueprint, productType),
    };
    onSectionStatus?.(sectionBase.id, "generating...");
    const previousSectionsText = sections.map((item) => `${item.label}\n${item.content}`).join("\n\n");
    const content = await generateRealSectionContent({
      title: plan.title,
      prompt,
      productType,
      mode: effectiveMode,
      summary: plan.summary,
      hook: plan.hook,
      outline: plan.outline,
    }, sectionBase, previousSectionsText, settings);
    sections.push({ ...sectionBase, content });
    onSectionStatus?.(sectionBase.id, "done");
  }

  const now = Date.now();
  const project = {
    id: uid(),
    prompt,
    title: plan.title,
    mode: effectiveMode,
    productType,
    summary: plan.summary,
    hook: plan.hook,
    outline: plan.outline,
    readyForYoutube: productType === "YouTube script" || effectiveMode === "Social Content Mode",
    sections,
    createdAt: now,
    updatedAt: now,
  };
  return { ...project, mergedContent: mergeProjectContent(project) };
}

export function regenerateProjectSection(project: WriterProject, sectionId: string): WriterProject {
  const sections = project.sections.map((section) => {
    if (section.id !== sectionId) return section;
    const next = {
      ...section,
      intensity: clamp01(section.intensity + (section.name === "climax" ? 0.03 : 0.02)),
    };
    return {
      ...next,
      content: generateSectionContent(project, next),
    };
  });
  return {
    ...project,
    sections,
    mergedContent: mergeProjectContent({ ...project, sections }),
    updatedAt: Date.now(),
  };
}

export async function regenerateProjectSectionAsync(
  project: WriterProject,
  sectionId: string,
  settings: WriterEngineSettings,
  onStatus?: (status: string) => void,
) {
  const target = project.sections.find((section) => section.id === sectionId);
  if (!target) return regenerateProjectSection(project, sectionId);
  const nextSection = {
    ...target,
    intensity: clamp01(target.intensity + (target.name === "climax" ? 0.03 : 0.02)),
  };
  const previousSectionsText = project.sections
    .filter((section) => section.id !== sectionId)
    .map((section) => `${section.label}\n${section.content}`)
    .join("\n\n");
  onStatus?.("generating...");
  const content = await generateRealSectionContent(project, nextSection, previousSectionsText, settings);
  onStatus?.("done");
  const sections = project.sections.map((section) => section.id === sectionId ? { ...nextSection, content } : section);
  return {
    ...project,
    sections,
    mergedContent: mergeProjectContent({ ...project, sections }),
    updatedAt: Date.now(),
  };
}

export function mergeProjectContent(project: Pick<WriterProject, "title" | "productType" | "mode" | "summary" | "hook" | "outline" | "sections" | "prompt" | "readyForYoutube">) {
  const lines: string[] = [];
  lines.push(`# ${project.title}`);
  lines.push("");
  lines.push(`Type: ${project.productType}`);
  lines.push(`Mode: ${project.mode}`);
  lines.push(`Prompt: ${project.prompt}`);
  lines.push("");
  lines.push(`Summary: ${project.summary}`);
  lines.push(`Hook: ${project.hook}`);
  lines.push("");
  lines.push("Outline:");
  project.outline.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  lines.push("");
  project.sections.forEach((section, index) => {
    lines.push(`## ${index + 1}. ${section.label}`);
    lines.push(`Section Contract: name=${section.name} | tone=${section.tone} | intensity=${section.intensity.toFixed(2)} | pacing=${section.pacing}`);
    lines.push(`Objective: ${section.objective}`);
    lines.push("");
    lines.push(section.content);
    lines.push("");
  });
  if (project.readyForYoutube) {
    lines.push("---");
    lines.push("YouTube Ready Notes:");
    lines.push("- Hook goes in the first 8 seconds.");
    lines.push("- Keep visuals changing at each section handoff.");
    lines.push("- Close with a direct CTA and on-screen summary card.");
  }
  return lines.join("\n").trim();
}

export function exportProjectText(project: WriterProject, format: "txt" | "md") {
  if (format === "txt") {
    return project.mergedContent
      .replace(/^# /gm, "")
      .replace(/^## /gm, "")
      .replace(/^---$/gm, "----------------------------------------");
  }
  return project.mergedContent;
}

export function recommendedModeForProduct(productType: ProductType) {
  return inferMode(productType);
}

export function sectionContractLabel(section: SectionContract) {
  return `${section.name} Â· ${section.tone} Â· ${section.pacing} Â· ${section.intensity.toFixed(2)}`;
}

export function buildModeOptions(productType: ProductType): WritingMode[] {
  const recommended = inferMode(productType);
  const all: WritingMode[] = ["Story Mode", "Script Mode", "Narration Mode", "Social Content Mode"];
  return [recommended, ...all.filter((mode) => mode !== recommended)];
}

export function buildYoutubeCard(project: WriterProject) {
  const cta = project.productType === "YouTube script" ? "Subscribe for the next breakdown." : "Follow for the next part.";
  return [
    `TITLE: ${project.title}`,
    `HOOK: ${project.hook}`,
    `THUMBNAIL IDEA: ${pickKeywords(project.prompt, 3).map(titleCase).join(" vs ")}`,
    `CTA: ${cta}`,
    `FORMAT TAG: ${modeLabel(project.mode)}`,
  ].join("\n");
}


export type AnimationFormat = "cartoon short" | "series episode" | "explainer animation";

export type AnimationCharacter = {
  id: string;
  name: string;
  role: string;
  look: string;
  voice: string;
};

export type AnimationScene = {
  id: string;
  title: string;
  durationSec: number;
  visualPrompt: string;
  motionPrompt: string;
  dialogue: string;
  narration: string;
  sfx: string[];
};

export type AnimationProject = {
  id: string;
  prompt: string;
  format: AnimationFormat;
  title: string;
  logline: string;
  styleGuide: string;
  characters: AnimationCharacter[];
  scenes: AnimationScene[];
  mergedContent: string;
  createdAt: number;
  updatedAt: number;
};

export type AnimationRenderStatus = "queued" | "rendering" | "voice-ready" | "shot-manifested" | "assembly-ready" | "assembled";

export type AnimationVoiceAsset = {
  sceneId: string;
  voiceAssetFile: string;
  transcript: string;
  durationSec: number;
  voiceModel: string;
};

export type AnimationShotManifest = {
  sceneId: string;
  shots: string[];
  cameraPlan: string;
  continuityNotes: string[];
};

export type AnimationExecutionScript = {
  filename: string;
  content: string;
};

export type AnimationBackendProbeResult = {
  ok: boolean;
  baseUrl: string;
  status?: string;
  service?: string;
  error?: string;
};

export type AnimationBackendRunResult = {
  ok: boolean;
  baseUrl: string;
  jobId?: string;
  detail?: string;
  error?: string;
  probe: AnimationBackendProbeResult;
};


export type PublishingConnectorProbeResult = {
  ok: boolean;
  baseUrl: string;
  status?: string;
  service?: string;
  error?: string;
};

export type PublishingConnectorRunResult = {
  ok: boolean;
  baseUrl: string;
  connector: "youtube" | "gumroad";
  runId?: string;
  detail?: string;
  error?: string;
  probe: PublishingConnectorProbeResult;
  payload?: unknown;
};

export type PublishingConnectorReceiptRecord = {
  path: string;
  label?: string;
  kind?: string;
  url?: string;
};

export type PublishingConnectorPollResult = {
  ok: boolean;
  baseUrl: string;
  connector: "youtube" | "gumroad";
  runId: string;
  status?: string;
  detail?: string;
  error?: string;
  probe: PublishingConnectorProbeResult;
  payload?: unknown;
  receipt?: PublishingConnectorReceiptRecord | null;
  payloadPath?: string;
};

export type AnimationExecutionPlan = {
  voiceEngine: string;
  renderer: string;
  ffmpegPath: string;
  workDir: string;
  manifestFile: string;
  windowsScript: AnimationExecutionScript;
  bashScript: AnimationExecutionScript;
  voiceCommands: string[];
  renderCommands: string[];
  ffmpegCommands: string[];
  executionNotes: string[];
  generatedAt: number;
};

export type AnimationRenderSceneJob = {
  sceneId: string;
  sceneTitle: string;
  durationSec: number;
  visualPrompt: string;
  motionPrompt: string;
  voiceText: string;
  sfx: string[];
  renderStatus: AnimationRenderStatus;
  outputFile: string;
  shotNotes: string;
  voiceAsset: AnimationVoiceAsset;
  shotManifest: AnimationShotManifest;
};

export type AnimationRenderJob = {
  id: string;
  projectId: string;
  projectTitle: string;
  format: AnimationFormat;
  status: AnimationRenderStatus;
  createdAt: number;
  updatedAt: number;
  outputDir: string;
  voiceModel: string;
  renderProfile: string;
  scenes: AnimationRenderSceneJob[];
  finalEpisodeFile: string;
  executionPlan: AnimationExecutionPlan;
  backendStatus?: {
    baseUrl?: string;
    status?: string;
    lastRunAt?: number;
    lastError?: string;
  };
};

export type AnimationEpisodePackage = {
  id: string;
  projectId: string;
  renderJobId: string;
  title: string;
  format: AnimationFormat;
  runtimeSec: number;
  summary: string;
  finalEpisodeFile: string;
  sceneFiles: string[];
  voiceManifest: string[];
  shotManifest: string[];
  assemblyNotes: string[];
  assemblyRecipe: string[];
  executionNotes: string[];
  executionScripts: string[];
  mergedContent: string;
  createdAt: number;
};

function safeParseJSONArray<T>(value: string): T[] | null {
  const clean = stripCodeFences(value);
  try {
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed as T[] : null;
  } catch {
    const first = clean.indexOf("[");
    const last = clean.lastIndexOf("]");
    if (first >= 0 && last > first) {
      try {
        const parsed = JSON.parse(clean.slice(first, last + 1));
        return Array.isArray(parsed) ? parsed as T[] : null;
      } catch {}
    }
    return null;
  }
}

async function ollamaGenerateStream(prompt: string, settings: WriterEngineSettings, onChunk?: (chunk: string, fullText: string) => void) {
  const response = await fetch(`${normalizeEndpoint(settings.endpoint)}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.model,
      prompt,
      stream: true,
      options: { temperature: settings.temperature },
    }),
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  if (!response.body) {
    const fallback = await response.text();
    const text = fallback.trim();
    if (text) onChunk?.(text, text);
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const clean = line.trim();
      if (!clean) continue;
      try {
        const json = JSON.parse(clean);
        const chunk = String(json?.response || "");
        if (chunk) {
          fullText += chunk;
          onChunk?.(chunk, fullText);
        }
      } catch {}
    }
  }

  const cleanBuffer = buffer.trim();
  if (cleanBuffer) {
    try {
      const json = JSON.parse(cleanBuffer);
      const chunk = String(json?.response || "");
      if (chunk) {
        fullText += chunk;
        onChunk?.(chunk, fullText);
      }
    } catch {}
  }
  return fullText.trim();
}

export async function buildWriterProjectStreaming(
  prompt: string,
  productType: ProductType,
  mode: WritingMode | undefined,
  settings: WriterEngineSettings,
  callbacks?: {
    onProjectCreated?: (project: WriterProject) => void;
    onSectionStatus?: (sectionId: string, status: string) => void;
    onSectionChunk?: (sectionId: string, content: string) => void;
  },
): Promise<WriterProject> {
  const effectiveMode = mode || inferMode(productType);
  const plan = await planProject(prompt, productType, effectiveMode, settings);
  const sections: SectionContract[] = sectionBlueprints(productType).map((blueprint) => ({
    id: uid(),
    name: blueprint.name,
    label: blueprint.label,
    tone: blueprint.tone,
    intensity: clamp01(blueprint.intensity),
    pacing: blueprint.pacing,
    objective: blueprint.objective,
    beats: buildBeats(prompt, blueprint, productType),
    content: "",
  }));

  const now = Date.now();
  let project: WriterProject = {
    id: uid(),
    prompt,
    title: plan.title,
    mode: effectiveMode,
    productType,
    summary: plan.summary,
    hook: plan.hook,
    outline: plan.outline,
    readyForYoutube: productType === "YouTube script" || effectiveMode === "Social Content Mode",
    sections,
    mergedContent: "",
    createdAt: now,
    updatedAt: now,
  };
  project = { ...project, mergedContent: mergeProjectContent(project) };
  callbacks?.onProjectCreated?.(project);

  for (let index = 0; index < sections.length; index += 1) {
    const section = project.sections[index];
    callbacks?.onSectionStatus?.(section.id, "streaming...");
    const previousSectionsText = project.sections.slice(0, index).map((item) => `${item.label}\n${item.content}`).join("\n\n");
    const fallback = generateSectionContent(project, section);
    if (!settings.realGeneration) {
      project = {
        ...project,
        sections: project.sections.map((item) => item.id === section.id ? { ...item, content: fallback } : item),
        updatedAt: Date.now(),
      };
      project = { ...project, mergedContent: mergeProjectContent(project) };
      callbacks?.onSectionChunk?.(section.id, fallback);
      callbacks?.onProjectCreated?.(project);
      callbacks?.onSectionStatus?.(section.id, "done");
      continue;
    }

    const styleRules = project.productType === "screenplay scene"
      ? "Write in proper screenplay style with concise action lines and dialogue labels."
      : project.productType === "YouTube script"
        ? "Write for spoken delivery, clean momentum, and viewer retention."
        : project.productType === "narration script"
          ? "Write for voiceover delivery with vivid but readable phrasing."
          : "Write polished prose with strong narrative flow.";

    const sectionPrompt = [
      "You are a professional writer creating production-ready content.",
      `Product type: ${project.productType}`,
      `Writing mode: ${project.mode}`,
      `Title: ${project.title}`,
      `Summary: ${project.summary}`,
      `Hook: ${project.hook}`,
      `Global prompt: ${project.prompt}`,
      `Outline: ${project.outline.join(" | ")}`,
      `Section name: ${section.name}`,
      `Section label: ${section.label}`,
      `Tone: ${section.tone}`,
      `Intensity: ${section.intensity.toFixed(2)}`,
      `Pacing: ${section.pacing}`,
      `Objective: ${section.objective}`,
      `Beats: ${section.beats.join(" | ")}`,
      styleRules,
      "Keep continuity with any earlier sections.",
      previousSectionsText ? `Previous sections for continuity:\n${previousSectionsText}` : "No previous section text yet.",
      "Output only the finished content for this section. No labels, no explanations, no markdown fences.",
    ].join("\n\n");

    try {
      let streamed = "";
      const content = await ollamaGenerateStream(sectionPrompt, settings, (_chunk, fullText) => {
        streamed = fullText;
        project = {
          ...project,
          sections: project.sections.map((item) => item.id === section.id ? { ...item, content: streamed } : item),
          updatedAt: Date.now(),
        };
        project = { ...project, mergedContent: mergeProjectContent(project) };
        callbacks?.onSectionChunk?.(section.id, streamed);
        callbacks?.onProjectCreated?.(project);
      });
      if (!content.trim()) throw new Error("Empty stream");
    } catch {
      project = {
        ...project,
        sections: project.sections.map((item) => item.id === section.id ? { ...item, content: fallback } : item),
        updatedAt: Date.now(),
      };
      project = { ...project, mergedContent: mergeProjectContent(project) };
      callbacks?.onSectionChunk?.(section.id, fallback);
      callbacks?.onProjectCreated?.(project);
    }
    callbacks?.onSectionStatus?.(section.id, "done");
  }

  return { ...project, mergedContent: mergeProjectContent(project), updatedAt: Date.now() };
}

export async function regenerateProjectSectionStreaming(
  project: WriterProject,
  sectionId: string,
  settings: WriterEngineSettings,
  callbacks?: {
    onStatus?: (status: string) => void;
    onChunk?: (content: string, nextProject: WriterProject) => void;
  },
): Promise<WriterProject> {
  const target = project.sections.find((section) => section.id === sectionId);
  if (!target) return project;
  const previousSectionsText = project.sections
    .slice(0, project.sections.findIndex((section) => section.id === sectionId))
    .map((section) => `${section.label}\n${section.content}`)
    .join("\n\n");
  const nextSection = { ...target, intensity: clamp01(target.intensity + (target.name === "climax" ? 0.03 : 0.02)), content: "" };
  const fallback = generateSectionContent(project, nextSection);
  if (!settings.realGeneration) {
    const sections = project.sections.map((section) => section.id === sectionId ? { ...nextSection, content: fallback } : section);
    return { ...project, sections, mergedContent: mergeProjectContent({ ...project, sections }), updatedAt: Date.now() };
  }

  const styleRules = project.productType === "screenplay scene"
    ? "Write in proper screenplay style with concise action lines and dialogue labels."
    : project.productType === "YouTube script"
      ? "Write for spoken delivery, clean momentum, and viewer retention."
      : project.productType === "narration script"
        ? "Write for voiceover delivery with vivid but readable phrasing."
        : "Write polished prose with strong narrative flow.";

  const sectionPrompt = [
    "You are a professional writer creating production-ready content.",
    `Product type: ${project.productType}`,
    `Writing mode: ${project.mode}`,
    `Title: ${project.title}`,
    `Summary: ${project.summary}`,
    `Hook: ${project.hook}`,
    `Global prompt: ${project.prompt}`,
    `Outline: ${project.outline.join(" | ")}`,
    `Section name: ${nextSection.name}`,
    `Section label: ${nextSection.label}`,
    `Tone: ${nextSection.tone}`,
    `Intensity: ${nextSection.intensity.toFixed(2)}`,
    `Pacing: ${nextSection.pacing}`,
    `Objective: ${nextSection.objective}`,
    `Beats: ${nextSection.beats.join(" | ")}`,
    styleRules,
    previousSectionsText ? `Previous sections for continuity:\n${previousSectionsText}` : "No previous section text yet.",
    "Output only the finished content for this section. No labels, no explanations, no markdown fences.",
  ].join("\n\n");

  callbacks?.onStatus?.("streaming...");
  let nextProject = project;
  try {
    const content = await ollamaGenerateStream(sectionPrompt, settings, (_chunk, fullText) => {
      const sections = nextProject.sections.map((section) => section.id === sectionId ? { ...nextSection, content: fullText } : section);
      nextProject = { ...nextProject, sections, mergedContent: mergeProjectContent({ ...nextProject, sections }), updatedAt: Date.now() };
      callbacks?.onChunk?.(fullText, nextProject);
    });
    if (!content.trim()) throw new Error("Empty stream");
  } catch {
    const sections = project.sections.map((section) => section.id === sectionId ? { ...nextSection, content: fallback } : section);
    nextProject = { ...project, sections, mergedContent: mergeProjectContent({ ...project, sections }), updatedAt: Date.now() };
    callbacks?.onChunk?.(fallback, nextProject);
  }
  callbacks?.onStatus?.("done");
  return nextProject;
}

function buildAnimationTitle(prompt: string, format: AnimationFormat) {
  const keys = pickKeywords(prompt, 3).map(titleCase);
  if (format === "series episode") return `${keys[0]} ${keys[1] || "Show"} - Episode One`;
  if (format === "explainer animation") return `${keys.join(" ")} Animated Explainer`;
  return `${keys.join(" ")} Cartoon Short`;
}

function buildAnimationFallback(prompt: string, format: AnimationFormat): AnimationProject {
  const keys = pickKeywords(prompt, 4);
  const now = Date.now();
  const characters: AnimationCharacter[] = [
    { id: uid(), name: titleCase(keys[0] || "Nova"), role: "lead", look: `Stylized animated hero built around ${keys[0] || "spark"}`, voice: "warm, expressive, clear" },
    { id: uid(), name: titleCase(keys[1] || "Echo"), role: "support", look: `Support character with design accents from ${keys[1] || "contrast"}`, voice: "quick, reactive, playful" },
  ];
  const scenes: AnimationScene[] = [
    { id: uid(), title: "Cold Open", durationSec: 12, visualPrompt: `Animated opening frame introducing ${keys[0]} in a bold stylized environment`, motionPrompt: "Slow push in, light secondary motion, expressive anticipation pose", dialogue: `${characters[0].name}: This is where everything starts to bend.`, narration: `In a world shaped by ${keys[0]}, one small shift changes the whole lane.`, sfx: ["ambient hum", "soft rise"] },
    { id: uid(), title: "Escalation", durationSec: 24, visualPrompt: `Characters react to ${keys[1] || "pressure"} as the environment becomes more active`, motionPrompt: "Faster cuts, character acting beats, directional camera move", dialogue: `${characters[1].name}: You feel that? The whole scene just changed.`, narration: `The pressure builds, and every beat gets tighter.`, sfx: ["whoosh", "impact tap"] },
    { id: uid(), title: "Payoff", durationSec: 18, visualPrompt: `High-energy payoff around ${keys[2] || "reveal"} with strong contrast and cinematic framing`, motionPrompt: "Hero motion burst, big reaction pose, hold on final frame", dialogue: `${characters[0].name}: Then let's make the ending count.`, narration: `At the center of the moment, the truth finally lands.`, sfx: ["hit", "resolve swell"] },
  ];
  const project: AnimationProject = {
    id: uid(),
    prompt,
    format,
    title: buildAnimationTitle(prompt, format),
    logline: `Animated ${format} about ${keys.slice(0, 3).join(", ")} built from one prompt.`,
    styleGuide: "2.5D cartoon look, clean silhouettes, expressive acting, cinematic lighting, family-safe polish.",
    characters,
    scenes,
    mergedContent: "",
    createdAt: now,
    updatedAt: now,
  };
  return { ...project, mergedContent: mergeAnimationProjectContent(project) };
}

function animationPlannerPrompt(prompt: string, format: AnimationFormat) {
  return [
    "You are an animation development director.",
    `Create a production-ready concept for a ${format}.`,
    "Return JSON only with keys: title, logline, styleGuide, characters, scenes.",
    "characters must be an array of 2 to 4 items with name, role, look, voice.",
    "scenes must be an array of 3 to 6 items with title, durationSec, visualPrompt, motionPrompt, dialogue, narration, sfx.",
    "Make it feel like a finished animated short/show pack from one prompt.",
    `USER PROMPT: ${prompt}`,
  ].join("\n");
}

export async function buildAnimationProjectAsync(prompt: string, format: AnimationFormat, settings: WriterEngineSettings): Promise<AnimationProject> {
  const fallback = buildAnimationFallback(prompt, format);
  if (!settings.realGeneration) return fallback;

  const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`Animation planner timeout after ${ms}ms`)), ms);
      }),
    ]);
  };

  try {
    const raw = await withTimeout(
      ollamaGenerate(animationPlannerPrompt(prompt, format), settings),
      12000,
    );
    const parsed = safeParseJSON<any>(raw);
    if (!parsed) return fallback;
    const now = Date.now();
    const characters: AnimationCharacter[] = Array.isArray(parsed.characters) && parsed.characters.length
      ? parsed.characters.slice(0, 4).map((item: any) => ({
          id: uid(),
          name: String(item?.name || "Character"),
          role: String(item?.role || "role"),
          look: String(item?.look || "Stylized animated look"),
          voice: String(item?.voice || "clear expressive voice"),
        }))
      : fallback.characters;
    const scenes: AnimationScene[] = Array.isArray(parsed.scenes) && parsed.scenes.length
      ? parsed.scenes.slice(0, 6).map((item: any) => ({
          id: uid(),
          title: String(item?.title || "Scene"),
          durationSec: Math.max(5, Math.min(90, Number(item?.durationSec) || 15)),
          visualPrompt: String(item?.visualPrompt || "Animated cinematic frame"),
          motionPrompt: String(item?.motionPrompt || "Character acting and camera motion"),
          dialogue: String(item?.dialogue || ""),
          narration: String(item?.narration || ""),
          sfx: Array.isArray(item?.sfx) ? item.sfx.map(String).slice(0, 6) : [],
        }))
      : fallback.scenes;
    const project: AnimationProject = {
      id: uid(),
      prompt,
      format,
      title: String(parsed.title || fallback.title),
      logline: String(parsed.logline || fallback.logline),
      styleGuide: String(parsed.styleGuide || fallback.styleGuide),
      characters,
      scenes,
      mergedContent: "",
      createdAt: now,
      updatedAt: now,
    };
    return { ...project, mergedContent: mergeAnimationProjectContent(project) };
  } catch (error) {
    console.warn("[WritersLounge] Animation planner fell back:", error);
    return fallback;
  }
}

export function mergeAnimationProjectContent(project: AnimationProject) {
  const lines: string[] = [];
  lines.push(`# ${project.title}`);
  lines.push("");
  lines.push(`Format: ${project.format}`);
  lines.push(`Prompt: ${project.prompt}`);
  lines.push(`Logline: ${project.logline}`);
  lines.push(`Style Guide: ${project.styleGuide}`);
  lines.push("");
  lines.push("Characters:");
  project.characters.forEach((character, index) => {
    lines.push(`${index + 1}. ${character.name} â€” ${character.role}`);
    lines.push(`   Look: ${character.look}`);
    lines.push(`   Voice: ${character.voice}`);
  });
  lines.push("");
  lines.push("Scenes:");
  project.scenes.forEach((scene, index) => {
    lines.push(`## ${index + 1}. ${scene.title} (${scene.durationSec}s)`);
    lines.push(`Visual Prompt: ${scene.visualPrompt}`);
    lines.push(`Motion Prompt: ${scene.motionPrompt}`);
    if (scene.dialogue) lines.push(`Dialogue: ${scene.dialogue}`);
    if (scene.narration) lines.push(`Narration: ${scene.narration}`);
    if (scene.sfx.length) lines.push(`SFX: ${scene.sfx.join(", ")}`);
    lines.push("");
  });
  lines.push("Render Handoff:");
  lines.push("- Use each scene visual prompt as a shot block.");
  lines.push("- Use motion prompt for animation direction.");
  lines.push("- Use dialogue and narration for voice generation or lip-sync lanes.");
  lines.push("- Assemble scenes in Render Lab / external animation pipeline.");
  return lines.join("\n").trim();
}

export function exportAnimationProjectText(project: AnimationProject, format: "txt" | "md" | "json") {
  if (format === "json") {
    return JSON.stringify(project, null, 2);
  }
  if (format === "txt") {
    return project.mergedContent.replace(/^# /gm, "").replace(/^## /gm, "");
  }
  return project.mergedContent;
}

function normalizeAnimationRenderSceneJob(scene: Partial<AnimationRenderSceneJob> | undefined, index: number, job: Pick<AnimationRenderJob, "outputDir" | "voiceModel">): AnimationRenderSceneJob {
  const sceneTitle = String(scene?.sceneTitle || `Scene ${index + 1}`);
  const safeTitle = uidFileSafeLocal(sceneTitle);
  const scenePrefix = `${job.outputDir}/scene_${String(index + 1).padStart(2, "0")}_${safeTitle}`;
  const voiceText = String(scene?.voiceText || scene?.voiceAsset?.transcript || "").trim();
  return {
    sceneId: String(scene?.sceneId || `scene-${index + 1}`),
    sceneTitle,
    durationSec: Math.max(2, Number(scene?.durationSec) || 6),
    visualPrompt: String(scene?.visualPrompt || `Cinematic key art for ${sceneTitle}`),
    motionPrompt: String(scene?.motionPrompt || "Slow cinematic camera move with gentle parallax."),
    voiceText,
    sfx: Array.isArray(scene?.sfx) ? scene.sfx.filter(Boolean).map(String) : [],
    renderStatus: (scene?.renderStatus || "queued") as AnimationRenderStatus,
    outputFile: String(scene?.outputFile || `${scenePrefix}.mp4`),
    shotNotes: String(scene?.shotNotes || `Animate ${sceneTitle} with clear continuity and readable composition.`),
    voiceAsset: {
      sceneId: String(scene?.voiceAsset?.sceneId || scene?.sceneId || `scene-${index + 1}`),
      voiceAssetFile: String(scene?.voiceAsset?.voiceAssetFile || `${scenePrefix}_voice.wav`),
      transcript: String(scene?.voiceAsset?.transcript || voiceText || "instrumental / fx only"),
      durationSec: Math.max(2, Number(scene?.voiceAsset?.durationSec) || Number(scene?.durationSec) || 6),
      voiceModel: String(scene?.voiceAsset?.voiceModel || job.voiceModel || "homie-voice-v1"),
    },
    shotManifest: {
      sceneId: String(scene?.shotManifest?.sceneId || scene?.sceneId || `scene-${index + 1}`),
      shots: Array.isArray(scene?.shotManifest?.shots) && scene.shotManifest.shots.length
        ? scene.shotManifest.shots.map(String)
        : [
            `Shot A: Establish ${sceneTitle} with ${String(scene?.visualPrompt || "cinematic composition")}.`,
            `Shot B: Push into the emotional beat with ${String(scene?.motionPrompt || "camera motion")}.`,
          ],
      cameraPlan: String(scene?.shotManifest?.cameraPlan || scene?.motionPrompt || "Slow cinematic push-in."),
      continuityNotes: Array.isArray(scene?.shotManifest?.continuityNotes)
        ? scene.shotManifest.continuityNotes.filter(Boolean).map(String)
        : ["Maintain subject continuity, lighting consistency, and readable framing."],
    },
  };
}

export function normalizeAnimationRenderJob(rawJob: Partial<AnimationRenderJob> | undefined): AnimationRenderJob {
  const fallbackTitle = String(rawJob?.projectTitle || "Untitled Episode");
  const safeTitle = uidFileSafeLocal(fallbackTitle || "untitled-episode");
  const outputDir = String(rawJob?.outputDir || `render_lab/animation_jobs/${safeTitle}`);
  const baseJob = {
    id: String(rawJob?.id || uid()),
    projectId: String(rawJob?.projectId || ""),
    projectTitle: fallbackTitle,
    format: (rawJob?.format || "cartoon short") as AnimationFormat,
    status: (rawJob?.status || "queued") as AnimationRenderStatus,
    createdAt: Number(rawJob?.createdAt) || Date.now(),
    updatedAt: Number(rawJob?.updatedAt) || Date.now(),
    outputDir,
    voiceModel: String(rawJob?.voiceModel || "homie-voice-v1"),
    renderProfile: String(rawJob?.renderProfile || "storybook-cinematic"),
    finalEpisodeFile: String(rawJob?.finalEpisodeFile || `${outputDir}/final_episode.mp4`),
    backendStatus: rawJob?.backendStatus,
  };
  const scenes = Array.isArray(rawJob?.scenes)
    ? rawJob.scenes.map((scene, index) => normalizeAnimationRenderSceneJob(scene, index, { outputDir: baseJob.outputDir, voiceModel: baseJob.voiceModel }))
    : [];
  const nextJob: AnimationRenderJob = {
    ...baseJob,
    scenes,
    executionPlan: {} as AnimationExecutionPlan,
  };
  nextJob.executionPlan = buildAnimationExecutionPlan(nextJob);
  return nextJob;
}


function buildAnimationExecutionPlan(job: AnimationRenderJob): AnimationExecutionPlan {
  const ffmpegPath = "ffmpeg";
  const voiceEngine = "python local_tts.py";
  const renderer = "python local_scene_renderer.py";
  const concatFile = `${job.outputDir}/episode_concat.txt`;
  const manifestFile = `${job.outputDir}/execution_manifest.json`;

  const voiceCommands = job.scenes.map((scene, index) => {
    const transcript = (scene.voiceAsset.transcript || "").replace(/"/g, '\"');
    return `${voiceEngine} --model "${job.voiceModel}" --text "${transcript}" --out "${scene.voiceAsset.voiceAssetFile}" --scene "${String(index + 1).padStart(2, "0")}"`;
  });

  const renderCommands = job.scenes.map((scene, index) => {
    const safeVisual = scene.visualPrompt.replace(/"/g, '\"');
    const safeMotion = scene.motionPrompt.replace(/"/g, '\"');
    return `${renderer} --profile "${job.renderProfile}" --scene "${String(index + 1).padStart(2, "0")}" --visual "${safeVisual}" --motion "${safeMotion}" --voice "${scene.voiceAsset.voiceAssetFile}" --out "${scene.outputFile}"`;
  });

  const ffmpegCommands = [
    `python build_concat_manifest.py --job "${job.id}" --out "${concatFile}"`,
    `${ffmpegPath} -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k "${job.finalEpisodeFile}"`,
  ];

  const windowsLines = [
    "@echo off",
    "setlocal",
    `mkdir "${job.outputDir}" 2>nul`,
    ...voiceCommands,
    ...renderCommands,
    ...ffmpegCommands,
    "echo Episode build complete.",
    "endlocal",
  ];

  const bashLines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    `mkdir -p "${job.outputDir}"`,
    ...voiceCommands,
    ...renderCommands,
    ...ffmpegCommands,
    "echo 'Episode build complete.'",
  ];

  return {
    voiceEngine,
    renderer,
    ffmpegPath,
    workDir: job.outputDir,
    manifestFile,
    windowsScript: {
      filename: `${uidFileSafeLocal(job.projectTitle)}_episode_build.bat`,
      content: windowsLines.join("\n"),
    },
    bashScript: {
      filename: `${uidFileSafeLocal(job.projectTitle)}_episode_build.sh`,
      content: bashLines.join("\n"),
    },
    voiceCommands,
    renderCommands,
    ffmpegCommands,
    executionNotes: [
      "Run voice generation first so every scene gets a concrete WAV asset.",
      "Run the renderer second so each scene produces its own MP4 file in the job output directory.",
      "Run the ffmpeg concat build last to assemble the final episode from the rendered scene clips.",
    ],
    generatedAt: Date.now(),
  };
}



function normalizeBackendBaseUrl(baseUrl?: string) {
  const clean = String(baseUrl || "http://127.0.0.1:8899").trim().replace(/\/$/, "");
  return clean || "http://127.0.0.1:8899";
}



function normalizePublishingReceiptRecord(raw: any): PublishingConnectorReceiptRecord | null {
  const path = String(raw?.path || raw?.file || raw?.filepath || raw?.output || raw?.name || "").trim();
  if (!path) return null;
  return {
    path,
    label: raw?.label ? String(raw.label) : undefined,
    kind: raw?.kind ? String(raw.kind) : undefined,
    url: raw?.url ? String(raw.url) : undefined,
  };
}

function normalizePublishingConnectorBaseUrl(baseUrl?: string) {
  const clean = String(baseUrl || "http://127.0.0.1:8900").trim().replace(/\/$/, "");
  return clean || "http://127.0.0.1:8900";
}

export async function probePublishingConnectorBackend(baseUrl?: string): Promise<PublishingConnectorProbeResult> {
  const normalized = normalizePublishingConnectorBaseUrl(baseUrl);
  try {
    const response = await fetch(`${normalized}/health`);
    if (!response.ok) {
      return { ok: false, baseUrl: normalized, error: `Health probe failed (${response.status})` };
    }
    const data = await response.json().catch(() => ({} as any));
    return {
      ok: true,
      baseUrl: normalized,
      status: String((data as any)?.status || "ready"),
      service: String((data as any)?.service || "publishing-connector-runner"),
    };
  } catch (error) {
    return { ok: false, baseUrl: normalized, error: error instanceof Error ? error.message : "Connector runner unavailable" };
  }
}

export async function runPublishingConnectorLocal(
  connector: "youtube" | "gumroad",
  payload: unknown,
  options?: { baseUrl?: string },
): Promise<PublishingConnectorRunResult> {
  const probe = await probePublishingConnectorBackend(options?.baseUrl);
  if (!probe.ok) {
    return { ok: false, baseUrl: probe.baseUrl, connector, error: probe.error || "Connector runner unavailable", probe, payload };
  }
  try {
    const response = await fetch(`${probe.baseUrl}/publish/${connector}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        baseUrl: probe.baseUrl,
        connector,
        error: detail || `Connector runner rejected request (${response.status})`,
        probe,
        payload,
      };
    }
    const data = await response.json().catch(() => ({} as any));
    return {
      ok: true,
      baseUrl: probe.baseUrl,
      connector,
      runId: String((data as any)?.runId || (data as any)?.jobId || (data as any)?.id || ""),
      detail: String((data as any)?.detail || (data as any)?.status || "accepted"),
      probe,
      payload,
    };
  } catch (error) {
    return {
      ok: false,
      baseUrl: probe.baseUrl,
      connector,
      error: error instanceof Error ? error.message : "Connector request failed",
      probe,
      payload,
    };
  }
}


export async function pollPublishingConnectorRunLocal(
  connector: "youtube" | "gumroad",
  runId: string,
  options?: { baseUrl?: string },
): Promise<PublishingConnectorPollResult> {
  const probe = await probePublishingConnectorBackend(options?.baseUrl);
  if (!probe.ok) {
    return { ok: false, baseUrl: probe.baseUrl, connector, runId, error: probe.error || "Connector runner unavailable", probe };
  }
  try {
    const response = await fetch(`${probe.baseUrl}/publish/runs/${encodeURIComponent(runId)}`);
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        baseUrl: probe.baseUrl,
        connector,
        runId,
        error: detail || `Connector poll failed (${response.status})`,
        probe,
      };
    }
    const data = await response.json().catch(() => ({} as any));
    return {
      ok: true,
      baseUrl: probe.baseUrl,
      connector,
      runId: String((data as any)?.runId || runId),
      status: String((data as any)?.status || "accepted"),
      detail: String((data as any)?.detail || (data as any)?.message || ""),
      probe,
      receipt: normalizePublishingReceiptRecord((data as any)?.receipt),
      payloadPath: String((data as any)?.payloadPath || ""),
    };
  } catch (error) {
    return {
      ok: false,
      baseUrl: probe.baseUrl,
      connector,
      runId,
      error: error instanceof Error ? error.message : "Connector poll failed",
      probe,
    };
  }
}

export async function importPublishingConnectorReceiptLocal(
  connector: "youtube" | "gumroad",
  runId: string,
  options?: { baseUrl?: string },
): Promise<PublishingConnectorPollResult> {
  const probe = await probePublishingConnectorBackend(options?.baseUrl);
  if (!probe.ok) {
    return { ok: false, baseUrl: probe.baseUrl, connector, runId, error: probe.error || "Connector runner unavailable", probe };
  }
  try {
    const response = await fetch(`${probe.baseUrl}/publish/runs/${encodeURIComponent(runId)}/receipt`);
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        baseUrl: probe.baseUrl,
        connector,
        runId,
        error: detail || `Receipt import failed (${response.status})`,
        probe,
      };
    }
    const data = await response.json().catch(() => ({} as any));
    return {
      ok: true,
      baseUrl: probe.baseUrl,
      connector,
      runId: String((data as any)?.runId || runId),
      status: String((data as any)?.status || "completed"),
      detail: String((data as any)?.detail || (data as any)?.message || ""),
      probe,
      receipt: normalizePublishingReceiptRecord((data as any)?.receipt || (data as any)?.artifact),
      payloadPath: String((data as any)?.payloadPath || ""),
    };
  } catch (error) {
    return {
      ok: false,
      baseUrl: probe.baseUrl,
      connector,
      runId,
      error: error instanceof Error ? error.message : "Receipt import failed",
      probe,
    };
  }
}

export async function probeAnimationExecutionBackend(baseUrl?: string): Promise<AnimationBackendProbeResult> {
  const normalized = normalizeBackendBaseUrl(baseUrl);
  try {
    const response = await fetch(`${normalized}/health`);
    if (!response.ok) {
      return { ok: false, baseUrl: normalized, error: `Health probe failed (${response.status})` };
    }
    const data = await response.json().catch(() => ({} as any));
    return {
      ok: true,
      baseUrl: normalized,
      status: String((data as any)?.status || "ready"),
      service: String((data as any)?.service || "animation-runner"),
    };
  } catch (error) {
    return { ok: false, baseUrl: normalized, error: error instanceof Error ? error.message : "Runner unavailable" };
  }
}

export async function runAnimationExecutionJobLocal(job: AnimationRenderJob, options?: { baseUrl?: string }): Promise<AnimationBackendRunResult> {
  const probe = await probeAnimationExecutionBackend(options?.baseUrl);
  if (!probe.ok) {
    return { ok: false, baseUrl: probe.baseUrl, error: probe.error || "Runner unavailable", probe };
  }
  try {
    const response = await fetch(`${probe.baseUrl}/render/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "animation-episode",
        jobId: job.id,
        projectId: job.projectId,
        projectTitle: job.projectTitle,
        outputDir: job.outputDir,
        finalEpisodeFile: job.finalEpisodeFile,
        voiceModel: job.voiceModel,
        renderProfile: job.renderProfile,
        scenes: job.scenes.map((scene, index) => ({
          index,
          sceneId: scene.sceneId,
          sceneTitle: scene.sceneTitle,
          durationSec: scene.durationSec,
          voiceText: scene.voiceText,
          voiceAssetFile: scene.voiceAsset.voiceAssetFile,
          outputFile: scene.outputFile,
          visualPrompt: scene.visualPrompt,
          motionPrompt: scene.motionPrompt,
          sfx: scene.sfx,
          shotNotes: scene.shotNotes,
          cameraPlan: scene.shotManifest.cameraPlan,
          shots: scene.shotManifest.shots,
        })),
        executionPlan: job.executionPlan,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, baseUrl: probe.baseUrl, error: detail || `Runner rejected request (${response.status})`, probe };
    }
    const data = await response.json().catch(() => ({} as any));
    return {
      ok: true,
      baseUrl: probe.baseUrl,
      jobId: String((data as any)?.jobId || (data as any)?.id || job.id),
      detail: String((data as any)?.status || (data as any)?.detail || "queued"),
      probe,
    };
  } catch (error) {
    return { ok: false, baseUrl: probe.baseUrl, error: error instanceof Error ? error.message : "Runner request failed", probe };
  }
}

export function refreshAnimationExecutionJob(job: AnimationRenderJob): AnimationRenderJob {
  return normalizeAnimationRenderJob({ ...job, updatedAt: Date.now() });
}

export function createAnimationRenderJob(project: AnimationProject, options?: { voiceModel?: string; renderProfile?: string; outputRoot?: string }): AnimationRenderJob {
  const createdAt = Date.now();
  const safeTitle = uidFileSafeLocal(project.title);
  const outputDir = `${options?.outputRoot || "render_lab/animation_jobs"}/${safeTitle}`;
  const voiceModel = options?.voiceModel || "homie-voice-v1";
  const scenes: AnimationRenderSceneJob[] = project.scenes.map((scene, index) => {
    const scenePrefix = `${outputDir}/scene_${String(index + 1).padStart(2, "0")}_${uidFileSafeLocal(scene.title)}`;
    const voiceText = [scene.dialogue, scene.narration].filter(Boolean).join(" ").trim();
    return {
      sceneId: scene.id,
      sceneTitle: scene.title,
      durationSec: scene.durationSec,
      visualPrompt: scene.visualPrompt,
      motionPrompt: scene.motionPrompt,
      voiceText,
      sfx: scene.sfx,
      renderStatus: "queued",
      outputFile: `${scenePrefix}.mp4`,
      shotNotes: `Animate ${scene.title} with ${scene.motionPrompt}. Use visual prompt as frame guidance and keep continuity with ${project.styleGuide}.`,
      voiceAsset: {
        sceneId: scene.id,
        voiceAssetFile: `${scenePrefix}_voice.wav`,
        transcript: voiceText || "instrumental / fx only",
        durationSec: Math.max(2, Math.round(scene.durationSec * 0.9)),
        voiceModel,
      },
      shotManifest: {
        sceneId: scene.id,
        shots: [
          `Shot A: Establish ${scene.title} with ${scene.visualPrompt}.`,
          `Shot B: Push motion with ${scene.motionPrompt}.`,
          `Shot C: Land on the strongest acting beat tied to ${scene.sfx[0] || "the emotional cue"}.`,
        ],
        cameraPlan: `Start wide, move to medium performance coverage, end on a detail or reaction for ${scene.title}.`,
        continuityNotes: [
          `Carry the style guide forward: ${project.styleGuide}.`,
          `Keep character silhouettes and color language consistent into the next scene.`,
        ],
      },
    };
  });
  const baseJob: AnimationRenderJob = {
    id: uid(),
    projectId: project.id,
    projectTitle: project.title,
    format: project.format,
    status: "queued",
    createdAt,
    updatedAt: createdAt,
    outputDir,
    voiceModel,
    renderProfile: options?.renderProfile || "1080p-cartoon-fast",
    scenes,
    finalEpisodeFile: `${outputDir}/${safeTitle}_final_episode.mp4`,
    executionPlan: {
      voiceEngine: "python local_tts.py",
      renderer: "python local_scene_renderer.py",
      ffmpegPath: "ffmpeg",
      workDir: outputDir,
      manifestFile: `${outputDir}/execution_manifest.json`,
      windowsScript: { filename: `${safeTitle}_episode_build.bat`, content: "" },
      bashScript: { filename: `${safeTitle}_episode_build.sh`, content: "" },
      voiceCommands: [],
      renderCommands: [],
      ffmpegCommands: [],
      executionNotes: [],
      generatedAt: createdAt,
    },
  };
  return { ...baseJob, executionPlan: buildAnimationExecutionPlan(baseJob) };
}

export function advanceAnimationRenderJob(job: AnimationRenderJob): AnimationRenderJob {
  const scenes = [...job.scenes];
  const target = scenes.find((scene) => scene.renderStatus !== "assembled");
  if (!target) {
    const assembledJob = { ...job, status: "assembled" as AnimationRenderStatus, updatedAt: Date.now() };
    return { ...assembledJob, executionPlan: buildAnimationExecutionPlan(assembledJob) };
  }
  const nextStatus: AnimationRenderStatus = target.renderStatus === "queued"
    ? "rendering"
    : target.renderStatus === "rendering"
      ? "voice-ready"
      : target.renderStatus === "voice-ready"
        ? "shot-manifested"
        : target.renderStatus === "shot-manifested"
          ? "assembly-ready"
          : "assembled";
  const nextScenes = scenes.map((scene) => scene.sceneId === target.sceneId ? { ...scene, renderStatus: nextStatus } : scene);
  const allAssembled = nextScenes.every((scene) => scene.renderStatus === "assembled");
  const status: AnimationRenderStatus = allAssembled
    ? "assembled"
    : nextScenes.some((scene) => scene.renderStatus === "assembly-ready")
      ? "assembly-ready"
      : nextScenes.some((scene) => scene.renderStatus === "shot-manifested")
        ? "shot-manifested"
        : nextScenes.some((scene) => scene.renderStatus === "voice-ready")
          ? "voice-ready"
          : nextScenes.some((scene) => scene.renderStatus === "rendering")
            ? "rendering"
            : "queued";
  const nextJob: AnimationRenderJob = { ...job, scenes: nextScenes, status, updatedAt: Date.now() };
  return { ...nextJob, executionPlan: buildAnimationExecutionPlan(nextJob) };
}

export function finishAnimationRenderJob(job: AnimationRenderJob): AnimationRenderJob {
  const nextJob: AnimationRenderJob = {
    ...job,
    scenes: job.scenes.map((scene) => ({ ...scene, renderStatus: "assembled" })),
    status: "assembled",
    updatedAt: Date.now(),
  };
  return { ...nextJob, executionPlan: buildAnimationExecutionPlan(nextJob) };
}

export function buildAnimationEpisodePackage(project: AnimationProject, job: AnimationRenderJob): AnimationEpisodePackage {
  const createdAt = Date.now();
  const runtimeSec = project.scenes.reduce((sum, scene) => sum + scene.durationSec, 0);
  const voiceManifest = job.scenes.map((scene, index) => `Scene ${index + 1}: ${scene.voiceAsset.voiceAssetFile} â€¢ ${scene.voiceAsset.voiceModel} â€¢ ${scene.voiceAsset.durationSec}s`);
  const shotManifest = job.scenes.map((scene, index) => `Scene ${index + 1}: ${scene.shotManifest.cameraPlan} | ${scene.shotManifest.shots.join(" | ")}`);
  const assemblyNotes = job.scenes.map((scene, index) => `Scene ${index + 1}: output ${scene.outputFile} â€¢ status ${scene.renderStatus}`);
  const assemblyRecipe = [
    `Voice model: ${job.voiceModel}`,
    `Render profile: ${job.renderProfile}`,
    `Output directory: ${job.outputDir}`,
    `Final episode file: ${job.finalEpisodeFile}`,
    ...job.scenes.map((scene, index) => `Step ${index + 1}: render ${scene.sceneTitle} using ${scene.voiceAsset.voiceAssetFile} and ${scene.outputFile}`),
  ];
  const mergedLines = [
    `# ${project.title} â€” Final Episode Package`,
    "",
    `Summary: ${project.logline}`,
    `Runtime: ~${runtimeSec}s`,
    `Final episode: ${job.finalEpisodeFile}`,
    "",
    "## Voice Manifest",
    ...voiceManifest,
    "",
    "## Shot Manifest",
    ...shotManifest,
    "",
    "## Assembly Notes",
    ...assemblyNotes,
    "",
    "## Assembly Recipe",
    ...assemblyRecipe,
    "",
    "## Execution Notes",
    ...job.executionPlan.executionNotes,
    "",
    "## Windows Build Script",
    job.executionPlan.windowsScript.filename,
    "",
    "## Bash Build Script",
    job.executionPlan.bashScript.filename,
  ];
  return {
    id: uid(),
    projectId: project.id,
    renderJobId: job.id,
    title: project.title,
    format: project.format,
    runtimeSec,
    summary: project.logline,
    finalEpisodeFile: job.finalEpisodeFile,
    sceneFiles: job.scenes.map((scene) => scene.outputFile),
    voiceManifest,
    shotManifest,
    assemblyNotes,
    assemblyRecipe,
    executionNotes: job.executionPlan.executionNotes,
    executionScripts: [job.executionPlan.windowsScript.filename, job.executionPlan.bashScript.filename],
    mergedContent: mergedLines.join("\n"),
    createdAt,
  };
}

export function exportAnimationEpisodePackage(pkg: AnimationEpisodePackage, format: "txt" | "md" | "json") {
  if (format === "json") return JSON.stringify(pkg, null, 2);
  if (format === "txt") return pkg.mergedContent.replace(/^# /gm, "");
  return pkg.mergedContent;
}


export type AnimationBackendArtifactRecord = {
  path: string;
  label?: string;
  kind?: string;
  url?: string;
};

export type AnimationBackendPollResult = {
  ok: boolean;
  baseUrl: string;
  jobId: string;
  status?: string;
  detail?: string;
  artifacts: AnimationBackendArtifactRecord[];
  error?: string;
  probe: AnimationBackendProbeResult;
};

function normalizeArtifactRecord(raw: any): AnimationBackendArtifactRecord | null {
  const path = String(raw?.path || raw?.file || raw?.filepath || raw?.output || raw?.name || '').trim();
  if (!path) return null;
  return {
    path,
    label: raw?.label ? String(raw.label) : undefined,
    kind: raw?.kind ? String(raw.kind) : undefined,
    url: raw?.url ? String(raw.url) : undefined,
  };
}

function extractArtifacts(payload: any): AnimationBackendArtifactRecord[] {
  const candidates = [
    ...(Array.isArray(payload?.artifacts) ? payload.artifacts : []),
    ...(Array.isArray(payload?.files) ? payload.files : []),
    ...(Array.isArray(payload?.outputs) ? payload.outputs : []),
  ];
  const mapped = candidates.map(normalizeArtifactRecord).filter(Boolean) as AnimationBackendArtifactRecord[];
  const seen = new Set<string>();
  return mapped.filter((item) => {
    const key = `${item.kind || ''}|${item.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function pollAnimationExecutionJobLocal(job: AnimationRenderJob, options?: { baseUrl?: string }): Promise<AnimationBackendPollResult> {
  const probe = await probeAnimationExecutionBackend(options?.baseUrl);
  if (!probe.ok) {
    return { ok: false, baseUrl: probe.baseUrl, jobId: job.id, artifacts: [], error: probe.error || 'Runner unavailable', probe };
  }
  try {
    const response = await fetch(`${probe.baseUrl}/render/jobs/${encodeURIComponent(job.id)}`);
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { ok: false, baseUrl: probe.baseUrl, jobId: job.id, artifacts: [], error: detail || `Status poll failed (${response.status})`, probe };
    }
    const data = await response.json().catch(() => ({} as any));
    return {
      ok: true,
      baseUrl: probe.baseUrl,
      jobId: String((data as any)?.jobId || (data as any)?.id || job.id),
      status: String((data as any)?.status || (data as any)?.state || 'queued'),
      detail: String((data as any)?.detail || (data as any)?.message || ''),
      artifacts: extractArtifacts(data),
      probe,
    };
  } catch (error) {
    return { ok: false, baseUrl: probe.baseUrl, jobId: job.id, artifacts: [], error: error instanceof Error ? error.message : 'Status poll failed', probe };
  }
}

export async function importAnimationExecutionArtifacts(job: AnimationRenderJob, options?: { baseUrl?: string }): Promise<AnimationBackendPollResult> {
  const probe = await probeAnimationExecutionBackend(options?.baseUrl);
  if (!probe.ok) {
    return { ok: false, baseUrl: probe.baseUrl, jobId: job.id, artifacts: [], error: probe.error || 'Runner unavailable', probe };
  }
  try {
    const response = await fetch(`${probe.baseUrl}/render/jobs/${encodeURIComponent(job.id)}/artifacts`);
    if (response.ok) {
      const data = await response.json().catch(() => ({} as any));
      return {
        ok: true,
        baseUrl: probe.baseUrl,
        jobId: String((data as any)?.jobId || (data as any)?.id || job.id),
        status: String((data as any)?.status || (data as any)?.state || job.status),
        detail: String((data as any)?.detail || (data as any)?.message || ''),
        artifacts: extractArtifacts(data),
        probe,
      };
    }
  } catch {}
  return pollAnimationExecutionJobLocal(job, options);
}

