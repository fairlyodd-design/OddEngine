export type StudioProjectType =
  | "song"
  | "book"
  | "cartoon"
  | "video"
  | "music video"
  | "other";

export type StudioRoomKey =
  | "home"
  | "writing"
  | "director"
  | "music"
  | "render"
  | "ops";

export type StudioAssetKind =
  | "story"
  | "song"
  | "character"
  | "storyboard"
  | "cartoonBible"
  | "videoTreatment"
  | "shotList"
  | "productionPack"
  | "featureOutline"
  | "episodeGuide"
  | "animationPlan"
  | "castingPack"
  | "artPromptPack"
  | "productionRunbook"
  | "pitchDeck"
  | "oneSheet"
  | "trailerBrief"
  | "renderHandoff"
  | "screeningPacket"
  | "renderJob";

export type StudioAsset = {
  id: string;
  kind: StudioAssetKind;
  title: string;
  content: string;
  ts: number;
};

export type StudioAutomationInput = {
  masterPrompt: string;
  projectType: StudioProjectType;
  visualStyle: string;
  productionType: string;
  releaseTarget: string;
  budgetBand: string;
  scopeLevel: string;
  existingAssets?: StudioAsset[];
};

export type StudioAutomationOutput = {
  home: StudioAsset[];
  writing: StudioAsset[];
  director: StudioAsset[];
  music: StudioAsset[];
  render: StudioAsset[];
  ops: StudioAsset[];
};

export type FinalProjectPacket = {
  title: string;
  projectType: StudioProjectType;
  productionType: string;
  visualStyle: string;
  releaseTarget: string;
  budgetBand: string;
  scopeLevel: string;
  masterPrompt: string;
  generatedAt: number;
  rooms: {
    home: StudioAsset[];
    writing: StudioAsset[];
    director: StudioAsset[];
    music: StudioAsset[];
    render: StudioAsset[];
    ops: StudioAsset[];
  };
  summary: {
    totalAssets: number;
    latestByRoom: Record<string, string | null>;
    missingRooms: StudioRoomKey[];
  };
};

function uid() {
  return `studio_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function clean(text: string) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

export function titleFromPrompt(prompt: string, fallback = "Untitled Studio Project") {
  const text = clean(prompt);
  if (!text) return fallback;
  return text.split(" ").slice(0, 8).join(" ").replace(/[.,:;!?]+$/g, "");
}

export function inferStudioProjectType(writerMode: string): StudioProjectType {
  const value = String(writerMode || "").toLowerCase();
  if (value === "song") return "song";
  if (value === "cartoon") return "cartoon";
  if (value === "video" || value === "movie") return "video";
  return "book";
}

export function mapProjectTypeToProductionType(projectType: StudioProjectType) {
  switch (projectType) {
    case "song":
      return "Song";
    case "book":
      return "Book";
    case "cartoon":
      return "Cartoon";
    case "video":
      return "Movie";
    case "music video":
      return "Music Video";
    default:
      return "Story";
  }
}

export function getRoomKinds(room: StudioRoomKey): StudioAssetKind[] {
  switch (room) {
    case "home":
      return ["oneSheet"];
    case "writing":
      return ["story", "song"];
    case "director":
      return ["storyboard", "shotList", "videoTreatment", "featureOutline"];
    case "music":
      return ["productionPack", "song"];
    case "render":
      return ["renderHandoff", "renderJob"];
    case "ops":
      return ["productionRunbook", "screeningPacket", "oneSheet"];
    default:
      return [];
  }
}

function createAsset(kind: StudioAssetKind, title: string, content: string): StudioAsset {
  return {
    id: uid(),
    kind,
    title,
    content,
    ts: Date.now(),
  };
}

function projectLens(projectType: StudioProjectType) {
  switch (projectType) {
    case "song":
      return {
        writingLabel: "lyrics + song structure",
        outputLabel: "finished song packet",
        narrativeLabel: "emotional arc",
      };
    case "book":
      return {
        writingLabel: "story draft + chapter spine",
        outputLabel: "finished book packet",
        narrativeLabel: "narrative arc",
      };
    case "cartoon":
      return {
        writingLabel: "episode or short script",
        outputLabel: "finished cartoon packet",
        narrativeLabel: "character-and-gag arc",
      };
    case "video":
      return {
        writingLabel: "script + scene flow",
        outputLabel: "finished video packet",
        narrativeLabel: "visual arc",
      };
    case "music video":
      return {
        writingLabel: "lyric/video hybrid script",
        outputLabel: "finished music video packet",
        narrativeLabel: "performance arc",
      };
    default:
      return {
        writingLabel: "creative draft",
        outputLabel: "finished project packet",
        narrativeLabel: "core arc",
      };
  }
}

function buildHome(input: StudioAutomationInput): StudioAsset[] {
  const title = titleFromPrompt(input.masterPrompt);
  const lens = projectLens(input.projectType);
  const content = [
    `# ${title}`,
    ``,
    `## Concept Summary`,
    `${clean(input.masterPrompt) || "No master prompt supplied yet."}`,
    ``,
    `## Project Shape`,
    `- Project type: ${input.projectType}`,
    `- Production type: ${input.productionType}`,
    `- Visual style: ${input.visualStyle}`,
    `- Release target: ${input.releaseTarget}`,
    `- Budget band: ${input.budgetBand}`,
    `- Scope level: ${input.scopeLevel}`,
    ``,
    `## Hook`,
    `Build a ${input.projectType} that turns this concept into a ${lens.outputLabel} with a clear emotional center, memorable imagery, and a shippable working copy.`,
    ``,
    `## Audience Promise`,
    `Give the audience one clean reason to care immediately, one emotional turn in the middle, and one strong ending image or feeling to leave with.`,
  ].join("\n");

  return [createAsset("oneSheet", `Studio Brief • ${title}`, content)];
}

