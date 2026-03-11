import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import CardFrame from "../components/CardFrame";
import { loadJSON, saveJSON } from "../lib/storage";
import { oddApi, isDesktop } from "../lib/odd";

type Chapter = {
  title: string;
  notes?: string;
  draft?: string; // v10.22.3+: full text for the chapter
};

type Book = {
  id: string;
  title: string;
  subtitle?: string;
  status: "Idea" | "Drafting" | "Revising" | "Editing" | "Publishing";
  logline?: string;
  notes?: string;
  chapters: Chapter[];
  updatedAt: number;
};

type WriterMsg = { role: "user" | "assistant"; content: string; ts: number };

const KEY = "oddengine:books:v1";
const KEY_ACTIVE = "oddengine:books:active";
const KEY_ACTIVE_CH = "oddengine:books:activeChapter";
const KEY_CHAT = "oddengine:writers:chat:v1";
const KEY_WRITER_MODE = "oddengine:writers:mode:v1";
const KEY_STUDIO_PROMPT = "oddengine:writers:studioPrompt:v1";
const KEY_STUDIO_ASSETS = "oddengine:writers:studioAssets:v1";
const KEY_VISUAL_STYLE = "oddengine:writers:visualStyle:v1";
const KEY_PRODUCTION_TYPE = "oddengine:writers:productionType:v1";
const KEY_RELEASE_TARGET = "oddengine:writers:releaseTarget:v1";
const KEY_BUDGET_BAND = "oddengine:writers:budgetBand:v1";
const KEY_SCOPE_LEVEL = "oddengine:writers:scopeLevel:v1";
const KEY_RENDER_PROVIDER = "oddengine:writers:renderProvider:v1";
const KEY_RENDER_FORMAT = "oddengine:writers:renderFormat:v1";
const KEY_RENDER_FPS = "oddengine:writers:renderFps:v1";
const KEY_RENDER_RESOLUTION = "oddengine:writers:renderResolution:v1";
const KEY_RENDER_BASE = "oddengine:writers:renderBaseUrl:v1";
const KEY_RENDER_JOB_MODE = "oddengine:writers:renderJobMode:v1";
const KEY_RENDER_PREVIEW = "oddengine:writers:renderPreviewUrl:v1";