function buildWriting(input: StudioAutomationInput): StudioAsset[] {
  const title = titleFromPrompt(input.masterPrompt);
  const lens = projectLens(input.projectType);

  if (input.projectType === "song") {
    const content = [
      `# ${title}`,
      ``,
      `## Song Concept`,
      `${clean(input.masterPrompt)}`,
      ``,
      `## Song Structure`,
      `- Intro`,
      `- Verse 1`,
      `- Pre-Chorus`,
      `- Chorus`,
      `- Verse 2`,
      `- Chorus`,
      `- Bridge`,
      `- Final Chorus / Outro`,
      ``,
      `## Draft Lyrics`,
      `Verse 1: Set the scene and emotional problem.`,
      `Pre-Chorus: Raise pressure and expectation.`,
      `Chorus: Land the biggest hook and repeatable line.`,
      `Verse 2: Widen the emotional picture or conflict.`,
      `Bridge: Twist the meaning or strip it down.`,
      `Final Chorus: Bring the theme home bigger and clearer.`,
      ``,
      `## Working Copy Notes`,
      `- Keep the chorus title-worthy and easy to repeat.`,
      `- Match melody mood to ${input.visualStyle}.`,
      `- Build toward a final line that feels like closure.`,
    ].join("\n");

    return [createAsset("song", `Song Draft • ${title}`, content)];
  }

  const content = [
    `# ${title}`,
    ``,
    `## Writing Room Draft`,
    `${clean(input.masterPrompt)}`,
    ``,
    `## Story Engine`,
    `- Opening situation`,
    `- Main tension`,
    `- Midpoint turn`,
    `- Escalation`,
    `- Resolution`,
    ``,
    `## Draft / Script Spine`,
    `This ${input.projectType} should start with a strong hook, establish the core conflict fast, escalate through a sequence of increasingly visual scenes, and close on a memorable final beat.`,
    ``,
    `## Working Copy Notes`,
    `- Primary output: ${lens.writingLabel}`,
    `- Narrative focus: ${lens.narrativeLabel}`,
    `- Tone target: ${input.visualStyle}`,
    `- Release-minded finish: ${input.releaseTarget}`,
  ].join("\n");

  return [createAsset("story", `Writing Draft • ${title}`, content)];
}

function buildDirector(input: StudioAutomationInput): StudioAsset[] {
  const title = titleFromPrompt(input.masterPrompt);

  const storyboard = [
    `# ${title} — Storyboard Beats`,
    ``,
    `1. Opening hook image`,
    `2. Character / idea reveal`,
    `3. Escalation beat`,
    `4. Midpoint turn`,
    `5. Emotional or visual payoff`,
    `6. Ending image`,
    ``,
    `## Camera / Rhythm Notes`,
    `- Use ${input.visualStyle} as the visual grammar.`,
    `- Keep transitions motivated by emotion, not random movement.`,
    `- Build each beat so it can survive as a still frame or render card.`,
  ].join("\n");

  const shotList = [
    `# ${title} — Shot List`,
    ``,
    `- Wide establishing frame`,
    `- Medium character/action frame`,
    `- Close emotional detail`,
    `- Moving transition shot`,
    `- Impact hero shot`,
    `- Final resolve frame`,
    ``,
    `## Director Notes`,
    `- Scope: ${input.scopeLevel}`,
    `- Budget pressure: ${input.budgetBand}`,
    `- Release lane: ${input.releaseTarget}`,
  ].join("\n");

  return [
    createAsset("storyboard", `Storyboard • ${title}`, storyboard),
    createAsset("shotList", `Shot List • ${title}`, shotList),
  ];
}

function buildMusic(input: StudioAutomationInput): StudioAsset[] {
  const title = titleFromPrompt(input.masterPrompt);

  const content = [
    `# ${title} — Music Lab`,
    ``,
    `## Sonic Direction`,
    `- Overall feeling: ${input.visualStyle}`,
    `- Energy target: build from mood into payoff`,
    `- Rhythm idea: support the pacing of the story or visual edit`,
    ``,
    `## Cue / Voice Ideas`,
    `- Opening cue: set tone immediately`,
    `- Mid cue: support the turning point`,
    `- Final cue: reinforce the ending image`,
    `- Voice idea: intimate, cinematic, and emotionally legible`,
    ``,
    `## Production Notes`,
    `- Tie the music language back to the master prompt`,
    `- Keep motif repetition simple enough to ship`,
    `- Leave room for dialogue or visual emphasis when needed`,
  ].join("\n");

  return [createAsset("productionPack", `Music Direction • ${title}`, content)];
}

function buildRender(input: StudioAutomationInput): StudioAsset[] {
  const title = titleFromPrompt(input.masterPrompt);

  const content = [
    `{`,
    `  "title": ${JSON.stringify(title)},`,
    `  "projectType": ${JSON.stringify(input.projectType)},`,
    `  "productionType": ${JSON.stringify(input.productionType)},`,
    `  "visualStyle": ${JSON.stringify(input.visualStyle)},`,
    `  "releaseTarget": ${JSON.stringify(input.releaseTarget)},`,
    `  "budgetBand": ${JSON.stringify(input.budgetBand)},`,
    `  "scopeLevel": ${JSON.stringify(input.scopeLevel)},`,
    `  "renderIntent": "Prompt-to-project automation handoff from FairlyOdd Studio",`,
    `  "renderNotes": [`,
    `    "Generate a finished working copy, not just loose ideas.",`,
    `    "Preserve the emotional center of the master prompt.",`,
    `    "Prefer clean scene continuity and strong ending image."`,
    `  ]`,
    `}`,
  ].join("\n");

  return [createAsset("renderHandoff", `Render Handoff • ${title}`, content)];
}

function buildOps(input: StudioAutomationInput): StudioAsset[] {
  const title = titleFromPrompt(input.masterPrompt);

  const runbook = [
    `# ${title} — Producer Ops Runbook`,
    ``,
    `## Deliverables`,
    `- Concept brief`,
    `- Writing draft`,
    `- Storyboard + shot list`,
    `- Music direction`,
    `- Render handoff`,
    `- Final review packet`,
    ``,
    `## Checklist`,
    `- Confirm title and one-line hook`,
    `- Confirm core draft is coherent`,
    `- Confirm storyboard beats map to the story`,
    `- Confirm music direction supports pacing`,
    `- Confirm render handoff is complete`,
    `- Confirm release target and packaging lane`,
  ].join("\n");

  const screening = [
    `# ${title} — Review / Screening Packet`,
    ``,
    `## Review Lens`,
    `- Is the concept easy to explain?`,
    `- Does the middle escalate clearly?`,
    `- Is there a memorable ending beat?`,
    `- Does the project feel shippable, not just brainstormed?`,
    ``,
    `## Final Output Goal`,
    `Prompt in → project packet out with writing, directing, music, render, and producer readiness all visible in one place.`,
  ].join("\n");

  return [
    createAsset("productionRunbook", `Producer Runbook • ${title}`, runbook),
    createAsset("screeningPacket", `Screening Packet • ${title}`, screening),
  ];
}

export function generateStudioRoomAssets(
  input: StudioAutomationInput,
  room: StudioRoomKey,
): StudioAsset[] {
  switch (room) {
    case "home":
      return buildHome(input);
    case "writing":
      return buildWriting(input);
    case "director":
      return buildDirector(input);
    case "music":
      return buildMusic(input);
    case "render":
      return buildRender(input);
    case "ops":
      return buildOps(input);
    default:
      return [];
  }
}

export function generateFullStudioPipeline(
  input: StudioAutomationInput,
): StudioAutomationOutput {
  return {
    home: buildHome(input),
    writing: buildWriting(input),
    director: buildDirector(input),
    music: buildMusic(input),
    render: buildRender(input),
    ops: buildOps(input),
  };
}