type WriterMode = "story" | "song" | "cartoon" | "video" | "movie";
type StudioAssetKind = "story" | "song" | "character" | "storyboard" | "cartoonBible" | "videoTreatment" | "shotList" | "productionPack" | "featureOutline" | "episodeGuide" | "animationPlan" | "castingPack" | "artPromptPack" | "productionRunbook" | "pitchDeck" | "oneSheet" | "trailerBrief" | "renderHandoff" | "screeningPacket" | "renderJob";
type StoryboardScene = { title: string; summary: string; camera: string; purpose: string };
type StudioAsset = { id: string; kind: StudioAssetKind; title: string; content: string; ts: number };
type VisualStyle = "neo-noir anime" | "cartoon surreal" | "punk comic" | "dreamy watercolor" | "glitch cyberpop" | "cinematic realism";
type ProductionType = "Book" | "Story" | "Song" | "Movie" | "Music Video" | "Cartoon" | "Series";
type ReleaseTarget = "Indie Launch" | "YouTube / Social" | "Festival Circuit" | "Pitch / Publishing" | "Streaming / Platform";
type BudgetBand = "$" | "$$" | "$$$" | "$$$$";
type ScopeLevel = "Lean" | "Balanced" | "Epic";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function wordCount(text: string) {
  const t = (text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function estimateMinutes(words: number) {
  // simple: 200 wpm reading
  return Math.max(1, Math.round(words / 200));
}

function studioAssetTitle(kind: StudioAssetKind) {
  switch (kind) {
    case "story": return "Full Story Draft";
    case "song": return "Full Song Draft";
    case "character": return "Character Sheet";
    case "storyboard": return "Storyboard Beats";
    case "cartoonBible": return "Cartoon Bible";
    case "videoTreatment": return "Animated Video Treatment";
    case "shotList": return "Shot List";
    case "productionPack": return "Production Pack";
    case "featureOutline": return "Feature Outline";
    case "episodeGuide": return "Episode Guide";
    case "animationPlan": return "Animation Plan";
    case "castingPack": return "Casting Pack";
    case "artPromptPack": return "Art Prompt Pack";
    case "productionRunbook": return "Production Runbook";
    case "pitchDeck": return "Pitch Deck";
    case "oneSheet": return "One Sheet";
    case "trailerBrief": return "Trailer Brief";
    case "renderHandoff": return "Render Handoff Pack";
    case "screeningPacket": return "Screening Packet";
    default: return "Studio Asset";
  }
}

function normalizeLabel(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function extractTitleFromReply(reply: string) {
  const line = String(reply || "").split(/\n/).map((s) => s.trim()).find(Boolean);
  if (!line) return "Untitled";
  return line.replace(/^#+\s*/, "").slice(0, 72);
}


function latestAssetOfKind(assets: StudioAsset[], kinds: StudioAssetKind[]) {
  return assets.find((a) => kinds.includes(a.kind));
}

function parseStoryboardScenes(content: string): StoryboardScene[] {
  const raw = String(content || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const sceneish = raw.filter((line) =>
    /^(\d+[\).\-\s]|shot\s*\d+|scene\s*\d+|beat\s*\d+)/i.test(line) ||
    /framing|camera|purpose|close|wide|tracking|push|pan/i.test(line)
  );
  const source = sceneish.length ? sceneish : raw.filter((line) => line.length > 18);
  return source.slice(0, 8).map((line, idx) => {
    const clean = line.replace(/^(\d+[\).\-\s]*|shot\s*\d+[:\-\s]*|scene\s*\d+[:\-\s]*|beat\s*\d+[:\-\s]*)/i, "").trim();
    const parts = clean.split(/\s[—\-]\s|:\s/);
    const summary = parts[0] || clean || `Scene ${idx + 1}`;
    return {
      title: `Scene ${idx + 1}`,
      summary,
      camera: /close|cu\b/i.test(line) ? "Close / emotional detail" : /wide|establish/i.test(line) ? "Wide / world setup" : /tracking|push|dolly|pan/i.test(line) ? "Moving camera beat" : "Medium / performance frame",
      purpose: /ending|final|resolve|payoff/i.test(line) ? "Payoff / resolve" : /hook|open|opening|intro/i.test(line) ? "Hook / setup" : /chorus|impact|reveal|turn/i.test(line) ? "Impact / escalation" : "Story progression",
    };
  });
}

function buildDirectorTimeline(assets: StudioAsset[]) {
  const source = latestAssetOfKind(assets, ["storyboard", "shotList", "videoTreatment", "featureOutline"]);
  const scenes = parseStoryboardScenes(source?.content || "");
  const phases = ["OPEN", "BUILD", "TURN", "PAYOFF", "END IMAGE", "DELIVERY"];
  return (scenes.length ? scenes : Array.from({ length: 6 }, (_, i) => ({ title: `Scene ${i+1}`, summary: "Waiting for storyboard beats", camera: "Camera plan pending", purpose: "Pipeline placeholder" }))).slice(0, 6).map((scene, idx) => ({
    phase: phases[idx] || `STEP ${idx + 1}`,
    title: scene.title,
    summary: scene.summary,
    camera: scene.camera,
    purpose: scene.purpose,
  }));
}

function buildCastingBoard(assets: StudioAsset[], seed: string) {
  const source = [latestAssetOfKind(assets, ["castingPack"]), latestAssetOfKind(assets, ["character"]), latestAssetOfKind(assets, ["story", "song", "featureOutline"])].find(Boolean);
  const text = String(source?.content || seed || "");
  const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const nameLines = lines.filter((line) => /character|lead|support|villain|narrator|voice|role|name/i.test(line));
  const picks = (nameLines.length ? nameLines : lines).slice(0, 4);
  const defaults = [
    ["Lead", "Magnetic / wounded / unforgettable", "Raw emotional lead with contrast between swagger and vulnerability."],
    ["Support", "Loyal / explosive / funny", "Carries heart and momentum, good for chemistry and banter."],
    ["Wildcard", "Mystic / dangerous / stylish", "Brings visual mystery and tonal left-turn energy."],
    ["Narrator", "Haunting / intimate / cinematic", "Holds the world together with mood and perspective."]
  ];
  return defaults.map((fallback, idx) => {
    const line = picks[idx] || "";
    const clean = line.replace(/^[-*#0-9.\s]+/, "").slice(0, 90);
    return {
      role: fallback[0],
      name: clean.split(/[—:-]/)[0]?.trim() || `${fallback[0]} ${idx + 1}`,
      voice: /soft|gentle|dream/i.test(line) ? "Soft / vulnerable / intimate" : /dark|rough|grit|raspy/i.test(line) ? "Dark / rough / magnetic" : /high|bright|pop/i.test(line) ? "Bright / sharp / melodic" : fallback[1],
      note: clean || fallback[2],
    };
  });
}

function buildBeatMap(assets: StudioAsset[], seed: string) {
  const source = [latestAssetOfKind(assets, ["song"]), latestAssetOfKind(assets, ["videoTreatment"]), latestAssetOfKind(assets, ["storyboard"]), latestAssetOfKind(assets, ["shotList"])].find(Boolean);
  const text = String(source?.content || seed || "");
  const energy = /dark|slow|haunting/i.test(text) ? ["brooding", "rising", "impact", "afterglow"] : ["hook", "lift", "hit", "release"];
  return [
    { part: "Intro", timing: "0:00–0:15", move: "Establish mood + world", beat: energy[0] },
    { part: "Verse 1", timing: "0:15–0:45", move: "Character + tension", beat: "story setup" },
    { part: "Pre / Build", timing: "0:45–1:00", move: "Camera push + visual escalation", beat: energy[1] },
    { part: "Chorus / Hit", timing: "1:00–1:25", move: "Big visual payoff shot", beat: energy[2] },
    { part: "Bridge / Turn", timing: "1:25–1:50", move: "Unexpected style turn or emotional reveal", beat: "switch-up" },
    { part: "Final Chorus / End", timing: "1:50–end", move: "Hero image + final emotional resolve", beat: energy[3] },
  ];
}

function buildFullProjectPacket(seed: string, mode: WriterMode, style: VisualStyle, assets: StudioAsset[]) {
  const rollup = buildAssetRollup(assets);
  const timeline = buildDirectorTimeline(assets);
  const casting = buildCastingBoard(assets, seed);
  const beatMap = buildBeatMap(assets, seed);
  const checklist = buildChecklistFromAssets(assets);
  return [
    `# Full Project Packet`,
    ``,
    `## Core`,
    `- Seed: ${seed || "Untitled creative project"}`,
    `- Mode: ${mode}`,
    `- Visual style: ${style}`,
    `- Writing assets: ${rollup.writing}`,
    `- Visual assets: ${rollup.visual}`,
    `- Production assets: ${rollup.production}`,
    ``,
    `## Director Timeline`,
    ...timeline.map((step, i) => `${i + 1}. ${step.phase} — ${step.summary} (${step.camera}; ${step.purpose})`),
    ``,
    `## Casting Board`,
    ...casting.map((c) => `- ${c.role}: ${c.name} — ${c.voice} — ${c.note}`),
    ``,
    `## Music Video Beat Map`,
    ...beatMap.map((b) => `- ${b.part} [${b.timing}] — ${b.move} (${b.beat})`),
    ``,
    `## Export Checklist`,
    checklist,
  ].join("\n");
}

function buildChecklistFromAssets(assets: StudioAsset[]) {
  const lines: string[] = [];
  const buckets: Array<[string, StudioAssetKind[]]> = [
    ["Creative Core", ["story", "song", "character"]],
    ["Visual Development", ["storyboard", "cartoonBible", "videoTreatment"]],
    ["Production Prep", ["shotList", "productionPack", "animationPlan", "castingPack"]],
    ["Release Readiness", ["featureOutline", "episodeGuide", "artPromptPack", "productionRunbook"]],
  ];
  for (const [label, kinds] of buckets) {
    lines.push(`## ${label}`);
    const found = assets.filter((a) => kinds.includes(a.kind));
    if (!found.length) {
      lines.push("- [ ] Add at least one studio asset in this section");
      lines.push("");
      continue;
    }
    for (const asset of found.slice(0, 4)) {
      lines.push(`- [ ] Review: ${asset.title}`);
      if (asset.kind === "character") lines.push("- [ ] Lock character look / voice / arc");
      if (asset.kind === "storyboard") lines.push("- [ ] Confirm scene order and emotional progression");
      if (asset.kind === "videoTreatment") lines.push("- [ ] Lock palette, transitions, and ending image");
      if (asset.kind === "shotList") lines.push("- [ ] Verify camera motion and transition coverage");
      if (asset.kind === "productionPack") lines.push("- [ ] Confirm assets, animation notes, and next steps");
      if (asset.kind === "featureOutline") lines.push("- [ ] Validate act structure and set-piece ladder");
      if (asset.kind === "episodeGuide") lines.push("- [ ] Check episode escalation and recurring hooks");
      if (asset.kind === "animationPlan") lines.push("- [ ] Confirm animation technique, motion language, and render plan");
      if (asset.kind === "castingPack") lines.push("- [ ] Lock character voices, performance notes, and narrator tone");
      if (asset.kind === "artPromptPack") lines.push("- [ ] Review prompt consistency across characters, world, and shots");
      if (asset.kind === "productionRunbook") lines.push("- [ ] Confirm handoff order from writing to assets to delivery");
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function buildProductionPlan(seed: string, treatment?: StudioAsset, shotList?: StudioAsset) {
  const seedLine = seed?.trim() || "Current project";
  const keyLines = [treatment?.content || "", shotList?.content || ""].join("\n");
  const energy = /dark|cinematic|shadow|night/i.test(keyLines) ? "Dark cinematic" : /bright|colorful|cartoon|neon/i.test(keyLines) ? "Bold animated / neon" : "Hybrid stylized";
  return [
    `# Music Video Production Planner`,
    ``,
    `## Project`,
    `- Title / seed: ${seedLine}`,
    `- Visual energy: ${energy}`,
    `- Primary output: Animated concept / storyboard / treatment handoff`,
    ``,
    `## Pre-production`,
    `- Lock song/story structure and emotional arc`,
    `- Finalize character lead + supporting visual motifs`,
    `- Choose palette, world rules, and motion language`,
    `- Confirm 6–10 anchor shots before animation`,
    ``,
    `## Asset Build`,
    `- Character turnarounds / expressions`,
    `- Key backgrounds and prop list`,
    `- FX list: smoke, fire, glow, rain, particles, overlays`,
    `- Text / lyric cards if needed`,
    ``,
    `## Animation / Edit`,
    `- Build opening hook frame first`,
    `- Prioritize chorus / impact shots second`,
    `- Add transitions, camera pushes, and speed-ramp moments`,
    `- End on the strongest image from the treatment`,
    ``,
    `## Delivery`,
    `- Export art prompt pack`,
    `- Export checklist`,
    `- Save production pack in Studio Asset Vault`,
    `- Build production runbook for team handoff`,
  ].join("\n");
}

function buildArtPromptPack(asset: StudioAsset, seed: string, mode: WriterMode) {
  const vibe = seed?.trim() || "stylized animated world";
  const base = asset.content.replace(/\s+/g, " ").slice(0, 280);
  const title = asset.title || studioAssetTitle(asset.kind);
  const prompts = [
    `1. Key frame hero shot — ${title}; ${vibe}; cinematic composition; animated concept art; high detail; dramatic lighting; clean focal subject; no text`,
    `2. Character spotlight — based on ${title}; expressive face; signature outfit; strong silhouette; animation-ready turnaround feel; no text`,
    `3. Environment frame — world built from ${title}; layered depth; mood lighting; production concept art; no watermark; no text`,
    `4. Action / chorus moment — ${base}; dynamic motion blur; camera push; stylized animated energy; strong color script`,
    `5. Ending image — emotionally resolved final frame from ${title}; iconic composition; poster-worthy animated still; no text`,
  ];
  if (mode === "video" || asset.kind === "videoTreatment" || asset.kind === "shotList") {
    prompts.push(`6. Video sequence frame pack — 4 storyboard-ready frames based on ${title}; consistent character design; consistent palette; animated music video style`);
  }
  return [`# Art Prompt Pack`, ``, `Seed: ${vibe}`, `Source: ${title}`, ``, ...prompts].join("\n");
}

function buildRunbook(seed: string, assets: StudioAsset[], mode: WriterMode) {
  const latestStory = latestAssetOfKind(assets, ["story", "song", "featureOutline", "episodeGuide"]);
  const latestVisual = latestAssetOfKind(assets, ["storyboard", "videoTreatment", "cartoonBible", "artPromptPack"]);
  const latestOps = latestAssetOfKind(assets, ["productionPack", "animationPlan", "castingPack"]);
  const project = seed?.trim() || "Untitled creative project";
  const format = mode === "song" ? "song-led music video" : mode === "movie" ? "animated feature / short film" : mode === "cartoon" ? "cartoon world / episode" : mode === "video" ? "animated music video" : "story-led visual adaptation";
  return [
    `# Full Production Runbook`,
    ``,
    `## Project Positioning`,
    `- Seed: ${project}`,
    `- Format: ${format}`,
    `- Core writing asset: ${latestStory?.title || "Generate story/song/outline first"}`,
    `- Visual anchor: ${latestVisual?.title || "Generate storyboard or treatment"}`,
    `- Production ops anchor: ${latestOps?.title || "Generate production pack or animation plan"}`,
    ``,
    `## Pipeline`,
    `1. Lock script / lyrics / outline`,
    `2. Convert into scene ladder and storyboard cards`,
    `3. Build character + world references`,
    `4. Export art prompt pack and shot priorities`,
    `5. Confirm animation, edit, and delivery plan`,
    ``,
    `## Team Handoff`,
    `- Writer: polish story beats and voice`,
    `- Director: approve scenes, camera language, transitions`,
    `- Art: create character/world keyframes and style frames`,
    `- Animation: block shots by priority`,
    `- Edit / Sound: sync structure, pacing, and payoff`,
    ``,
    `## Release Package`,
    `- Script / lyrics`,
    `- Storyboard scene cards`,
    `- Character/world packet`,
    `- Art prompt pack`,
    `- Production planner + checklist`,
  ].join("\n");
}

function buildAssetRollup(assets: StudioAsset[]) {
  return {
    writing: assets.filter((a) => ["story", "song", "featureOutline", "episodeGuide"].includes(a.kind)).length,
    visual: assets.filter((a) => ["storyboard", "cartoonBible", "videoTreatment", "shotList", "artPromptPack"].includes(a.kind)).length,
    production: assets.filter((a) => ["productionPack", "animationPlan", "castingPack", "productionRunbook"].includes(a.kind)).length,
  };
}

function buildStudioPrompt(args: {
  kind: StudioAssetKind;
  mode: WriterMode;
  seed: string;
  title: string;
  logline: string;
  chapterTitle: string;
  chapterDraft: string;
}) {
  const shared = [
    "You are building a polished creative studio output for the user.",
    "Write complete, usable material — not just notes.",
    "Use strong hooks, concrete imagery, and production-ready structure.",
    "Keep headings clear and make the output easy to copy into a project."
  ].join(" ");

  const context = [
    `Active project: ${args.title || "Untitled"}`,
    `Logline: ${args.logline || "None yet"}`,
    `Current chapter: ${args.chapterTitle || "None"}`,
    args.chapterDraft ? `Current draft context: ${args.chapterDraft.slice(0, 700)}` : ""
  ].filter(Boolean).join("\n");

  const seed = args.seed || "Build from the current creative context.";

  const byKind: Record<StudioAssetKind, string> = {
    story: "Write a complete short story with a strong opening, escalating middle, satisfying ending, and vivid emotional beats.",
    song: "Write a complete song with verse, chorus, verse, bridge, and final chorus. Include performance-ready lyrics and emotional dynamics.",
    character: "Create a full character sheet with name, look, personality, motives, flaws, signature expressions, voice/style notes, and arc.",
    storyboard: "Create a 10-shot storyboard beat list with shot number, what happens, framing/camera, and emotional purpose.",
    cartoonBible: "Build a cartoon bible with premise, world rules, visual style, main cast, tone, and 3 episode/story ideas.",
    videoTreatment: "Create a full animated music video treatment with concept, scene flow, palette, camera energy, transitions, and ending image.",
    shotList: "Create a shot-by-shot production list with framing, motion, actions, transitions, and asset needs.",
    productionPack: "Create a compact production pack with concept, art direction, character needs, scene assets, animation notes, and next steps.",
    featureOutline: "Create a feature/short-film outline with act structure, major set-pieces, emotional turns, and final payoff.",
    episodeGuide: "Create a cartoon/series episode guide with season hook, recurring world rules, and 6 episode concepts.",
    animationPlan: "Create an animation plan with production approach, scene priority, motion style, FX list, and delivery stages.",
    castingPack: "Create a casting and voice pack with character performance notes, narrator tone, delivery direction, and chemistry notes.",
    artPromptPack: "Create an art prompt pack for characters, environments, keyframes, motion moments, and ending frame.",
    productionRunbook: "Create a full production runbook that turns this project into a ready-to-handoff package for a short film, cartoon, or music video team.",
    pitchDeck: "Create a sharp pitch deck in markdown with hook, positioning, audience, comparables, world, characters, monetization/release angle, and why this project is greenlight-worthy.",
    oneSheet: "Create a commercial one-sheet for this project with title, hook, logline, audience, visual identity, release lane, and key reasons to buy/watch/read.",
    trailerBrief: "Create a trailer brief with teaser structure, opening hook, emotional turn, signature visuals, end-card copy, and release CTA.",
    renderHandoff: "Create a render handoff pack for a long-form video team: scene batches, shot prompts, voice/music cues, edit map, delivery settings, and final QC checklist.",
    screeningPacket: "Create a screening packet for a watch-ready product with synopsis, runtime plan, scene order, interstitials, soundtrack cues, poster copy, and post-launch follow-up."
  };

  return `${shared}\n\n${context}\n\nUser prompt: ${seed}\n\nTask: ${byKind[args.kind]}`;
}

function downloadTextFile(filename: string, content: string) {
  try {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  } catch {}
}

function slugifyName(input: string) {
  return String(input || "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "project";
}

function buildStoryboardSheet(scenes: StoryboardScene[], seed: string, style: VisualStyle) {
  const rows = scenes.length
    ? scenes
    : [{ title: "Scene 1", summary: "Generate storyboard beats to populate this sheet.", camera: "Camera plan pending", purpose: "Placeholder" }];
  return [
    `# Storyboard Scene Sheet`,
    ``,
    `Seed: ${seed || "Untitled project"}`,
    `Visual style: ${style}`,
    ``,
    ...rows.flatMap((scene, idx) => [
      `## ${idx + 1}. ${scene.title}`,
      `- Summary: ${scene.summary}`,
      `- Camera: ${scene.camera}`,
      `- Purpose: ${scene.purpose}`,
      ``,
    ]),
  ].join("\n");
}

function buildMusicVideoPlanSheet(beatMap: Array<{ part: string; timing: string; move: string; beat: string }>, seed: string, style: VisualStyle) {
  return [
    `# Music Video Plan Sheet`,
    ``,
    `Seed: ${seed || "Untitled project"}`,
    `Visual style: ${style}`,
    ``,
    ...beatMap.flatMap((step, idx) => [
      `## ${idx + 1}. ${step.part}`,
      `- Timing: ${step.timing}`,
      `- Visual move: ${step.move}`,
      `- Beat purpose: ${step.beat}`,
      ``,
    ]),
  ].join("\n");
}


function buildPitchDeck(seed: string, mode: WriterMode, style: VisualStyle, productionType: ProductionType, releaseTarget: ReleaseTarget, budgetBand: BudgetBand, scopeLevel: ScopeLevel, assets: StudioAsset[]) {
  const title = seed?.trim() || "Untitled FairlyOdd project";
  const comps = mode === "song" ? "Arcade Fire x Gorillaz x cinematic alt-rock" : mode === "movie" ? "Spider-Verse energy x punk myth x emotional indie cinema" : mode === "cartoon" ? "Gravity Falls weirdness x punk-heart surrealism" : "FairlyOdd original with premium alt-world energy";
  const score = Math.min(99, 48 + assets.length * 4 + (scopeLevel === "Epic" ? 6 : scopeLevel === "Balanced" ? 4 : 2));
  return [
    `# Pitch Deck`,
    ``,
    `## Core`,
    `- Project: ${title}`,
    `- Format: ${productionType}`,
    `- Release target: ${releaseTarget}`,
    `- Visual style: ${style}`,
    `- Budget lane: ${budgetBand}`,
    `- Scope: ${scopeLevel}`,
    `- Greenlight score: ${score}/99`,
    ``,
    `## Hook`,
    `- A premium FairlyOdd Phoenix GodMode concept built to work as a complete ${productionType.toLowerCase()} and a transmedia brand seed.`,
    ``,
    `## Audience + comps`,
    `- Audience: genre-curious fans who love emotional worlds, stylized visuals, and memorable hooks.`,
    `- Comps: ${comps}`,
    ``,
    `## Why this wins`,
    `- Strong visual identity`,
    `- Multiple export lanes: script, visuals, promos, packet`,
    `- Clear release/marketing hook for ${releaseTarget}`,
    ``,
    `## Next asks`,
    `- Lock one-sheet and trailer brief`,
    `- Finalize storyboard and art prompts`,
    `- Build release-ready packet`,
  ].join("\n");
}

function buildOneSheet(seed: string, productionType: ProductionType, style: VisualStyle, releaseTarget: ReleaseTarget) {
  const title = seed?.trim() || "Untitled FairlyOdd project";
  return [
    `# One Sheet`,
    ``,
    `## ${title}`,
    `- Format: ${productionType}`,
    `- Style: ${style}`,
    `- Release lane: ${releaseTarget}`,
    ``,
    `## Hook`,
    `A fully realized FairlyOdd-ready concept with emotional punch, stylized visuals, and a world that can scale from page/song into screen.`,
    ``,
    `## Audience`,
    `Fans of cinematic alt worlds, animated myth, emotional genre storytelling, and creator-led indie launches.`,
    ``,
    `## Promise`,
    `- Strong central concept`,
    `- Repeatable iconography and characters`,
    `- Ready for story/song + visual + promo handoff`,
  ].join("\n");
}

function buildTrailerBrief(seed: string, mode: WriterMode, productionType: ProductionType, style: VisualStyle) {
  const title = seed?.trim() || "Untitled FairlyOdd project";
  const trailerType = mode === "song" || productionType === "Music Video" ? "music video teaser" : productionType === "Book" ? "book trailer" : "concept trailer";
  return [
    `# Trailer Brief`,
    ``,
    `- Project: ${title}`,
    `- Trailer type: ${trailerType}`,
    `- Visual style: ${style}`,
    ``,
    `## Structure`,
    `1. Opening hook image / line`,
    `2. World reveal and central promise`,
    `3. Escalation montage with 3 signature moments`,
    `4. Emotional turn or chorus lift`,
    `5. End image + title card + CTA`,
    ``,
    `## Needs`,
    `- 5 anchor frames`,
    `- title lockup`,
    `- score / hook line`,
    `- release CTA`,
  ].join("\n");
}

function buildReleasePlan(seed: string, productionType: ProductionType, releaseTarget: ReleaseTarget, budgetBand: BudgetBand, scopeLevel: ScopeLevel, assets: StudioAsset[]) {
  const title = seed?.trim() || "Untitled FairlyOdd project";
  const rollup = buildAssetRollup(assets);
  return [
    `# Release Plan Generator`,
    ``,
    `- Title: ${title}`,
    `- Product: ${productionType}`,
    `- Release target: ${releaseTarget}`,
    `- Budget band: ${budgetBand}`,
    `- Scope: ${scopeLevel}`,
    `- Assets ready: writing ${rollup.writing} / visual ${rollup.visual} / production ${rollup.production}`,
    ``,
    `## Phases`,
    `1. Lock core idea, product lane, and visual identity`,
    `2. Finalize storyboard, prompt pack, and production handoff`,
    `3. Build launch hooks, trailer cuts, and platform pitch`,
    `4. Export packet and ship to ${releaseTarget}`,
    `5. Follow with teasers, alt cuts, and next-drop plan`,
  ].join("\n");
}

function buildMarketingHooks(seed: string, productionType: ProductionType, style: VisualStyle) {
  const title = seed?.trim() || "Untitled FairlyOdd project";
  return [
    `# Marketing Hook Generator`,
    ``,
    `- ${title}: the ${style} ${productionType.toLowerCase()} built to hit fast and haunt longer.`,
    `- Premium FairlyOdd energy with a strong emotional hook and impossible-to-ignore visuals.`,
    `- One mythic image. One broken heart. One reason to hit play.`,
    `- Weird, cinematic, human, and made to travel across clips, posters, and promos.`,
  ].join("\n");
}

function buildPosterVariants(seed: string, productionType: ProductionType, style: VisualStyle) {
  const title = seed?.trim() || "Untitled FairlyOdd project";
  return [
    `# Poster / Tagline / Title Variants`,
    ``,
    `## Title Variants`,
    `- ${title}`,
    `- ${title}: Phoenix Cut`,
    `- ${title} // Neon Ashes`,
    ``,
    `## Taglines`,
    `- Burn down the old world. Become the signal.`,
    `- When the story breaks, the myth begins.`,
    `- A ${style} ${productionType.toLowerCase()} with heart, fire, and fallout.`,
    ``,
    `## Poster Directions`,
    `- Hero silhouette against a broken neon skyline`,
    `- Emotional close-up with surreal world elements bleeding in`,
    `- Ensemble cast grid with one dominant icon image`,
  ].join("\n");
}

function buildTrailerCuts(seed: string, productionType: ProductionType, style: VisualStyle) {
  const title = seed?.trim() || "Untitled FairlyOdd project";
  return [
    `# Trailer Cut Variants`,
    ``,
    `## 15s Hook Cut`,
    `- strongest image`,
    `- one unforgettable line`,
    `- title + CTA`,
    ``,
    `## 30s Story Cut`,
    `- world`,
    `- conflict`,
    `- payoff image`,
    ``,
    `## 60s Platform Cut`,
    `- atmosphere`,
    `- emotional contrast`,
    `- title and target for ${title} (${productionType}, ${style})`,
  ].join("\n");
}

function buildPlatformPitch(seed: string, productionType: ProductionType, releaseTarget: ReleaseTarget, style: VisualStyle) {
  const title = seed?.trim() || "Untitled FairlyOdd project";
  return [
    `# Platform Pitch Mode`,
    ``,
    `${title} is a FairlyOdd-native ${productionType.toLowerCase()} built for ${releaseTarget}. It combines strong visual identity, emotional hooks, and reusable assets across trailers, posters, clips, and launch docs.`,
    ``,
    `## Why It Travels`,
    `- clear hook`,
    `- premium visual lane (${style})`,
    `- expandable into clips, posters, shorts, and follow-up drops`,
  ].join("\n");
}

function buildMonetizationLane(seed: string, productionType: ProductionType, releaseTarget: ReleaseTarget) {
  const title = seed?.trim() || "Untitled FairlyOdd project";
  return [
    `# Monetization Lane`,
    ``,
    `- Core release of ${title} as a ${productionType.toLowerCase()}`,
    `- Premium digital bundle: docs + art + bonus assets`,
    `- Poster / soundtrack / art-book merch lane`,
    `- Platform / pitch / sponsorship angle for ${releaseTarget}`,
    `- Clips, alt cuts, and bonus packs as follow-up revenue`,
  ].join("\n");
}

function buildFinishedProduct(seed: string, productionType: ProductionType, releaseTarget: ReleaseTarget, style: VisualStyle, assets: StudioAsset[]) {
  const title = seed?.trim() || "Untitled FairlyOdd project";
  const rollup = buildAssetRollup(assets);
  return [
    `# Finished Ready-To-Deploy Product`,
    ``,
    `- Title: ${title}`,
    `- Product: ${productionType}`,
    `- Release target: ${releaseTarget}`,
    `- Visual style: ${style}`,
    `- Writing assets: ${rollup.writing}`,
    `- Visual assets: ${rollup.visual}`,
    `- Production assets: ${rollup.production}`,
    ``,
    `${title} is packaged as a finished FairlyOdd-ready ${productionType.toLowerCase()} with launch docs, visuals, trailer logic, platform pitch language, and monetization paths ready for deployment.`,
  ].join("\n");
}

function buildCinemaMasterPlan(seed: string, productionType: ProductionType, style: VisualStyle, releaseTarget: ReleaseTarget, assets: StudioAsset[]) {
  const timeline = buildDirectorTimeline(assets);
  const casting = buildCastingBoard(assets, seed);
  const beats = buildBeatMap(assets, seed);
  const targetRuntime = productionType === "Movie" ? "78–96 min" : productionType === "Music Video" ? "3–6 min" : productionType === "Cartoon" ? "11–22 min" : productionType === "Series" ? "22–48 min pilot" : "15–35 min";
  return [
    `# Cinema Master Plan`,
    ``,
    `- Project: ${seed || "Untitled project"}`,
    `- Product lane: ${productionType}`,
    `- Visual style: ${style}`,
    `- Release lane: ${releaseTarget}`,
    `- Target runtime: ${targetRuntime}`,
    ``,
    `## Scene Blocks`,
    ...timeline.map((step, idx) => `${idx + 1}. ${step.phase} — ${step.summary} | Camera: ${step.camera} | Purpose: ${step.purpose}`),
    ``,
    `## Cast / Voice Lane`,
    ...casting.map((c) => `- ${c.role}: ${c.name} — ${c.voice}`),
    ``,
    `## Rhythm / Beat Lane`,
    ...beats.map((b) => `- ${b.part} [${b.timing}] — ${b.move} (${b.beat})`),
    ``,
    `## Watch-Ready Goal`,
    `- Build the project as a complete viewer-facing product with opening hook, narrative flow, emotional payoffs, end image, and end-card / release CTA.`,
  ].join("\n");
}

function buildRenderHandoff(seed: string, productionType: ProductionType, style: VisualStyle, assets: StudioAsset[]) {
  const source = latestAssetOfKind(assets, ["storyboard", "shotList", "videoTreatment"]);
  const scenes = parseStoryboardScenes(source?.content || "");
  const rows = scenes.length ? scenes : [{ title: "Scene 1", summary: "Opening hook", camera: "Wide establish", purpose: "Hook" }];
  return [
    `# Render Handoff Pack`,
    ``,
    `- Project: ${seed || "Untitled project"}`,
    `- Product lane: ${productionType}`,
    `- Visual style: ${style}`,
    `- Note: This is a production/export handoff for full-length video creation. It does not directly render a finished movie inside OddEngine.`,
    ``,
    `## Scene Batch Prompts`,
    ...rows.flatMap((scene, idx) => [
      `### Batch ${idx + 1} — ${scene.title}`,
      `- Summary: ${scene.summary}`,
      `- Camera: ${scene.camera}`,
      `- Purpose: ${scene.purpose}`,
      `- Render prompt: ${style} | ${scene.summary} | ${scene.camera} | cinematic continuity | production-ready frame consistency`,
      ``
    ]),
    `## Audio / Music / Voice Lane`,
    `- Dialogue / VO pass`,
    `- Music bed / transitions`,
    `- FX accents / ambience`,
    ``,
    `## Delivery`,
    `- Master timeline assembly`,
    `- QC pass`,
    `- Final render export`,
    `- Poster / trailer / release cut`,
  ].join("\n");
}

function buildSceneBatchExporter(seed: string, style: VisualStyle, assets: StudioAsset[]) {
  const source = latestAssetOfKind(assets, ["storyboard", "shotList", "videoTreatment", "featureOutline"]);
  const scenes = parseStoryboardScenes(source?.content || "");
  const rows = scenes.length ? scenes : [{ title: "Scene 1", summary: "Opening image / hook", camera: "Wide establish", purpose: "Hook" }];
  return [
    `# Scene Batch Exporter`,
    ``,
    `- Project: ${seed || "Untitled project"}`,
    `- Visual style: ${style}`,
    `- Goal: Break the project into renderable scene batches with continuity notes.`,
    ``,
    `## Scene Batches`,
    ...rows.flatMap((scene, idx) => [
      `### Batch ${idx + 1} — ${scene.title}`,
      `- Summary: ${scene.summary}`,
      `- Camera lane: ${scene.camera}`,
      `- Story purpose: ${scene.purpose}`,
      `- Render packet: ${style} | ${scene.summary} | maintain character continuity | maintain palette continuity | shot-ready frame set`,
      `- Deliverables: hero frame, alt angle, transition frame, continuity stills`,
      ``
    ])
  ].join("\n");
}

function buildVoiceoverPack(seed: string, productionType: ProductionType, assets: StudioAsset[]) {
  const source = latestAssetOfKind(assets, ["story", "song", "featureOutline", "videoTreatment"]);
  const text = String(source?.content || seed || "");
  const tone = /dark|haunting|night|shadow/i.test(text) ? "dark / intimate / cinematic" : /funny|cartoon|bright|playful/i.test(text) ? "playful / sharp / expressive" : "warm / confident / cinematic";
  return [
    `# Voiceover Pack`,
    ``,
    `- Project: ${seed || "Untitled project"}`,
    `- Product lane: ${productionType}`,
    `- Primary tone: ${tone}`,
    ``,
    `## Voice Roles`,
    `- Narrator / guide voice`,
    `- Lead emotional lane`,
    `- Support reactions / interstitials`,
    ``,
    `## Delivery Notes`,
    `- Capture clean dry takes first`,
    `- Record alt intensity pass for trailer moments`,
    `- Mark breaths / pauses for edit rhythm`,
    `- Export line groups by scene batch`,
    ``,
    `## AI / Studio Prompt`,
    `${seed || text.slice(0, 180)}`,
  ].join("\n");
}

function buildSoundtrackCueSheet(seed: string, style: VisualStyle, beats: ReturnType<typeof buildBeatMap>, productionType: ProductionType) {
  return [
    `# Soundtrack Cue Sheet`,
    ``,
    `- Project: ${seed || "Untitled project"}`,
    `- Product lane: ${productionType}`,
    `- Visual style: ${style}`,
    ``,
    `## Cue Map`,
    ...beats.map((beat, idx) => `- Cue ${idx + 1}: ${beat.part} [${beat.timing}] — ${beat.move} | energy: ${beat.beat}`),
    ``,
    `## Mix Notes`,
    `- Keep dialog / vocal clarity over impact moments`,
    `- Use risers for build sections and hard cuts for reveal turns`,
    `- Reserve signature motif for the payoff / end image`,
  ].join("\n");
}

function buildShotContinuityBoard(seed: string, style: VisualStyle, assets: StudioAsset[]) {
  const source = latestAssetOfKind(assets, ["storyboard", "shotList", "videoTreatment"]);
  const scenes = parseStoryboardScenes(source?.content || "");
  const rows = scenes.length ? scenes : [{ title: "Scene 1", summary: "Opening image / hook", camera: "Wide establish", purpose: "Hook" }];
  return [
    `# Shot Continuity Board`,
    ``,
    `- Project: ${seed || "Untitled project"}`,
    `- Style lock: ${style}`,
    ``,
    `## Continuity Rules`,
    `- Keep character design, wardrobe, and prop lock from shot to shot`,
    `- Maintain palette consistency across every batch`,
    `- Track camera direction and screen direction between cuts`,
    ``,
    `## Scene Continuity`,
    ...rows.map((scene, idx) => `- ${idx + 1}. ${scene.title} — ${scene.camera} — ${scene.summary} — continuity check: preserve pose / prop / lighting intent`),
  ].join("\n");
}

function buildFinalAssemblyChecklist(seed: string, productionType: ProductionType, assets: StudioAsset[]) {
  const rollup = buildAssetRollup(assets);
  return [
    `# Final Assembly Checklist`,
    ``,
    `- Project: ${seed || "Untitled project"}`,
    `- Product lane: ${productionType}`,
    `- Writing assets: ${rollup.writing}`,
    `- Visual assets: ${rollup.visual}`,
    `- Production assets: ${rollup.production}`,
    ``,
    `## Assembly`,
    `- [ ] Scene batches exported`,
    `- [ ] Voiceover pack recorded / aligned`,
    `- [ ] Soundtrack cues placed`,
    `- [ ] Shot continuity verified`,
    `- [ ] Render handoff reviewed`,
    `- [ ] QC pass complete`,
    `- [ ] Final master exported`,
    `- [ ] Trailer / poster / release assets ready`,
  ].join("\n");
}

function buildFinalVideoHandoff(seed: string, productionType: ProductionType, visualStyle: VisualStyle, releaseTarget: ReleaseTarget, assets: StudioAsset[]) {
  const scenes = parseStoryboardScenes(latestAssetOfKind(assets, ["storyboard", "shotList"])?.content || "");
  return [
    `# Final Video Handoff`,
    ``,
    `- Project: ${seed || "Untitled project"}`,
    `- Product lane: ${productionType}`,
    `- Visual style: ${visualStyle}`,
    `- Release target: ${releaseTarget}`,
    `- Scene count: ${scenes.length}`,
    ``,
    `## Deliverables`,
    `- Master timeline package`,
    `- Scene batch prompts`,
    `- Voiceover + dialogue reference`,
    `- Soundtrack cue sheet`,
    `- Continuity board`,
    `- Poster / release assets`,
    ``,
    `## Watch-ready path`,
    `- Lock script + edit map`,
    `- Render scene batches in order`,
    `- Review continuity and pickups`,
    `- Final audio mix + subtitles`,
    `- Export screening master`,
    ``,
    `## Honest note`,
    `- OddEngine is generating the handoff pack and production docs here. It does not directly render a finished full-length movie inside the panel.`,
  ].join("\n");
}

function buildProducerOpsBoard(seed: string, productionType: ProductionType, releaseTarget: ReleaseTarget, assets: StudioAsset[]) {
  const rollup = buildAssetRollup(assets);
  const scenes = parseStoryboardScenes(latestAssetOfKind(assets, ["storyboard", "shotList"])?.content || "").length;
  const readiness = Math.min(100, Math.round(((rollup.writing * 2) + (rollup.visual * 2) + (rollup.production * 3)) / 21 * 100));
  return [
    `# Producer Ops Board`,
    ``,
    `- Project: ${seed || "Untitled project"}`,
    `- Product lane: ${productionType}`,
    `- Release target: ${releaseTarget}`,
    `- Readiness: ${readiness}%`,
    `- Writing assets: ${rollup.writing}`,
    `- Visual assets: ${rollup.visual}`,
    `- Production assets: ${rollup.production}`,
    `- Scene count: ${scenes}`,
    ``,
    `## Ops calls`,
    `- Highest leverage next move: ${rollup.visual < 2 ? "Expand storyboard + style prompts" : rollup.production < 2 ? "Build render/audio handoff docs" : "Prep launch and release assets"}`,
    `- Risk lane: ${scenes ? "Continuity + runtime polish" : "Scene planning incomplete"}`,
    `- Delivery lane: ${releaseTarget}`,
    ``,
    `## Producer checklist`,
    `- [ ] Lock cast / voice assumptions`,
    `- [ ] Approve style bible`,
    `- [ ] Approve timeline + runtime`,
    `- [ ] Approve soundtrack / VO plan`,
    `- [ ] Approve launch packet`,
  ].join("\n");
}


function buildShotImagePromptBatch(title: string, visualStyle: VisualStyle, assets: StudioAsset[], provider: string, format: string, resolution: string, fps: string) {
  const storyboard = latestAssetOfKind(assets, ["storyboard"]);
  const treatment = latestAssetOfKind(assets, ["videoTreatment", "renderHandoff"]);
  const promptSource = (storyboard?.content || treatment?.content || "").split("\n").filter(Boolean).slice(0, 10);
  const lines = promptSource.length ? promptSource : [
    `OPEN — establish mood, environment, and hero silhouette.`,
    `BUILD — add motion, texture, and key supporting visual beats.`,
    `TURN — reveal twist, push emotional or visual escalation.`,
    `PAYOFF — land the signature image and strongest dramatic beat.`,
  ];
  return [
    `# Shot / Image Prompt Batch`,
    ``,
    `Project: ${title || "Untitled Project"}`,
    `Render provider: ${provider}`,
    `Format: ${format}`,
    `Output: ${resolution} @ ${fps}`,
    `Visual style: ${visualStyle}`,
    ``,
    `## Batch export`,
    ...lines.map((line, idx) => `### Scene ${idx + 1}\n- Prompt seed: ${line}\n- Camera: cinematic motion / coverage variation\n- Deliverables: keyframe still, motion pass, alt safety shot\n- Notes: keep continuity with previous scene, maintain color story`),
    ``,
    `## Handoff note`,
    `Use this batch as the source pack for external image/video generation tools.`
  ].join("\n");
}

function buildVoiceMusicAssetExport(title: string, productionType: ProductionType, assets: StudioAsset[], provider: string) {
  const song = latestAssetOfKind(assets, ["song"]);
  const story = latestAssetOfKind(assets, ["story", "featureOutline"]);
  return [
    `# Voice / Music Asset Export`,
    ``,
    `Project: ${title || "Untitled Project"}`,
    `Production type: ${productionType}`,
    `Audio provider target: ${provider}`,
    ``,
    `## Voiceover pack`,
    `- Narration tone: cinematic, intimate, emotionally clear`,
    `- Dialogue pass: export by scene batch`,
    `- Safety pass: neutral delivery for trailer / recap use`,
    ``,
    `## Music pack`,
    `- Main theme: derived from project core and emotional arc`,
    `- Cue stems: intro, build, chorus/payoff, outro, sting`,
    `- Trailer version: 30s / 60s / 90s cuts`,
    ``,
    `## Source hooks`,
    song ? `Song source: ${song.title}` : `Song source: none saved yet`,
    story ? `Story source: ${story.title}` : `Story source: none saved yet`,
    ``,
    `## Delivery`,
    `- Export VO script by scene`,
    `- Export cue sheet by runtime lane`,
    `- Export stems and timing notes for final assembly`,
  ].join("\n");
}

function buildFinalAssemblyManifest(title: string, productionType: ProductionType, releaseTarget: ReleaseTarget, assets: StudioAsset[], provider: string, format: string, resolution: string, fps: string, baseUrl: string) {
  const counts = {
    writing: assets.filter(a => ["story","song","featureOutline","episodeGuide"].includes(a.kind)).length,
    visual: assets.filter(a => ["storyboard","videoTreatment","artPromptPack","cartoonBible","renderHandoff"].includes(a.kind)).length,
    production: assets.filter(a => ["productionPack","productionRunbook","castingPack","screeningPacket"].includes(a.kind)).length,
  };
  return [
    `# Final Assembly Manifest`,
    ``,
    `Project: ${title || "Untitled Project"}`,
    `Type: ${productionType}`,
    `Release target: ${releaseTarget}`,
    `Render provider: ${provider}`,
    `Output spec: ${format} / ${resolution} / ${fps}`,
    `Render bridge: ${baseUrl || "local / manual handoff"}`,
    ``,
    `## Asset coverage`,
    `- Writing assets: ${counts.writing}`,
    `- Visual assets: ${counts.visual}`,
    `- Production assets: ${counts.production}`,
    ``,
    `## Required packets`,
    `- [ ] Shot / image prompt batch`,
    `- [ ] Voice / music export`,
    `- [ ] Continuity board`,
    `- [ ] Final video handoff`,
    `- [ ] Producer ops board`,
    ``,
    `## Final outputs`,
    `- Master render`,
    `- Trailer cut`,
    `- Poster stills`,
    `- Thumbnail / promo stills`,
    `- Caption / subtitle / metadata set`,
  ].join("\n");
}

function buildExternalVideoToolHandoff(title: string, productionType: ProductionType, visualStyle: VisualStyle, releaseTarget: ReleaseTarget, provider: string, format: string, resolution: string, fps: string, baseUrl: string) {
  return [
    `# External Video Tool Handoff`,
    ``,
    `Project: ${title || "Untitled Project"}`,
    `Type: ${productionType}`,
    `Style: ${visualStyle}`,
    `Release target: ${releaseTarget}`,
    `Provider: ${provider}`,
    `Output: ${format} / ${resolution} / ${fps}`,
    `Bridge URL: ${baseUrl || "manual export package"}`,
    ``,
    `## Tool handoff checklist`,
    `- Import shot batch prompts`,
    `- Import voice/music assets`,
    `- Apply style profile`,
    `- Assemble timeline using continuity board`,
    `- Render proof cut`,
    `- Render final master and trailer cut`,
    ``,
    `## Notes`,
    `This package is designed to bridge OddEngine Writers assets into external video / animation tools for actual rendering.`
  ].join("\n");
}

function buildGreenlightScore(args: { assets: StudioAsset[]; productionType: ProductionType; budgetBand: BudgetBand; scopeLevel: ScopeLevel; releaseTarget: ReleaseTarget; writerMode: WriterMode; }) {
  const assets = args.assets || [];
  const hasWriting = assets.some(a => ["story","song","featureOutline","episodeGuide"].includes(a.kind));
  const hasVisual = assets.some(a => ["storyboard","videoTreatment","artPromptPack","cartoonBible"].includes(a.kind));
  const hasProduction = assets.some(a => ["productionPack","productionRunbook","animationPlan","castingPack"].includes(a.kind));
  let score = 35;
  if (hasWriting) score += 18;
  if (hasVisual) score += 18;
  if (hasProduction) score += 18;
  if (args.releaseTarget !== "Indie Launch") score += 4;
  if (args.budgetBand === "$$" || args.budgetBand === "$$$") score += 3;
  if (args.scopeLevel === "Balanced") score += 4;
  if (args.scopeLevel === "Lean") score += 2;
  if (args.productionType === "Movie" || args.productionType === "Series") score -= 3;
  if (args.scopeLevel === "Epic") score -= 5;
  score = Math.max(22, Math.min(98, score));
  const readiness = score >= 85 ? "GREENLIGHT" : score >= 70 ? "NEAR GREENLIGHT" : score >= 55 ? "DEVELOPMENT" : "EARLY STAGE";
  const nextGate = !hasWriting ? "Lock core draft / outline" : !hasVisual ? "Build storyboard + art prompts" : !hasProduction ? "Assemble runbook + packet" : "Prepare launch packet";
  const strongestLane = hasProduction ? "Production" : hasVisual ? "Visual" : hasWriting ? "Writing" : "Concept";
  return { score, readiness, nextGate, strongestLane, hasWriting, hasVisual, hasProduction };
}

export default function Books({ onNavigate }: { onNavigate: (panelId: string) => void }) {
  const [books, setBooks] = useState<Book[]>(() => loadJSON<Book[]>(KEY, []));
  const [activeId, setActiveId] = useState<string>(() => loadJSON<string>(KEY_ACTIVE, ""));
  const [activeChapterIdx, setActiveChapterIdx] = useState<number>(() => {
    const n = Number(loadJSON<any>(KEY_ACTIVE_CH, 0));
    return Number.isFinite(n) ? n : 0;
  });

  const active = useMemo(() => books.find((b) => b.id === activeId) || books[0], [books, activeId]);
  const chapters = active?.chapters || [];
  const safeChapterIdx = Math.max(0, Math.min(chapters.length - 1, activeChapterIdx));
  const chapter = chapters[safeChapterIdx];

  useEffect(() => {
    saveJSON(KEY_ACTIVE_CH, safeChapterIdx);
  }, [safeChapterIdx]);

  const persist = (next: Book[]) => {
    setBooks(next);
    saveJSON(KEY, next);
  };

  const upsert = (b: Book) => {
    const next = books.some((x) => x.id === b.id) ? books.map((x) => (x.id === b.id ? b : x)) : [b, ...books];
    persist(next);
  };

  const remove = (id: string) => {
    const next = books.filter((b) => b.id !== id);
    persist(next);
    if (activeId === id) {
      const nid = next[0]?.id || "";
      setActiveId(nid);
      saveJSON(KEY_ACTIVE, nid);
      setActiveChapterIdx(0);
    }
  };

  const ensureChapter = () => {
    if (!active) return;
    if (!active.chapters.length) {
      const next = { ...active, chapters: [{ title: "Chapter 1", notes: "", draft: "" }], updatedAt: Date.now() };
      upsert(next);
      setActiveChapterIdx(0);
    }
  };

  // Writers assistant (embedded)
  const [chat, setChat] = useState<WriterMsg[]>(() => loadJSON<WriterMsg[]>(KEY_CHAT, []));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [writerMode, setWriterMode] = useState<WriterMode>(() => loadJSON<WriterMode>(KEY_WRITER_MODE, "story"));
  const [studioPrompt, setStudioPrompt] = useState<string>(() => loadJSON<string>(KEY_STUDIO_PROMPT, ""));
  const [studioAssets, setStudioAssets] = useState<StudioAsset[]>(() => loadJSON<StudioAsset[]>(KEY_STUDIO_ASSETS, []));
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(() => loadJSON<VisualStyle>(KEY_VISUAL_STYLE, "neo-noir anime"));
  const [productionType, setProductionType] = useState<ProductionType>(() => loadJSON<ProductionType>(KEY_PRODUCTION_TYPE, "Story"));
  const [releaseTarget, setReleaseTarget] = useState<ReleaseTarget>(() => loadJSON<ReleaseTarget>(KEY_RELEASE_TARGET, "Pitch / Publishing"));
  const [budgetBand, setBudgetBand] = useState<BudgetBand>(() => loadJSON<BudgetBand>(KEY_BUDGET_BAND, "$$"));
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>(() => loadJSON<ScopeLevel>(KEY_SCOPE_LEVEL, "Balanced"));
  const [renderProvider, setRenderProvider] = useState<string>(() => loadJSON<string>(KEY_RENDER_PROVIDER, "Runway / external"));
  const [renderFormat, setRenderFormat] = useState<string>(() => loadJSON<string>(KEY_RENDER_FORMAT, "mp4"));
  const [renderFps, setRenderFps] = useState<string>(() => loadJSON<string>(KEY_RENDER_FPS, "24 fps"));
  const [renderResolution, setRenderResolution] = useState<string>(() => loadJSON<string>(KEY_RENDER_RESOLUTION, "1080p"));
  const [renderBaseUrl, setRenderBaseUrl] = useState<string>(() => loadJSON<string>(KEY_RENDER_BASE, "http://127.0.0.1:3000/render"));
  const [renderJobMode, setRenderJobMode] = useState<string>(() => loadJSON<string>(KEY_RENDER_JOB_MODE, "Internal job builder"));
  const [renderPreviewUrl, setRenderPreviewUrl] = useState<string>(() => loadJSON<string>(KEY_RENDER_PREVIEW, ""));
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const systemPrompt = useMemo(() => {
    const title = active?.title || "Untitled";
    const status = active?.status || "Idea";
    const logline = active?.logline || "";
    const chTitle = chapter?.title || "";
    return (
      "You are Homie — a high-energy creative copilot for stories, songs, cartoon concepts, and music video treatments. " +
      "Help the user create complete work, not just fragments. Be imaginative, but organized and production-minded. " +
      "Prefer concrete options, strong hooks, scene plans, visual beats, and next-step checklists. " +
      "Avoid long lectures. Ask 1 question only if truly necessary.\n\n" +
      `Current mode: ${writerMode}\nCurrent book: ${title}\nStatus: ${status}\nLogline: ${logline}\nCurrent chapter: ${chTitle}`
    );
  }, [active?.title, active?.status, active?.logline, chapter?.title, writerMode]);

  useEffect(() => {
    saveJSON(KEY_WRITER_MODE, writerMode);
  }, [writerMode]);

  useEffect(() => {
    saveJSON(KEY_STUDIO_PROMPT, studioPrompt);
  }, [studioPrompt]);

  useEffect(() => {
    saveJSON(KEY_STUDIO_ASSETS, studioAssets);
  }, [studioAssets]);

  useEffect(() => {
    saveJSON(KEY_VISUAL_STYLE, visualStyle);
  }, [visualStyle]);

  useEffect(() => { saveJSON(KEY_PRODUCTION_TYPE, productionType); }, [productionType]);
  useEffect(() => { saveJSON(KEY_RELEASE_TARGET, releaseTarget); }, [releaseTarget]);
  useEffect(() => { saveJSON(KEY_BUDGET_BAND, budgetBand); }, [budgetBand]);
  useEffect(() => { saveJSON(KEY_SCOPE_LEVEL, scopeLevel); }, [scopeLevel]);
  useEffect(() => { saveJSON(KEY_RENDER_PROVIDER, renderProvider); }, [renderProvider]);
  useEffect(() => { saveJSON(KEY_RENDER_FORMAT, renderFormat); }, [renderFormat]);
  useEffect(() => { saveJSON(KEY_RENDER_FPS, renderFps); }, [renderFps]);
  useEffect(() => { saveJSON(KEY_RENDER_RESOLUTION, renderResolution); }, [renderResolution]);
  useEffect(() => { saveJSON(KEY_RENDER_BASE, renderBaseUrl); }, [renderBaseUrl]);
  useEffect(() => { saveJSON(KEY_RENDER_JOB_MODE, renderJobMode); }, [renderJobMode]);
  useEffect(() => { saveJSON(KEY_RENDER_PREVIEW, renderPreviewUrl); }, [renderPreviewUrl]);

  useEffect(() => {
    saveJSON(KEY_CHAT, chat);
    // auto-scroll
    try {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } catch {
      // ignore
    }
  }, [chat]);

  const modePresets: Record<WriterMode, { label: string; prompts: { label: string; text: string }[]; focus: string }> = {
    story: {
      label: "Story Forge",
      focus: "Whole stories, chapter arcs, scene beats, and rewrites.",
      prompts: [
        { label: "Whole story", text: "Write a complete short story from my current concept. Give it a strong hook, emotional middle, and satisfying ending." },
        { label: "Scene ladder", text: "Create a full scene-by-scene ladder for this story with escalating stakes and a strong ending." },
        { label: "Character pack", text: "Build the main cast with motives, flaws, visual cues, and how each one changes the story." },
        { label: "Rewrite stronger", text: "Rewrite this concept with sharper emotion, cleaner pacing, and more memorable lines. Give 3 versions." },
      ],
    },
    song: {
      label: "Song Forge",
      focus: "Hooks, verses, choruses, bridges, and emotional tone.",
      prompts: [
        { label: "Full song", text: "Write a complete song from this prompt with verse, chorus, verse, bridge, and final chorus. Make it memorable and performance-ready." },
        { label: "3 hook options", text: "Give me 3 killer chorus/hook options for this song idea with different emotional flavors." },
        { label: "Dark rewrite", text: "Rewrite this song concept darker, more cinematic, and more emotionally devastating." },
        { label: "Band notes", text: "Turn this into a band-ready writing sheet with tempo vibe, dynamics, and arrangement notes." },
      ],
    },
    cartoon: {
      label: "Cartoon Lab",
      focus: "Animated worlds, characters, art direction, and storyboard beats.",
      prompts: [
        { label: "Cartoon concept", text: "Turn this idea into an animated cartoon concept with characters, world rules, tone, and episode/movie summary." },
        { label: "Storyboard", text: "Create a 10-shot storyboard beat list for an animated short based on this idea." },
        { label: "Character sheet", text: "Design the lead character with look, personality, motion style, and signature expressions." },
        { label: "Visual mood board", text: "Describe the visual mood board, palette, camera energy, and animation style for this cartoon." },
      ],
    },
    video: {
      label: "Video Director",
      focus: "Music video treatments, shot lists, motion language, and edit rhythm.",
      prompts: [
        { label: "Music video treatment", text: "Create a full animated music video treatment from this song/story prompt with concept, scenes, style, and ending image." },
        { label: "Shot list", text: "Build a shot-by-shot list for the video with camera motion, action, and transitions." },
        { label: "Edit rhythm", text: "Map the visual pacing to the song sections so the edit has momentum and payoff." },
        { label: "Production pack", text: "Turn this into a small production pack: concept, assets needed, style notes, and animation plan." },
      ],
    },
    movie: {
      label: "Movie Forge",
      focus: "Feature outlines, short-film structure, visual set-pieces, and full production handoff.",
      prompts: [
        { label: "Feature outline", text: "Turn this idea into a feature or short-film outline with acts, set pieces, emotional turns, and a final payoff." },
        { label: "Movie bible", text: "Build the cinematic world, characters, tone, and visual rules for this movie concept." },
        { label: "Casting + voices", text: "Create a casting and voice direction pack for the main characters and narrator if needed." },
        { label: "Full runbook", text: "Turn this project into a full production runbook with script path, scene ladder, assets, and delivery plan." },
      ],
    },
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    const nextChat: WriterMsg[] = [...chat, { role: "user", content: t, ts: Date.now() }];
    setChat(nextChat);
    setInput("");
    setBusy(true);

    try {
      const api = oddApi();
      // Desktop: local Ollama through preload. Web: show a helpful fallback.
      if (!isDesktop() || !api.homieChat) {
        const msg = "(Writer assistant is local-only right now. Open the Homie panel or run Desktop mode for in-panel replies.)";
        setChat((c) => [...c, { role: "assistant", content: msg, ts: Date.now() }]);
        return;
      }

      const payloadMsgs = nextChat.slice(-10).map((m) => ({ role: m.role, content: m.content })) as any;
      const res = await api.homieChat({ messages: [{ role: "system", content: systemPrompt }, ...payloadMsgs] });
      if (!res?.ok) {
        setChat((c) => [...c, { role: "assistant", content: res?.error ? `Error: ${res.error}` : "Writer assistant failed.", ts: Date.now() }]);
        return;
      }
      setChat((c) => [...c, { role: "assistant", content: String(res.reply || ""), ts: Date.now() }]);
    } catch (e: any) {
      setChat((c) => [...c, { role: "assistant", content: e?.message || String(e), ts: Date.now() }]);
    } finally {
      setBusy(false);
    }
  };

  const insertLastAssistantIntoDraft = () => {
    if (!active || !chapter) return;
    const last = [...chat].reverse().find((m) => m.role === "assistant");
    if (!last?.content) return;
    const chapters2 = chapters.map((c, i) => (i === safeChapterIdx ? { ...c, draft: (c.draft || "") + (c.draft ? "\n\n" : "") + last.content } : c));
    upsert({ ...active, chapters: chapters2, updatedAt: Date.now() });
  };


  const saveLastAssistantAs = (kind: StudioAssetKind) => {
    const last = [...chat].reverse().find((m) => m.role === "assistant" && String(m.content || "").trim());
    if (!last?.content) return;
    const item: StudioAsset = {
      id: uid(),
      kind,
      title: `${studioAssetTitle(kind)} • ${extractTitleFromReply(last.content)}`,
      content: String(last.content || ""),
      ts: Date.now(),
    };
    setStudioAssets((prev) => [item, ...prev].slice(0, 20));
    try {
      window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "ok", text: `Saved ${studioAssetTitle(kind)}.` } }));
    } catch {}
  };

  const sendStudioKind = async (kind: StudioAssetKind) => {
    const prompt = buildStudioPrompt({
      kind,
      mode: writerMode,
      seed: studioPrompt,
      title: active?.title || "Untitled",
      logline: active?.logline || "",
      chapterTitle: chapter?.title || "",
      chapterDraft: chapter?.draft || "",
    });
    await send(prompt);
  };

  const insertAssetIntoDraft = (asset: StudioAsset) => {
    if (!active || !chapter) return;
    const chapters2 = chapters.map((c, i) => (
      i === safeChapterIdx ? { ...c, draft: (c.draft || "") + ((c.draft || "") ? "\n\n" : "") + asset.content } : c
    ));
    upsert({ ...active, chapters: chapters2, updatedAt: Date.now() });
  };

  const copyAsset = async (asset: StudioAsset) => {
    try {
      await navigator.clipboard?.writeText(asset.content);
      window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "ok", text: `Copied ${asset.title}.` } }));
    } catch {}
  };

  const copyActiveChapter = async () => {
    if (!chapter) return;
    const md = `# ${active?.title || "Untitled"}\n\n## ${chapter.title}\n\n${chapter.draft || ""}\n`;
    try {
      await navigator.clipboard?.writeText(md);
      window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "ok", text: "Copied chapter markdown." } }));
    } catch {
      // ignore
    }
  };

  // UI state
  const [tab, setTab] = useState<"desk" | "chapters" | "export">("desk");

  const draftText = chapter?.draft || "";
  const wc = wordCount(draftText);
  const minutes = estimateMinutes(wc);
  const latestStoryboardAsset = useMemo(() => latestAssetOfKind(studioAssets, ["storyboard", "shotList"]), [studioAssets]);
  const assetRollup = useMemo(() => buildAssetRollup(studioAssets), [studioAssets]);
  const storyboardScenes = useMemo(() => parseStoryboardScenes(latestStoryboardAsset?.content || ""), [latestStoryboardAsset]);
  const latestTreatmentAsset = useMemo(() => latestAssetOfKind(studioAssets, ["videoTreatment", "productionPack"]), [studioAssets]);
  const productionPlanner = useMemo(() => buildProductionPlan(studioPrompt, latestTreatmentAsset, latestStoryboardAsset), [studioPrompt, latestTreatmentAsset, latestStoryboardAsset]);
  const directorTimeline = useMemo(() => buildDirectorTimeline(studioAssets), [studioAssets]);
  const castingBoard = useMemo(() => buildCastingBoard(studioAssets, studioPrompt), [studioAssets, studioPrompt]);
  const beatMap = useMemo(() => buildBeatMap(studioAssets, studioPrompt), [studioAssets, studioPrompt]);
  const fullProjectPacket = useMemo(() => buildFullProjectPacket(studioPrompt, writerMode, visualStyle, studioAssets), [studioPrompt, writerMode, visualStyle, studioAssets]);
  const storyboardSheet = useMemo(() => buildStoryboardSheet(storyboardScenes, studioPrompt, visualStyle), [storyboardScenes, studioPrompt, visualStyle]);
  const artPromptSheet = useMemo(() => {
    const latestArt = latestAssetOfKind(studioAssets, ["artPromptPack"]);
    return latestArt?.content || `# Art Prompt Pack Sheet

Generate an art prompt pack from a saved asset to populate this export.`;
  }, [studioAssets]);
  const musicVideoPlanSheet = useMemo(() => buildMusicVideoPlanSheet(beatMap, studioPrompt, visualStyle), [beatMap, studioPrompt, visualStyle]);
  const greenlightModel = useMemo(() => buildGreenlightScore({ assets: studioAssets, productionType, budgetBand, scopeLevel, releaseTarget, writerMode }), [studioAssets, productionType, budgetBand, scopeLevel, releaseTarget, writerMode]);
  const pitchDeck = useMemo(() => buildPitchDeck(studioPrompt, writerMode, visualStyle, productionType, releaseTarget, budgetBand, scopeLevel, studioAssets), [studioPrompt, writerMode, visualStyle, productionType, releaseTarget, budgetBand, scopeLevel, studioAssets]);
  const oneSheet = useMemo(() => buildOneSheet(studioPrompt, productionType, visualStyle, releaseTarget), [studioPrompt, productionType, visualStyle, releaseTarget]);
  const trailerBrief = useMemo(() => buildTrailerBrief(studioPrompt, writerMode, productionType, visualStyle), [studioPrompt, writerMode, productionType, visualStyle]);
  const releasePlan = useMemo(() => buildReleasePlan(studioPrompt, productionType, releaseTarget, budgetBand, scopeLevel, studioAssets), [studioPrompt, productionType, releaseTarget, budgetBand, scopeLevel, studioAssets]);
  const marketingHooks = useMemo(() => buildMarketingHooks(studioPrompt, productionType, visualStyle), [studioPrompt, productionType, visualStyle]);
  const posterVariants = useMemo(() => buildPosterVariants(studioPrompt, productionType, visualStyle), [studioPrompt, productionType, visualStyle]);
  const trailerCuts = useMemo(() => buildTrailerCuts(studioPrompt, productionType, visualStyle), [studioPrompt, productionType, visualStyle]);
  const platformPitch = useMemo(() => buildPlatformPitch(studioPrompt, productionType, releaseTarget, visualStyle), [studioPrompt, productionType, releaseTarget, visualStyle]);
  const monetizationLane = useMemo(() => buildMonetizationLane(studioPrompt, productionType, releaseTarget), [studioPrompt, productionType, releaseTarget]);
  const finishedProduct = useMemo(() => buildFinishedProduct(studioPrompt, productionType, releaseTarget, visualStyle, studioAssets), [studioPrompt, productionType, releaseTarget, visualStyle, studioAssets]);
  const cinemaMasterPlan = useMemo(() => buildCinemaMasterPlan(studioPrompt, productionType, visualStyle, releaseTarget, studioAssets), [studioPrompt, productionType, visualStyle, releaseTarget, studioAssets]);
  const renderHandoffPack = useMemo(() => buildRenderHandoff(studioPrompt, productionType, visualStyle, studioAssets), [studioPrompt, productionType, visualStyle, studioAssets]);
  const sceneBatchExporter = useMemo(() => buildSceneBatchExporter(studioPrompt, visualStyle, studioAssets), [studioPrompt, visualStyle, studioAssets]);
  const voiceoverPack = useMemo(() => buildVoiceoverPack(studioPrompt, productionType, studioAssets), [studioPrompt, productionType, studioAssets]);
  const soundtrackCueSheet = useMemo(() => buildSoundtrackCueSheet(studioPrompt, visualStyle, beatMap, productionType), [studioPrompt, visualStyle, beatMap, productionType]);
  const shotContinuityBoard = useMemo(() => buildShotContinuityBoard(studioPrompt, visualStyle, studioAssets), [studioPrompt, visualStyle, studioAssets]);
  const finalAssemblyChecklist = useMemo(() => buildFinalAssemblyChecklist(studioPrompt, productionType, studioAssets), [studioPrompt, productionType, studioAssets]);
  const finalVideoHandoff = useMemo(() => buildFinalVideoHandoff(studioPrompt, productionType, visualStyle, releaseTarget, studioAssets), [studioPrompt, productionType, visualStyle, releaseTarget, studioAssets]);
  const producerOpsBoard = useMemo(() => buildProducerOpsBoard(studioPrompt, productionType, releaseTarget, studioAssets), [studioPrompt, productionType, releaseTarget, studioAssets]);
  const shotImagePromptBatch = useMemo(() => buildShotImagePromptBatch(active?.title || studioPrompt, visualStyle, studioAssets, renderProvider, renderFormat, renderResolution, renderFps), [active?.title, studioPrompt, visualStyle, studioAssets, renderProvider, renderFormat, renderResolution, renderFps]);
  const voiceMusicAssetExport = useMemo(() => buildVoiceMusicAssetExport(active?.title || studioPrompt, productionType, studioAssets, renderProvider), [active?.title, studioPrompt, productionType, studioAssets, renderProvider]);
  const finalAssemblyManifest = useMemo(() => buildFinalAssemblyManifest(active?.title || studioPrompt, productionType, releaseTarget, studioAssets, renderProvider, renderFormat, renderResolution, renderFps, renderBaseUrl), [active?.title, studioPrompt, productionType, releaseTarget, studioAssets, renderProvider, renderFormat, renderResolution, renderFps, renderBaseUrl]);
  const externalVideoToolHandoff = useMemo(() => buildExternalVideoToolHandoff(active?.title || studioPrompt, productionType, visualStyle, releaseTarget, renderProvider, renderFormat, renderResolution, renderFps, renderBaseUrl), [active?.title, studioPrompt, productionType, visualStyle, releaseTarget, renderProvider, renderFormat, renderResolution, renderFps, renderBaseUrl]);
  const internalRenderJobJson = useMemo(() => buildInternalRenderJobJson(active?.title || studioPrompt, productionType, visualStyle, renderProvider, renderFormat, renderResolution, renderFps, renderBaseUrl, studioAssets), [active?.title, studioPrompt, productionType, visualStyle, renderProvider, renderFormat, renderResolution, renderFps, renderBaseUrl, studioAssets]);
  const sceneRenderQueue = useMemo(() => buildSceneRenderQueue(active?.title || studioPrompt, visualStyle, studioAssets), [active?.title, studioPrompt, visualStyle, studioAssets]);
  const watchDeckManifest = useMemo(() => buildWatchDeckManifest(active?.title || studioPrompt, productionType, releaseTarget, renderProvider, renderFormat, renderResolution, renderFps), [active?.title, studioPrompt, productionType, releaseTarget, renderProvider, renderFormat, renderResolution, renderFps]);
  const producerDashboard = useMemo(() => ({
    project: active?.title || "Untitled",
    completion: Math.min(100, Math.round(((assetRollup.writing * 2) + (assetRollup.visual * 2) + (assetRollup.production * 3)) / 21 * 100)),
    nextGate: !assetRollup.writing ? "Lock script / song core" : !assetRollup.visual ? "Build storyboard + visual treatment" : !assetRollup.production ? "Assemble production handoff" : "Ready to export packet",
    strongestLane: assetRollup.production >= assetRollup.visual && assetRollup.production >= assetRollup.writing ? "Production" : assetRollup.visual >= assetRollup.writing ? "Visual" : "Writing",
    riskFlag: !storyboardScenes.length ? "Need storyboard scenes" : !latestAssetOfKind(studioAssets, ["artPromptPack"]) ? "Generate art prompt pack" : "Pipeline healthy",
  }), [active?.title, assetRollup, storyboardScenes, studioAssets]);
  const exportChecklist = async () => {
    const text = buildChecklistFromAssets(studioAssets);
    try {
      await navigator.clipboard?.writeText(text);
      window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "ok", text: "Copied asset checklist." } }));
    } catch {}
  };
  const exportProductionPlanner = async () => {
    try {
      await navigator.clipboard?.writeText(productionPlanner);
      window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "ok", text: "Copied production planner." } }));
    } catch {}
  };
  const handoffImagePromptPack = async () => {
    const source = latestTreatmentAsset || latestStoryboardAsset;
    if (!source) return;
    const pack = buildArtPromptPack(source, studioPrompt, writerMode);
    setChat((c) => [...c, { role: "assistant", content: pack, ts: Date.now() }]);
    setStudioAssets((prev) => [{ id: uid(), kind: "artPromptPack", title: `Art Prompt Pack • ${source.title}`, content: pack, ts: Date.now() }, ...prev].slice(0, 24));
  };
  const generateArtPromptPackForAsset = (asset: StudioAsset) => {
    const pack = buildArtPromptPack(asset, studioPrompt, writerMode);
    setChat((c) => [...c, { role: "assistant", content: pack, ts: Date.now() }]);
    setStudioAssets((prev) => [{ id: uid(), kind: "artPromptPack", title: `Art Prompt Pack • ${asset.title}`, content: pack, ts: Date.now() }, ...prev].slice(0, 24));
  };
  const buildProductionRunbook = () => {
    const pack = buildRunbook(studioPrompt, studioAssets, writerMode);
    setChat((c) => [...c, { role: "assistant", content: pack, ts: Date.now() }]);
    setStudioAssets((prev) => [{ id: uid(), kind: "productionRunbook", title: `Production Runbook • ${active?.title || "Untitled"}`, content: pack, ts: Date.now() }, ...prev].slice(0, 24));
  };
  const saveComputedAsset = (kind: StudioAssetKind, title: string, content: string) => {
    setStudioAssets((prev) => [{ id: uid(), kind, title, content, ts: Date.now() }, ...prev].slice(0, 28));
    setChat((c) => [...c, { role: "assistant", content, ts: Date.now() }]);
  };
  const savePitchDeck = () => saveComputedAsset("pitchDeck", `Pitch Deck • ${active?.title || studioPrompt || "Untitled"}`, pitchDeck);
  const saveOneSheet = () => saveComputedAsset("oneSheet", `One Sheet • ${active?.title || studioPrompt || "Untitled"}`, oneSheet);
  const saveTrailerBrief = () => saveComputedAsset("trailerBrief", `Trailer Brief • ${active?.title || studioPrompt || "Untitled"}`, trailerBrief);
  const exportFullProjectPacket = async () => {
    try {
      await navigator.clipboard?.writeText(fullProjectPacket);
      window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "ok", text: "Copied full project packet." } }));
    } catch {}
    setChat((c) => [...c, { role: "assistant", content: fullProjectPacket, ts: Date.now() }]);
  };
  const downloadProjectPacket = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-project-packet.md`, fullProjectPacket);
  const downloadStoryboardSheet = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-storyboard-scene-sheet.md`, storyboardSheet);
  const downloadArtPromptSheet = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-art-prompt-pack.md`, artPromptSheet);
  const downloadMusicVideoPlanSheet = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-music-video-plan-sheet.md`, musicVideoPlanSheet);
  const downloadPitchDeck = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-pitch-deck.md`, pitchDeck);
  const downloadOneSheet = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-one-sheet.md`, oneSheet);
  const downloadTrailerBrief = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-trailer-brief.md`, trailerBrief);
  const downloadReleasePlan = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-release-plan.md`, releasePlan);
  const downloadMarketingHooks = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-marketing-hooks.md`, marketingHooks);
  const downloadPosterVariants = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-poster-tagline-title-variants.md`, posterVariants);
  const downloadTrailerCuts = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-trailer-cut-variants.md`, trailerCuts);
  const downloadPlatformPitch = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-platform-pitch.md`, platformPitch);
  const downloadMonetizationLane = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-monetization-lane.md`, monetizationLane);
  const downloadFinishedProduct = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-finished-product.md`, finishedProduct);
  const downloadCinemaMasterPlan = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-cinema-master-plan.md`, cinemaMasterPlan);
  const downloadRenderHandoffPack = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-render-handoff-pack.md`, renderHandoffPack);
  const downloadSceneBatchExporter = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-scene-batch-exporter.md`, sceneBatchExporter);
  const downloadVoiceoverPack = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-voiceover-pack.md`, voiceoverPack);
  const downloadSoundtrackCueSheet = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-soundtrack-cue-sheet.md`, soundtrackCueSheet);
  const downloadShotContinuityBoard = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-shot-continuity-board.md`, shotContinuityBoard);
  const downloadFinalAssemblyChecklist = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-final-assembly-checklist.md`, finalAssemblyChecklist);
  const downloadFinalVideoHandoff = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-final-video-handoff.md`, finalVideoHandoff);
  const downloadProducerOpsBoard = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-producer-ops-board.md`, producerOpsBoard);
  const downloadShotImagePromptBatch = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-shot-image-prompt-batch.md`, shotImagePromptBatch);
  const downloadVoiceMusicAssetExport = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-voice-music-asset-export.md`, voiceMusicAssetExport);
  const downloadFinalAssemblyManifest = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-final-assembly-manifest.md`, finalAssemblyManifest);
  const downloadExternalVideoToolHandoff = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-external-video-tool-handoff.md`, externalVideoToolHandoff);
  const saveReleasePlan = () => saveComputedAsset("productionRunbook", `Release Plan • ${active?.title || studioPrompt || "Untitled"}`, releasePlan);
  const saveMarketingHooks = () => saveComputedAsset("productionPack", `Marketing Hooks • ${active?.title || studioPrompt || "Untitled"}`, marketingHooks);
  const savePlatformPitch = () => saveComputedAsset("pitchDeck", `Platform Pitch • ${active?.title || studioPrompt || "Untitled"}`, platformPitch);
  const saveFinishedProduct = () => saveComputedAsset("productionPack", `Finished Product • ${active?.title || studioPrompt || "Untitled"}`, finishedProduct);
  const saveCinemaMasterPlan = () => saveComputedAsset("screeningPacket", `Cinema Master Plan • ${active?.title || studioPrompt || "Untitled"}`, cinemaMasterPlan);
  const saveRenderHandoffPack = () => saveComputedAsset("renderHandoff", `Render Handoff • ${active?.title || studioPrompt || "Untitled"}`, renderHandoffPack);
  const saveSceneBatchExporter = () => saveComputedAsset("renderHandoff", `Scene Batch Exporter • ${active?.title || studioPrompt || "Untitled"}`, sceneBatchExporter);
  const saveVoiceoverPack = () => saveComputedAsset("productionPack", `Voiceover Pack • ${active?.title || studioPrompt || "Untitled"}`, voiceoverPack);
  const saveSoundtrackCueSheet = () => saveComputedAsset("productionPack", `Soundtrack Cue Sheet • ${active?.title || studioPrompt || "Untitled"}`, soundtrackCueSheet);
  const saveShotContinuityBoard = () => saveComputedAsset("renderHandoff", `Shot Continuity Board • ${active?.title || studioPrompt || "Untitled"}`, shotContinuityBoard);
  const saveFinalAssemblyChecklist = () => saveComputedAsset("productionRunbook", `Final Assembly Checklist • ${active?.title || studioPrompt || "Untitled"}`, finalAssemblyChecklist);
  const saveFinalVideoHandoff = () => saveComputedAsset("screeningPacket", `Final Video Handoff • ${active?.title || studioPrompt || "Untitled"}`, finalVideoHandoff);
  const saveProducerOpsBoard = () => saveComputedAsset("productionRunbook", `Producer Ops Board • ${active?.title || studioPrompt || "Untitled"}`, producerOpsBoard);
  const saveShotImagePromptBatch = () => saveComputedAsset("renderHandoff", `Shot / Image Prompt Batch • ${active?.title || studioPrompt || "Untitled"}`, shotImagePromptBatch);
  const saveVoiceMusicAssetExport = () => saveComputedAsset("productionPack", `Voice / Music Asset Export • ${active?.title || studioPrompt || "Untitled"}`, voiceMusicAssetExport);
  const saveFinalAssemblyManifest = () => saveComputedAsset("screeningPacket", `Final Assembly Manifest • ${active?.title || studioPrompt || "Untitled"}`, finalAssemblyManifest);
  const saveExternalVideoToolHandoff = () => saveComputedAsset("renderHandoff", `External Video Tool Handoff • ${active?.title || studioPrompt || "Untitled"}`, externalVideoToolHandoff);
  const downloadInternalRenderJobJson = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-internal-render-job.json`, internalRenderJobJson);
  const downloadSceneRenderQueue = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-scene-render-queue.md`, sceneRenderQueue);
  const downloadWatchDeckManifest = () => downloadTextFile(`${slugifyName(active?.title || studioPrompt)}-watch-deck-manifest.md`, watchDeckManifest);
  const saveInternalRenderJobJson = () => saveComputedAsset("renderJob", `Internal Render Job • ${active?.title || studioPrompt || "Untitled"}`, internalRenderJobJson);
  const saveSceneRenderQueue = () => saveComputedAsset("renderJob", `Scene Render Queue • ${active?.title || studioPrompt || "Untitled"}`, sceneRenderQueue);
  const saveWatchDeckManifest = () => saveComputedAsset("renderJob", `Watch Deck Manifest • ${active?.title || studioPrompt || "Untitled"}`, watchDeckManifest);

  return (
    <div className="panelRoot writersStudioRoot">
      <PanelHeader
        title="✍️ Writers Lounge"
        subtitle="Your Books Vault + an embedded AI writing assistant. Local-first, ship-focused."
        panelId="Books"
        storagePrefix="oddengine:books"
        showCopilot
      />

      <div className="creativeHeroBand booksHeroBand">
        <div className="creativeHeroCard">
          <div className="small shellEyebrow">WORLD / WRITERS</div>
          <div className="creativeHeroTitle">Writers Lounge</div>
          <div className="creativeHeroSub">Shape books, chapters, and publishing moves from one creator-first writing desk.</div>
        </div>
        <div className="creativeMetricStrip">
          <div className="creativeMetricCard"><div className="small shellEyebrow">BOOKS</div><div className="h">{books.length}</div></div>
          <div className="creativeMetricCard"><div className="small shellEyebrow">ACTIVE STATUS</div><div className="h">{active?.status || "Idea"}</div></div>
          <div className="creativeMetricCard"><div className="small shellEyebrow">CHAPTERS</div><div className="h">{chapters.length}</div></div>
          <div className="creativeMetricCard"><div className="small shellEyebrow">CURRENT WORDS</div><div className="h">{wc}</div></div>
        </div>
      </div>

      <div className="writersGrid">
        {/* Left: Library */}
        <div className="writersLeft">
          <CardFrame title="Library" subtitle="Your writing stack" storageKey="writers:library" className="softCard" defaultFloating={false}>
            <div className="cluster wrap spread">
              <button
                className="tabBtn"
                onClick={() => {
                  const b: Book = { id: uid(), title: "Untitled Book", status: "Idea", chapters: [], updatedAt: Date.now() };
                  upsert(b);
                  setActiveId(b.id);
                  saveJSON(KEY_ACTIVE, b.id);
                  setActiveChapterIdx(0);
                }}
              >
                Add book
              </button>
              <div className="small">{books.length} total</div>
            </div>

            <div className="grid">
              {books.length === 0 ? (
                <div className="small">No books yet. Hit <b>Add book</b> and we’ll start building your vault.</div>
              ) : (
                books.map((b) => (
                  <div key={b.id} className="cluster spread">
                    <button
                      className={`tabBtn ${active?.id === b.id ? "active" : ""}`}
                      style={{ flex: 1, textAlign: "left" }}
                      onClick={() => {
                        setActiveId(b.id);
                        saveJSON(KEY_ACTIVE, b.id);
                        setActiveChapterIdx(0);
                      }}
                    >
                      <b>{b.title}</b>
                      <span className="small" style={{ marginLeft: 10 }}>
                        {b.status} • {b.chapters.length} chapters
                      </span>
                    </button>
                    <button className="tabBtn" onClick={() => remove(b.id)} title="Remove">
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </CardFrame>

          <CardFrame title="Tools" subtitle="Creative workflow shortcuts" storageKey="writers:tools" className="softCard" defaultCollapsed={false}>
            <div className="row wrap" style={{ gap: 10 }}>
              <button className="tabBtn" onClick={() => onNavigate("Builder")}>🧱 Layout / Covers</button>
              <button className="tabBtn" onClick={() => onNavigate("Money")}>💵 Monetize / KDP</button>
              <button className="tabBtn" onClick={() => onNavigate("DevEngine")}>🧩 Assets / Builds</button>
              <button className="tabBtn" onClick={() => onNavigate("Brain")}>🧠 Notes / Memory</button>
              <button className="tabBtn" onClick={() => onNavigate("Calendar")}>📅 Deadlines</button>
            </div>
            <div className="note">
              Pro move: schedule “Write 30 min” blocks in Calendar and link them to this panel.
            </div>
          </CardFrame>
        </div>

        {/* Center: Writing Desk */}
        <div className="writersCenter">
          <div className="card softCard">
            <div className="cluster wrap spread">
              <div>
                <div className="h">Writing Desk</div>
                <div className="sub">Write, revise, and ship. Keep it simple, keep it moving.</div>
              </div>
              <div className="tabs">
                <button className={"tabBtn " + (tab === "desk" ? "active" : "")} onClick={() => setTab("desk")}>Desk</button>
                <button className={"tabBtn " + (tab === "chapters" ? "active" : "")} onClick={() => { ensureChapter(); setTab("chapters"); }}>Chapters</button>
                <button className={"tabBtn " + (tab === "export" ? "active" : "")} onClick={() => setTab("export")}>Export</button>
              </div>
            </div>

            {!active ? (
              <div className="note mt-5">Pick a book from the Library to start writing.</div>
            ) : (
              <div className="grid mt-5">
                <div className="cluster wrap">
                  <input
                    className="input"
                    style={{ flex: 1, minWidth: 240 }}
                    value={active.title}
                    onChange={(e) => upsert({ ...active, title: e.target.value, updatedAt: Date.now() })}
                    placeholder="Book title"
                  />
                  <select
                    className="input"
                    value={active.status}
                    onChange={(e) => upsert({ ...active, status: e.target.value as any, updatedAt: Date.now() })}
                    style={{ maxWidth: 220 }}
                  >
                    {(["Idea", "Drafting", "Revising", "Editing", "Publishing"] as const).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {tab === "desk" && (
                  <>
                    <input
                      className="input"
                      value={active.subtitle || ""}
                      onChange={(e) => upsert({ ...active, subtitle: e.target.value, updatedAt: Date.now() })}
                      placeholder="Subtitle (optional)"
                    />
                    <textarea
                      className="input"
                      style={{ minHeight: 80 }}
                      value={active.logline || ""}
                      onChange={(e) => upsert({ ...active, logline: e.target.value, updatedAt: Date.now() })}
                      placeholder="Logline / hook (1–3 sentences)"
                    />

                    <div className="cluster wrap spread">
                      <div className="small" style={{ opacity: 0.9 }}>
                        Chapter: <b>{chapter?.title || "(none)"}</b> • <b>{wc}</b> words • ~{minutes} min read
                      </div>
                      <div className="row wrap" style={{ gap: 10 }}>
                        <button className="tabBtn" onClick={ensureChapter}>+ Ensure chapter</button>
                        <button className="tabBtn" onClick={copyActiveChapter} disabled={!chapter}>Copy chapter</button>
                      </div>
                    </div>

                    {!chapter ? (
                      <div className="note">No chapters yet. Hit <b>+ Ensure chapter</b> (or add chapters in the Chapters tab).</div>
                    ) : (
                      <>
                        <textarea
                          className="input"
                          style={{ minHeight: 320 }}
                          value={chapter.draft || ""}
                          onChange={(e) => {
                            const chapters2 = chapters.map((c, i) => (i === safeChapterIdx ? { ...c, draft: e.target.value } : c));
                            upsert({ ...active, chapters: chapters2, updatedAt: Date.now() });
                          }}
                          placeholder="Write the chapter draft here…"
                        />
                        <textarea
                          className="input"
                          style={{ minHeight: 120 }}
                          value={chapter.notes || ""}
                          onChange={(e) => {
                            const chapters2 = chapters.map((c, i) => (i === safeChapterIdx ? { ...c, notes: e.target.value } : c));
                            upsert({ ...active, chapters: chapters2, updatedAt: Date.now() });
                          }}
                          placeholder="Scene beats / notes / research for this chapter…"
                        />
                      </>
                    )}
                  </>
                )}

                {tab === "chapters" && (
                  <>
                    <div className="cluster wrap spread">
                      <button
                        className="tabBtn"
                        onClick={() => {
                          const next = [...active.chapters, { title: `Chapter ${active.chapters.length + 1}`, notes: "", draft: "" }];
                          upsert({ ...active, chapters: next, updatedAt: Date.now() });
                          setActiveChapterIdx(next.length - 1);
                        }}
                      >
                        Add chapter
                      </button>
                      <div className="small">Tip: Keep chapter titles punchy. Add scene beats in notes.</div>
                    </div>

                    <div className="grid mt-4">
                      {active.chapters.map((c, idx) => (
                        <div key={idx} className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
                          <div className="cluster spread">
                            <button
                              className={"tabBtn " + (idx === safeChapterIdx ? "active" : "")}
                              style={{ flex: 1, textAlign: "left" }}
                              onClick={() => setActiveChapterIdx(idx)}
                            >
                              <b>{c.title}</b>
                              <span className="small" style={{ marginLeft: 10 }}>{wordCount(c.draft || "")} words</span>
                            </button>
                            <button
                              className="tabBtn"
                              onClick={() => {
                                const next = active.chapters.filter((_, i) => i !== idx);
                                upsert({ ...active, chapters: next, updatedAt: Date.now() });
                                setActiveChapterIdx(Math.max(0, idx - 1));
                              }}
                              title="Remove chapter"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="mt-3">
                            <input
                              className="input"
                              value={c.title}
                              onChange={(e) => {
                                const next = active.chapters.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x));
                                upsert({ ...active, chapters: next, updatedAt: Date.now() });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {tab === "export" && (
                  <>
                    <div className="note">
                      Export helpers. Everything is local-first. Copy markdown, or use Dev Engine later to export files.
                    </div>
                    <div className="row wrap" style={{ gap: 10 }}>
                      <button className="tabBtn" onClick={copyActiveChapter} disabled={!chapter}>Copy chapter markdown</button>
                      <button
                        className="tabBtn"
                        onClick={() => {
                          if (!active) return;
                          const payload = JSON.stringify(active, null, 2);
                          navigator.clipboard?.writeText(payload);
                          window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "ok", text: "Copied book JSON." } }));
                        }}
                      >
                        Copy book JSON
                      </button>
                      <button className="tabBtn" onClick={() => onNavigate("Money")}>Open KDP checklist</button>
                      <button className="tabBtn" onClick={downloadPitchDeck}>Download pitch deck</button>
                      <button className="tabBtn" onClick={downloadOneSheet}>Download one-sheet</button>
                      <button className="tabBtn" onClick={downloadTrailerBrief}>Download trailer brief</button>
                      <button className="tabBtn" onClick={downloadReleasePlan}>Download release plan</button>
                      <button className="tabBtn" onClick={downloadFinishedProduct}>Download finished product</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        
        {/* Right: AI Writing Assistant */}
        <div className="writersRight">
          <div className="card softCard writersAICard">
            <div className="cluster wrap spread">
              <div>
                <div className="h">Writers AI Studio</div>
                <div className="sub">Prompt in. Full draft out. Then turn it into characters, storyboard beats, cartoon worldbuilding, and animated video direction.</div>
              </div>
              <div className="row wrap" style={{ gap: 10 }}>
                <button className="tabBtn" onClick={() => setChat([])}>Clear</button>
                <button className="tabBtn" onClick={insertLastAssistantIntoDraft} disabled={!chapter}>Insert → draft</button>
              </div>
            </div>

            <div className="writersModeStrip mt-4">
              {(Object.keys(modePresets) as WriterMode[]).map((mode) => (
                <button key={mode} className={`tabBtn ${writerMode === mode ? "active" : ""}`} onClick={() => setWriterMode(mode)}>
                  {modePresets[mode].label}
                </button>
              ))}
            </div>

            <div className="writersStudioDeck mt-4">
              <div className="writersStudioSpotlight">
                <div className="small shellEyebrow">CURRENT MODE</div>
                <div className="h">{modePresets[writerMode].label}</div>
                <div className="small" style={{ marginTop: 8, opacity: 0.88 }}>{modePresets[writerMode].focus}</div>
              </div>
              <div className="writersStudioSpotlight">
                <div className="small shellEyebrow">PROJECT CONTEXT</div>
                <div className="small">Book: <b>{active?.title || "Untitled"}</b></div>
                <div className="small">Chapter: <b>{chapter?.title || "None selected"}</b></div>
                <div className="small">Status: <b>{active?.status || "Idea"}</b></div>
              </div>
              <div className="writersStudioSpotlight">
                <div className="small shellEyebrow">PRODUCTION STACK</div>
                <div className="small">Writing assets: <b>{assetRollup.writing}</b></div>
                <div className="small">Visual assets: <b>{assetRollup.visual}</b></div>
                <div className="small">Production assets: <b>{assetRollup.production}</b></div>
              </div>
            </div>

            <div className="writersStudioComposer mt-4">
              <div className="small shellEyebrow">PROMPT / CREATIVE SEED</div>
              <textarea
                className="input"
                style={{ minHeight: 110 }}
                value={studioPrompt}
                onChange={(e) => setStudioPrompt(e.target.value)}
                placeholder="Describe the story, song, world, character, mood, message, or scene you want. Example: write a dark animated music video about a phoenix rising from the ashes of a broken city..."
              />
              <div className="writersPromptRow mt-3">
                {modePresets[writerMode].prompts.map((p) => (
                  <button key={p.label} className="tabBtn" onClick={() => setStudioPrompt((cur) => normalizeLabel(cur ? `${cur}\n\n${p.text}` : p.text))}>{p.label}</button>
                ))}
              </div>
            </div>

            <div className="writersStudioActions mt-4">
              <button className="tabBtn active" disabled={busy} onClick={() => sendStudioKind(writerMode === "song" ? "song" : writerMode === "movie" ? "featureOutline" : "story")}>
                {writerMode === "song" ? "Generate full song" : writerMode === "movie" ? "Feature outline" : "Generate full story"}
              </button>
              <button className="tabBtn" disabled={busy} onClick={() => sendStudioKind("character")}>Character sheet</button>
              <button className="tabBtn" disabled={busy} onClick={() => sendStudioKind("storyboard")}>Storyboard</button>
              <button className="tabBtn" disabled={busy} onClick={() => sendStudioKind("cartoonBible")}>Cartoon bible</button>
              <button className="tabBtn" disabled={busy} onClick={() => sendStudioKind("videoTreatment")}>Video treatment</button>
              <button className="tabBtn" disabled={busy} onClick={() => sendStudioKind("shotList")}>Shot list</button>
              <button className="tabBtn" disabled={busy} onClick={() => sendStudioKind("productionPack")}>Production pack</button>
              <button className="tabBtn" disabled={busy} onClick={() => sendStudioKind("episodeGuide")}>Episode guide</button>
              <button className="tabBtn" disabled={busy} onClick={() => sendStudioKind("animationPlan")}>Animation plan</button>
              <button className="tabBtn" disabled={busy} onClick={() => sendStudioKind("castingPack")}>Casting pack</button>
              <button className="tabBtn" disabled={busy} onClick={savePitchDeck}>Pitch deck</button>
              <button className="tabBtn" disabled={busy} onClick={saveOneSheet}>One sheet</button>
              <button className="tabBtn" disabled={busy} onClick={saveTrailerBrief}>Trailer brief</button>
            </div>

            <div className="writersPipelineBoard mt-4">
              <div className="writersPipelineStage">
                <div className="small shellEyebrow">1 / WRITE</div>
                <div className="small"><b>{writerMode === "song" ? "Song + lyrics" : writerMode === "movie" ? "Outline + scenes" : "Story + scenes"}</b></div>
                <div className="small" style={{ opacity: 0.8 }}>Seed the full project before visualizing it.</div>
              </div>
              <div className="writersPipelineStage">
                <div className="small shellEyebrow">2 / DIRECT</div>
                <div className="small"><b>Storyboard + treatment</b></div>
                <div className="small" style={{ opacity: 0.8 }}>Translate writing into sequence beats and camera logic.</div>
              </div>
              <div className="writersPipelineStage">
                <div className="small shellEyebrow">3 / DESIGN</div>
                <div className="small"><b>Character + world + prompts</b></div>
                <div className="small" style={{ opacity: 0.8 }}>Lock style frames, world rules, and key visual hooks.</div>
              </div>
              <div className="writersPipelineStage">
                <div className="small shellEyebrow">4 / SHIP</div>
                <div className="small"><b>Runbook + planner</b></div>
                <div className="small" style={{ opacity: 0.8 }}>Export the package that a team can actually make.</div>
              </div>
            </div>

            <div className="writersGreenlightBoard mt-4">
              <div className="cluster wrap spread">
                <div>
                  <div className="h">Greenlight Studio</div>
                  <div className="sub">Turn the current idea into a launch-ready product lane: book, story, song, movie, music video, cartoon, or full series seed.</div>
                </div>
                <div className="row wrap" style={{ gap: 10 }}>
                  <button className="tabBtn" onClick={downloadPitchDeck}>Download pitch deck</button>
                  <button className="tabBtn" onClick={downloadOneSheet}>Download one-sheet</button>
                  <button className="tabBtn" onClick={downloadTrailerBrief}>Download trailer brief</button>
                      <button className="tabBtn" onClick={downloadReleasePlan}>Download release plan</button>
                      <button className="tabBtn" onClick={downloadFinishedProduct}>Download finished product</button>
                </div>
              </div>

              <div className="writersGreenlightSelectors mt-4">
                <div className="writersSelectorBlock"><div className="small shellEyebrow">PRODUCTION TYPE</div><div className="writersSelectorChips mt-2">{(["Book","Story","Song","Movie","Music Video","Cartoon","Series"] as ProductionType[]).map((item) => (<button key={item} className={"tabBtn " + (productionType === item ? "active" : "")} onClick={() => setProductionType(item)}>{item}</button>))}</div></div>
                <div className="writersSelectorBlock"><div className="small shellEyebrow">RELEASE TARGET</div><div className="writersSelectorChips mt-2">{(["Indie Launch","YouTube / Social","Festival Circuit","Pitch / Publishing","Streaming / Platform"] as ReleaseTarget[]).map((item) => (<button key={item} className={"tabBtn " + (releaseTarget === item ? "active" : "")} onClick={() => setReleaseTarget(item)}>{item}</button>))}</div></div>
                <div className="writersSelectorBlock"><div className="small shellEyebrow">BUDGET + SCOPE</div><div className="writersSelectorChips mt-2">{(["$","$$","$$$","$$$$"] as BudgetBand[]).map((item) => (<button key={item} className={"tabBtn " + (budgetBand === item ? "active" : "")} onClick={() => setBudgetBand(item)}>{item}</button>))}{(["Lean","Balanced","Epic"] as ScopeLevel[]).map((item) => (<button key={item} className={"tabBtn " + (scopeLevel === item ? "active" : "")} onClick={() => setScopeLevel(item)}>{item}</button>))}</div></div>
              </div>

              <div className="writersProducerGrid mt-4">
                <div className="writersProducerCard"><div className="small shellEyebrow">GREENLIGHT</div><div className="small"><b>{greenlightModel.readiness}</b></div></div>
                <div className="writersProducerCard"><div className="small shellEyebrow">SCORE</div><div className="small"><b>{greenlightModel.score}/98</b></div></div>
                <div className="writersProducerCard"><div className="small shellEyebrow">STRONGEST LANE</div><div className="small"><b>{greenlightModel.strongestLane}</b></div></div>
                <div className="writersProducerCard"><div className="small shellEyebrow">NEXT GATE</div><div className="small"><b>{greenlightModel.nextGate}</b></div></div>
              </div>

              <div className="writersProductionGrid mt-4">
                <div className="writersProductionCard"><div className="small shellEyebrow">READY PRODUCT</div><div className="small">{productionType} aimed at <b>{releaseTarget}</b> with a <b>{budgetBand}</b> budget lane and <b>{scopeLevel}</b> scope.</div></div>
                <div className="writersProductionCard"><div className="small shellEyebrow">ASSET COVERAGE</div><div className="small">Writing: <b>{greenlightModel.hasWriting ? "locked" : "missing"}</b><br/>Visual: <b>{greenlightModel.hasVisual ? "locked" : "missing"}</b><br/>Production: <b>{greenlightModel.hasProduction ? "locked" : "missing"}</b></div></div>
                <div className="writersProductionCard"><div className="small shellEyebrow">LAUNCH DOCS</div><div className="small">Pitch deck, one-sheet, trailer brief, packet, storyboard sheet, prompt sheet.</div></div>
              </div>

              <div className="writersStudioSpotlight writersStudioWide mt-4">
                <div className="cluster wrap spread">
                  <div>
                    <div className="small shellEyebrow">GO-TO-MARKET DOCS</div>
                    <div className="sub">Auto-generated commercial docs so the project feels ready to deploy, sell, pitch, or launch.</div>
                  </div>
                  <div className="row wrap" style={{ gap: 10 }}>
                    <button className="tabBtn" onClick={savePitchDeck}>Save pitch deck</button>
                    <button className="tabBtn" onClick={saveOneSheet}>Save one-sheet</button>
                    <button className="tabBtn" onClick={saveTrailerBrief}>Save trailer brief</button>
                  </div>
                </div>
                <div className="writersDocPreviewGrid mt-4">
                  <pre className="writersPlannerPreview">{pitchDeck}</pre>
                  <pre className="writersPlannerPreview">{oneSheet}</pre>
                  <pre className="writersPlannerPreview">{trailerBrief}</pre>
                </div>
              </div>
            </div>

            <div className="writersReleaseEngine mt-4">
              <div className="cluster wrap spread">
                <div>
                  <div className="h">Release Engine</div>
                  <div className="sub">Make the project a final finished ready-to-deploy product with launch docs, hooks, trailer logic, platform pitch, and monetization.</div>
                </div>
                <div className="row wrap" style={{ gap: 10 }}>
                  <button className="tabBtn" onClick={saveReleasePlan}>Save release plan</button>
                  <button className="tabBtn" onClick={saveMarketingHooks}>Save hooks</button>
                  <button className="tabBtn" onClick={savePlatformPitch}>Save platform pitch</button>
                  <button className="tabBtn active" onClick={saveFinishedProduct}>Save finished product</button>
                </div>
              </div>
              <div className="writersProducerGrid mt-4">
                <div className="writersProducerCard"><div className="small shellEyebrow">TARGET</div><div className="small"><b>{releaseTarget}</b></div></div>
                <div className="writersProducerCard"><div className="small shellEyebrow">BUDGET</div><div className="small"><b>{budgetBand}</b></div></div>
                <div className="writersProducerCard"><div className="small shellEyebrow">SCOPE</div><div className="small"><b>{scopeLevel}</b></div></div>
                <div className="writersProducerCard"><div className="small shellEyebrow">FINAL PRODUCT</div><div className="small"><b>{productionType}</b></div></div>
              </div>
              <div className="writersDocPreviewGrid mt-4">
                <pre className="writersPlannerPreview">{releasePlan}</pre>
                <pre className="writersPlannerPreview">{marketingHooks}</pre>
                <pre className="writersPlannerPreview">{posterVariants}</pre>
              </div>
              <div className="writersDocPreviewGrid mt-4">
                <pre className="writersPlannerPreview">{trailerCuts}</pre>
                <pre className="writersPlannerPreview">{platformPitch}</pre>
                <pre className="writersPlannerPreview">{monetizationLane}</pre>
              </div>
              <div className="writersStudioSpotlight writersStudioWide mt-4">
                <div className="cluster wrap spread">
                  <div>
                    <div className="small shellEyebrow">FINISHED READY-TO-DEPLOY PRODUCT</div>
                    <div className="sub">Export the final product packet for the current project lane.</div>
                  </div>
                  <div className="row wrap" style={{ gap: 10 }}>
                    <button className="tabBtn" onClick={downloadReleasePlan}>Download release plan</button>
                    <button className="tabBtn" onClick={downloadMarketingHooks}>Download hooks</button>
                    <button className="tabBtn" onClick={downloadPosterVariants}>Download poster variants</button>
                    <button className="tabBtn" onClick={downloadTrailerCuts}>Download trailer cuts</button>
                    <button className="tabBtn" onClick={downloadPlatformPitch}>Download platform pitch</button>
                    <button className="tabBtn" onClick={downloadMonetizationLane}>Download monetization lane</button>
                    <button className="tabBtn active" onClick={downloadFinishedProduct}>Download finished product</button>
                  </div>
                </div>
                <pre className="writersPlannerPreview mt-4">{finishedProduct}</pre>
              </div>
            </div>

            <div className="writersRenderPrep mt-4">
              <div className="cluster wrap spread">
                <div>
                  <div className="h">Render Pipeline Prep</div>
                  <div className="sub">Bridge the project into a watch-ready pipeline with scene batches, voiceover, soundtrack cues, continuity checks, and final assembly.</div>
                </div>
                <div className="row wrap" style={{ gap: 10 }}>
                  <button className="tabBtn" onClick={saveSceneBatchExporter}>Save scene batches</button>
                  <button className="tabBtn" onClick={saveVoiceoverPack}>Save voiceover pack</button>
                  <button className="tabBtn" onClick={saveSoundtrackCueSheet}>Save cue sheet</button>
                  <button className="tabBtn" onClick={saveShotContinuityBoard}>Save continuity board</button>
                  <button className="tabBtn active" onClick={saveFinalAssemblyChecklist}>Save final checklist</button>
                </div>
              </div>
              <div className="writersDocPreviewGrid mt-4">
                <pre className="writersPlannerPreview">{sceneBatchExporter}</pre>
                <pre className="writersPlannerPreview">{voiceoverPack}</pre>
                <pre className="writersPlannerPreview">{soundtrackCueSheet}</pre>
              </div>
              <div className="writersDocPreviewGrid mt-4">
                <pre className="writersPlannerPreview">{shotContinuityBoard}</pre>
                <pre className="writersPlannerPreview">{finalAssemblyChecklist}</pre>
                <pre className="writersPlannerPreview">{renderHandoffPack}</pre>
              </div>
              <div className="row wrap mt-4">
                <button className="tabBtn" onClick={downloadSceneBatchExporter}>Download scene batches</button>
                <button className="tabBtn" onClick={downloadVoiceoverPack}>Download voiceover pack</button>
                <button className="tabBtn" onClick={downloadSoundtrackCueSheet}>Download cue sheet</button>
                <button className="tabBtn" onClick={downloadShotContinuityBoard}>Download continuity board</button>
                <button className="tabBtn" onClick={downloadFinalAssemblyChecklist}>Download final checklist</button>
                <button className="tabBtn" onClick={downloadRenderHandoffPack}>Download render handoff</button>
              </div>
            </div>

            <div className="writersProducerOps mt-4">
              <div className="cluster wrap spread">
                <div>
                  <div className="h">Final Video Handoff + Producer Ops</div>
                  <div className="sub">Package the project for the people who will actually finish, assemble, and release it.</div>
                </div>
                <div className="row wrap" style={{ gap: 10 }}>
                  <button className="tabBtn" onClick={saveProducerOpsBoard}>Save producer ops</button>
                  <button className="tabBtn" onClick={saveFinalVideoHandoff}>Save final video handoff</button>
                  <button className="tabBtn" onClick={downloadProducerOpsBoard}>Download producer ops</button>
                  <button className="tabBtn active" onClick={downloadFinalVideoHandoff}>Download final video handoff</button>
                </div>
              </div>
              <div className="writersDocPreviewGrid mt-4">
                <pre className="writersPlannerPreview">{producerOpsBoard}</pre>
                <pre className="writersPlannerPreview">{finalVideoHandoff}</pre>
              </div>
            </div>

            <div className="writersProducerOps mt-4">
              <div className="cluster wrap spread">
                <div>
                  <div className="h">External Render Bridge</div>
                  <div className="sub">Prep provider settings, shot/image batches, audio exports, and a final assembly manifest for real outside render tools.</div>
                </div>
                <div className="row wrap" style={{ gap: 10 }}>
                  <button className="tabBtn" onClick={saveShotImagePromptBatch}>Save shot batch</button>
                  <button className="tabBtn" onClick={saveVoiceMusicAssetExport}>Save voice/music export</button>
                  <button className="tabBtn" onClick={saveFinalAssemblyManifest}>Save assembly manifest</button>
                  <button className="tabBtn active" onClick={saveExternalVideoToolHandoff}>Save tool handoff</button>
                </div>
              </div>

              <div className="card softCard mt-4">
                <div className="small shellEyebrow">RENDER PROVIDER SETTINGS</div>
                <div className="row wrap mt-3" style={{ gap: 10 }}>
                  <select className="input" style={{ minWidth: 180 }} value={renderProvider} onChange={(e) => setRenderProvider(e.target.value)}>
                    {["Runway / external", "Pika / external", "Comfy / local", "AnimateDiff / local", "Editor timeline / manual"].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <select className="input" style={{ minWidth: 120 }} value={renderFormat} onChange={(e) => setRenderFormat(e.target.value)}>
                    {["mp4", "mov", "image-sequence"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <select className="input" style={{ minWidth: 120 }} value={renderResolution} onChange={(e) => setRenderResolution(e.target.value)}>
                    {["1080p", "1440p", "4K"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <select className="input" style={{ minWidth: 120 }} value={renderFps} onChange={(e) => setRenderFps(e.target.value)}>
                    {["24 fps", "30 fps", "60 fps"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  <input className="input" style={{ flex: 1, minWidth: 260 }} value={renderBaseUrl} onChange={(e) => setRenderBaseUrl(e.target.value)} placeholder="http://127.0.0.1:3000/render" />
                </div>
              </div>

              <div className="writersDocPreviewGrid mt-4">
                <pre className="writersPlannerPreview">{shotImagePromptBatch}</pre>
                <pre className="writersPlannerPreview">{voiceMusicAssetExport}</pre>
              </div>
              <div className="writersDocPreviewGrid mt-4">
                <pre className="writersPlannerPreview">{finalAssemblyManifest}</pre>
                <pre className="writersPlannerPreview">{externalVideoToolHandoff}</pre>
              </div>
              <div className="row wrap mt-4">
                <button className="tabBtn" onClick={downloadShotImagePromptBatch}>Download shot batch</button>
                <button className="tabBtn" onClick={downloadVoiceMusicAssetExport}>Download voice/music export</button>
                <button className="tabBtn" onClick={downloadFinalAssemblyManifest}>Download assembly manifest</button>
                <button className="tabBtn active" onClick={downloadExternalVideoToolHandoff}>Download external tool handoff</button>
              </div>
            </div>

            <div className="writersProducerOps mt-4">
              <div className="cluster wrap spread">
                <div>
                  <div className="h">OddEngine Internal Render Lab</div>
                  <div className="sub">Build internal scene queues, render jobs, and watch-deck manifests inside Writers, then preview a finished video URL here after an external or future local render completes.</div>
                </div>
                <div className="row wrap" style={{ gap: 10 }}>
                  <button className="tabBtn" onClick={saveInternalRenderJobJson}>Save internal render job</button>
                  <button className="tabBtn" onClick={saveSceneRenderQueue}>Save scene queue</button>
                  <button className="tabBtn" onClick={saveWatchDeckManifest}>Save watch deck</button>
                  <button className="tabBtn active" onClick={downloadInternalRenderJobJson}>Download render job</button>
                </div>
              </div>

              <div className="card softCard mt-4">
                <div className="small shellEyebrow">INTERNAL RENDER ENGINE SETTINGS</div>
                <div className="row wrap mt-3" style={{ gap: 10 }}>
                  <select className="input" style={{ minWidth: 180 }} value={renderJobMode} onChange={(e) => setRenderJobMode(e.target.value)}>
                    {["Internal job builder", "Hybrid local render", "External final render"].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <select className="input" style={{ minWidth: 180 }} value={renderProvider} onChange={(e) => setRenderProvider(e.target.value)}>
                    {["OddEngine Internal / job builder", "Runway / external", "Pika / external", "Comfy / local", "AnimateDiff / local", "Editor timeline / manual"].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <input className="input" style={{ flex: 1, minWidth: 260 }} value={renderPreviewUrl} onChange={(e) => setRenderPreviewUrl(e.target.value)} placeholder="Paste a finished video URL or local file URL for in-panel preview" />
                </div>
              </div>

              <div className="writersDocPreviewGrid mt-4">
                <pre className="writersPlannerPreview">{internalRenderJobJson}</pre>
                <pre className="writersPlannerPreview">{sceneRenderQueue}</pre>
              </div>
              <div className="writersDocPreviewGrid mt-4">
                <pre className="writersPlannerPreview">{watchDeckManifest}</pre>
                <div className="card softCard">
                  <div className="small shellEyebrow">WATCH DECK / FINISHED VIDEO PREVIEW</div>
                  <div className="sub mt-2">{renderPreviewUrl ? "Preview the final render here once your external or local render pipeline produces a playable file." : "Add a preview URL after rendering to watch the finished video inside Writers."}</div>
                  {renderPreviewUrl ? (
                    <video controls style={{ width: "100%", marginTop: 14, borderRadius: 16, background: "#0a0f16" }} src={renderPreviewUrl} />
                  ) : (
                    <div className="writersProducerCard mt-4">
                      <div className="small shellEyebrow">PREVIEW STATUS</div>
                      <div className="small"><b>No finished video linked yet</b></div>
                      <div className="small mt-2">Use the external render bridge or a future local render backend, then paste the output URL here to watch it inside the panel.</div>
                    </div>
                  )}
                </div>
              </div>
              <div className="row wrap mt-4">
                <button className="tabBtn" onClick={downloadInternalRenderJobJson}>Download render job</button>
                <button className="tabBtn" onClick={downloadSceneRenderQueue}>Download scene queue</button>
                <button className="tabBtn" onClick={downloadWatchDeckManifest}>Download watch deck</button>
              </div>
            </div>

            <div className="writersHandoffLab mt-4">
              <div className="cluster wrap spread">
                <div>
                  <div className="h">Studio Handoff Lab</div>
                  <div className="sub">Turn treatments into image prompts, storyboard cards, export checklists, and a music video production plan.</div>
                </div>
                <div className="row wrap" style={{ gap: 10 }}>
                  <button className="tabBtn" onClick={handoffImagePromptPack} disabled={!latestTreatmentAsset && !latestStoryboardAsset}>Image prompt handoff</button>
                  <button className="tabBtn" onClick={exportChecklist} disabled={!studioAssets.length}>Asset checklist export</button>
                  <button className="tabBtn" onClick={exportProductionPlanner}>Production planner</button>
                  <button className="tabBtn" onClick={buildProductionRunbook}>Build production runbook</button>
                  <button className="tabBtn" onClick={exportFullProjectPacket}>Copy full project packet</button>
                  <button className="tabBtn" onClick={downloadProjectPacket}>Download packet</button>
                  <button className="tabBtn" onClick={downloadStoryboardSheet}>Storyboard sheet</button>
                  <button className="tabBtn" onClick={downloadArtPromptSheet}>Art prompt sheet</button>
                  <button className="tabBtn" onClick={downloadMusicVideoPlanSheet}>Video plan sheet</button>
                </div>
              </div>

              <div className="writersStudioDeck mt-4">
                <div className="writersStudioSpotlight">
                  <div className="small shellEyebrow">VISUAL STYLE SELECTOR</div>
                  <div className="writersStyleSelector mt-3">
                    {(["neo-noir anime", "cartoon surreal", "punk comic", "dreamy watercolor", "glitch cyberpop", "cinematic realism"] as VisualStyle[]).map((style) => (
                      <button key={style} className={"tabBtn " + (visualStyle === style ? "active" : "")} onClick={() => setVisualStyle(style)}>{style}</button>
                    ))}
                  </div>
                  <div className="small mt-3" style={{ opacity: 0.82 }}>Current visual style drives your exported packet, prompt handoff language, and director framing.</div>
                </div>

                <div className="writersStudioSpotlight writersStudioWide">
                  <div className="small shellEyebrow">MULTI-SCENE DIRECTOR TIMELINE</div>
                  <div className="writersDirectorTimeline mt-3">
                    {directorTimeline.map((step, idx) => (
                      <div key={idx} className="writersTimelineStep">
                        <div className="small shellEyebrow">{step.phase}</div>
                        <div className="small"><b>{step.summary}</b></div>
                        <div className="small mt-2">{step.camera}</div>
                        <div className="small" style={{ opacity: 0.82 }}>{step.purpose}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="writersStudioSpotlight writersStudioWide">
                  <div className="small shellEyebrow">STORYBOARD SCENE CARDS</div>
                  {storyboardScenes.length ? (
                    <div className="writersSceneGrid mt-3">
                      {storyboardScenes.map((scene, idx) => (
                        <div key={idx} className="writersSceneCard">
                          <div className="small shellEyebrow">{scene.title}</div>
                          <div className="small"><b>{scene.summary}</b></div>
                          <div className="small mt-2">Camera: {scene.camera}</div>
                          <div className="small" style={{ opacity: 0.82 }}>Purpose: {scene.purpose}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="small mt-3" style={{ opacity: 0.82 }}>Generate a storyboard or shot list and scene cards will appear here automatically.</div>
                  )}
                </div>

                <div className="writersStudioSpotlight writersStudioWide">
                  <div className="small shellEyebrow">CHARACTER CASTING BOARD</div>
                  <div className="writersCastingGrid mt-3">
                    {castingBoard.map((member, idx) => (
                      <div key={idx} className="writersCastingCard">
                        <div className="small shellEyebrow">{member.role}</div>
                        <div className="small"><b>{member.name}</b></div>
                        <div className="small mt-2">{member.voice}</div>
                        <div className="small" style={{ opacity: 0.82 }}>{member.note}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="writersStudioSpotlight writersStudioWide">
                  <div className="small shellEyebrow">MUSIC VIDEO BEAT MAP</div>
                  <div className="writersBeatMap mt-3">
                    {beatMap.map((beat, idx) => (
                      <div key={idx} className="writersBeatStep">
                        <div className="small shellEyebrow">{beat.part}</div>
                        <div className="small"><b>{beat.timing}</b></div>
                        <div className="small mt-2">{beat.move}</div>
                        <div className="small" style={{ opacity: 0.82 }}>{beat.beat}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="writersStudioSpotlight writersStudioWide">
                  <div className="small shellEyebrow">MUSIC VIDEO / FILM PRODUCTION PLANNER</div>
                  <pre className="writersPlannerPreview">{productionPlanner}</pre>
                </div>


                <div className="writersStudioSpotlight writersStudioWide">
                  <div className="small shellEyebrow">PRODUCER DASHBOARD</div>
                  <div className="writersProducerGrid mt-3">
                    <div className="writersProducerCard"><div className="small shellEyebrow">PROJECT</div><div className="small"><b>{producerDashboard.project}</b></div></div>
                    <div className="writersProducerCard"><div className="small shellEyebrow">COMPLETION</div><div className="small"><b>{producerDashboard.completion}%</b></div></div>
                    <div className="writersProducerCard"><div className="small shellEyebrow">STRONGEST LANE</div><div className="small"><b>{producerDashboard.strongestLane}</b></div></div>
                    <div className="writersProducerCard"><div className="small shellEyebrow">RISK FLAG</div><div className="small"><b>{producerDashboard.riskFlag}</b></div></div>
                  </div>
                  <div className="writersProducerCallout mt-3">
                    <div className="small shellEyebrow">NEXT GATE</div>
                    <div className="small"><b>{producerDashboard.nextGate}</b></div>
                    <div className="row wrap mt-3">
                      <button className="tabBtn" onClick={downloadProjectPacket}>Download packet</button>
                      <button className="tabBtn" onClick={downloadStoryboardSheet}>Download storyboard</button>
                      <button className="tabBtn" onClick={downloadArtPromptSheet}>Download prompts</button>
                      <button className="tabBtn" onClick={downloadMusicVideoPlanSheet}>Download video plan</button>
                    </div>
                  </div>
                </div>

                <div className="writersStudioSpotlight writersStudioWide">
                  <div className="small shellEyebrow">FULL PRODUCTION TARGET</div>
                  <div className="writersProductionGrid mt-3">
                    <div className="writersProductionCard"><div className="small shellEyebrow">MOVIE</div><div className="small">Feature outline, set-pieces, casting pack, animation plan.</div></div>
                    <div className="writersProductionCard"><div className="small shellEyebrow">MUSIC VIDEO</div><div className="small">Treatment, shot list, edit rhythm, final image, prompt pack.</div></div>
                    <div className="writersProductionCard"><div className="small shellEyebrow">CARTOON</div><div className="small">Cartoon bible, episode guide, characters, world rules, storyboard cards.</div></div>
                    <div className="writersProductionCard"><div className="small shellEyebrow">SHORT / TRAILER</div><div className="small">Runbook, teaser beats, keyframes, and asset checklist export.</div></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="writersChat mt-4">
              {chat.length ? (
                chat.map((m, i) => (
                  <div key={i} className={"writersBubble " + (m.role === "user" ? "user" : "assistant")}
                    title={new Date(m.ts).toLocaleString()}
                  >
                    {m.content}
                  </div>
                ))
              ) : (
                <div className="small" style={{ opacity: 0.85 }}>
                  Start with a prompt seed, then generate a full story or song. From there, turn it into a storyboard, character sheet, cartoon bible, or animated video treatment.
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="writersStudioSaveRow mt-4">
              <button className="tabBtn" onClick={() => saveLastAssistantAs(writerMode === "song" ? "song" : writerMode === "movie" ? "featureOutline" : "story")}>Save as draft asset</button>
              <button className="tabBtn" onClick={() => saveLastAssistantAs("character")}>Save as character pack</button>
              <button className="tabBtn" onClick={() => saveLastAssistantAs("storyboard")}>Save as storyboard</button>
              <button className="tabBtn" onClick={() => saveLastAssistantAs("videoTreatment")}>Save as video treatment</button>
              <button className="tabBtn" onClick={() => saveLastAssistantAs("productionPack")}>Save as production pack</button>
            </div>

            <div className="cluster mt-4">
              <input
                className="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={busy ? "Thinking…" : `Ask Homie for a ${writerMode}... full draft, hook, storyboard, or video treatment`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <button className="tabBtn" disabled={busy} onClick={() => send(input)}>
                Send
              </button>
            </div>

            <div className="writersStudioSpotlight writersStudioWide mt-5">
              <div className="cluster wrap spread">
                <div>
                  <div className="small shellEyebrow">FULL PROJECT PACKET</div>
                  <div className="sub">Director timeline, casting, beat map, style, and export checklist in one handoff packet.</div>
                </div>
                <div className="row wrap" style={{ gap: 10 }}><button className="tabBtn" onClick={exportFullProjectPacket}>Copy packet</button><button className="tabBtn" onClick={downloadProjectPacket}>Download packet</button></div>
              </div>
              <pre className="writersPlannerPreview mt-3">{fullProjectPacket}</pre>
            </div>

            <div className="writersAssetVault mt-5">
              <div className="cluster wrap spread">
                <div>
                  <div className="h">Studio Asset Vault</div>
                  <div className="sub">Save your best outputs here, then copy or insert them into the active chapter.</div>
                </div>
                <button className="tabBtn" onClick={() => setStudioAssets([])}>Clear vault</button>
              </div>

              <div className="grid mt-4">
                {studioAssets.length ? studioAssets.map((asset) => (
                  <div key={asset.id} className="writersAssetCard">
                    <div className="cluster wrap spread">
                      <div>
                        <div className="small shellEyebrow">{studioAssetTitle(asset.kind)}</div>
                        <div className="small"><b>{asset.title}</b></div>
                      </div>
                      <div className="small" style={{ opacity: 0.75 }}>{new Date(asset.ts).toLocaleDateString()}</div>
                    </div>
                    <div className="writersAssetPreview">{asset.content.slice(0, 320)}{asset.content.length > 320 ? "…" : ""}</div>
                    <div className="row wrap mt-3">
                      <button className="tabBtn" onClick={() => copyAsset(asset)}>Copy</button>
                      <button className="tabBtn" onClick={() => insertAssetIntoDraft(asset)} disabled={!chapter}>Insert → draft</button>
                      <button className="tabBtn" onClick={() => setChat((c) => [...c, { role: "assistant", content: asset.content, ts: Date.now() }])}>Load in chat</button>
                      <button className="tabBtn" onClick={() => generateArtPromptPackForAsset(asset)}>Generate art prompt pack</button>
                      <button className="tabBtn" onClick={() => downloadTextFile(`${slugifyName(asset.title)}.md`, asset.content)}>Download asset</button>
                    </div>
                  </div>
                )) : (
                  <div className="note">No saved studio assets yet. Generate a story, song, storyboard, or treatment and save the ones you want to keep.</div>
                )}
              </div>
            </div>

            {!isDesktop() && (
              <div className="note">
                Running Web mode. For in-panel AI replies, use Desktop mode (local Ollama) or open the Homie panel.
                <div className="cluster wrap mt-3">
                  <button className="tabBtn" onClick={() => onNavigate("Homie")}>Open Homie</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