function newestFirst<T extends { ts?: number }>(items: T[]) {
  return [...items].sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
}

export function splitAssetsByRoom(assets: StudioAsset[]): FinalProjectPacket["rooms"] {
  const newest = newestFirst(assets);
  return {
    home: newest.filter((asset) => getRoomKinds("home").includes(asset.kind)),
    writing: newest.filter((asset) => getRoomKinds("writing").includes(asset.kind)),
    director: newest.filter((asset) => getRoomKinds("director").includes(asset.kind)),
    music: newest.filter((asset) => getRoomKinds("music").includes(asset.kind)),
    render: newest.filter((asset) => getRoomKinds("render").includes(asset.kind)),
    ops: newest.filter((asset) => getRoomKinds("ops").includes(asset.kind)),
  };
}

export function getMissingRooms(assets: StudioAsset[]): StudioRoomKey[] {
  const rooms = splitAssetsByRoom(assets);
  const order: StudioRoomKey[] = ["home", "writing", "director", "music", "render", "ops"];
  return order.filter((room) => rooms[room].length === 0);
}

export function flattenRoomAssets(packet: StudioAutomationOutput): StudioAsset[] {
  return newestFirst([
    ...packet.home,
    ...packet.writing,
    ...packet.director,
    ...packet.music,
    ...packet.render,
    ...packet.ops,
  ]);
}

export function assembleFinalProjectPacket(input: StudioAutomationInput): FinalProjectPacket {
  const rooms = input.existingAssets?.length
    ? splitAssetsByRoom(input.existingAssets)
    : generateFullStudioPipeline(input);

  const latestByRoom: Record<string, string | null> = {
    home: rooms.home[0]?.title || null,
    writing: rooms.writing[0]?.title || null,
    director: rooms.director[0]?.title || null,
    music: rooms.music[0]?.title || null,
    render: rooms.render[0]?.title || null,
    ops: rooms.ops[0]?.title || null,
  };

  const assetsFlat = [
    ...rooms.home,
    ...rooms.writing,
    ...rooms.director,
    ...rooms.music,
    ...rooms.render,
    ...rooms.ops,
  ];

  return {
    title: titleFromPrompt(input.masterPrompt),
    projectType: input.projectType,
    productionType: input.productionType,
    visualStyle: input.visualStyle,
    releaseTarget: input.releaseTarget,
    budgetBand: input.budgetBand,
    scopeLevel: input.scopeLevel,
    masterPrompt: input.masterPrompt,
    generatedAt: Date.now(),
    rooms,
    summary: {
      totalAssets: assetsFlat.length,
      latestByRoom,
      missingRooms: getMissingRooms(assetsFlat),
    },
  };
}

export function finalProjectPacketToMarkdown(packet: FinalProjectPacket): string {
  const roomOrder: StudioRoomKey[] = ["home", "writing", "director", "music", "render", "ops"];
  const roomLabels: Record<StudioRoomKey, string> = {
    home: "Studio Home",
    writing: "Writing Room",
    director: "Director Room",
    music: "Music Lab",
    render: "Render Lab",
    ops: "Producer Ops",
  };

  const lines: string[] = [
    `# ${packet.title}`,
    ``,
    `## Summary`,
    `- Project type: ${packet.projectType}`,
    `- Production type: ${packet.productionType}`,
    `- Visual style: ${packet.visualStyle}`,
    `- Release target: ${packet.releaseTarget}`,
    `- Budget band: ${packet.budgetBand}`,
    `- Scope level: ${packet.scopeLevel}`,
    `- Total assets: ${packet.summary.totalAssets}`,
    `- Missing rooms: ${packet.summary.missingRooms.length ? packet.summary.missingRooms.join(", ") : "none"}`,
    ``,
    `## Master Prompt`,
    packet.masterPrompt || "No prompt supplied.",
    ``,
  ];

  for (const room of roomOrder) {
    lines.push(`## ${roomLabels[room]}`);
    const assets = packet.rooms[room];
    if (!assets.length) {
      lines.push(`No assets yet.`, ``);
      continue;
    }
    for (const asset of assets) {
      lines.push(`### ${asset.title}`);
      lines.push(`- Kind: ${asset.kind}`);
      lines.push(`- Timestamp: ${new Date(asset.ts).toLocaleString()}`);
      lines.push(``);
      lines.push(asset.content);
      lines.push(``);
    }
  }

  return lines.join("\n");
}

export function downloadTextFile(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
}
