import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import CardFrame from "../components/CardFrame";
import { loadJSON, saveJSON } from "../lib/storage";
import { exportToFolderBrowser, downloadTextFile, downloadZip, GenFile } from "../lib/files";
import { oddApi, isDesktop } from "../lib/odd";
import { queueAutoProductionLoop } from "../lib/productionLoop";
import { runOnePromptFlow, listOnePromptFlowRuns } from "../lib/onePromptFlow";

type AssetType = "book" | "music" | "art" | "video" | "cartoon" | "social";
type Stage = "Idea" | "Planning" | "Producing" | "Packaging" | "Ready" | "Published";

type Chapter = {
  title: string;
  notes?: string;
  draft?: string;
};

type DistributionPack = {
  title?: string;
  tagline?: string;
  description?: string;
  hooks?: string[];
  hashtags?: string[];
  deliverables?: string[];
  assetFiles?: string[];
  captions?: string[];
  coverBrief?: string;
  thumbnailBrief?: string;
  artBrief?: string;
  audioBrief?: string;
  videoBrief?: string;
  script?: string;
  monetization?: string;
  releaseChecklist?: string[];
  publishTargets?: string[];
};

type StudioHandoff = {
  generatedAt: number;
  projectId: string;
  title: string;
  type: AssetType;
  finalOutput: string;
  artifactCount: number;
  bundleName: string;
  renderLab: {
    primaryBrief: string;
    visualBrief: string;
    audioBrief: string;
    videoBrief: string;
    script: string;
    requestedAssets: string[];
  };
  distribution: {
    hooks: string[];
    captions: string[];
    hashtags: string[];
    targets: string[];
    checklist: string[];
    monetization: string;
  };
};

type StudioProject = {
  id: string;
  type: AssetType;
  title: string;
  subtitle?: string;
  status: Stage;
  prompt?: string;
  concept?: string;
  audience?: string;
  style?: string;
  format?: string;
  notes?: string;
  output?: string;
  distribution?: DistributionPack;
  chapters: Chapter[];
  updatedAt: number;
};

type WriterMsg = { role: "user" | "assistant"; content: string; ts: number };

type LegacyBook = {
  id: string;
  title: string;
  subtitle?: string;
  status: "Idea" | "Drafting" | "Revising" | "Editing" | "Publishing";
  logline?: string;
  notes?: string;
  chapters: Chapter[];
  updatedAt: number;
};

const KEY_PROJECTS = "oddengine:studio:projects:v1";
const KEY_LEGACY_BOOKS = "oddengine:books:v1";
const KEY_ACTIVE = "oddengine:studio:active";
const KEY_ACTIVE_CH = "oddengine:studio:activeChapter";
const KEY_CHAT = "oddengine:writers:chat:v1";
const KEY_HANDOFF = "oddengine:studio:handoff:v1";
const KEY_LAST_BUNDLE = "oddengine:studio:lastBundle:v1";
const KEY_ONE_PROMPT_RUNS = "oddengine:studio:onePromptFlowRuns:v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function slugify(value: string) {
  return String(value || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

function wordCount(text: string) {
  const t = (text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function estimateMinutes(words: number) {
  return Math.max(1, Math.round(words / 200));
}

function assetLabel(type: AssetType) {
  return (
    {
      book: "Book",
      music: "Music",
      art: "Art",
      video: "Video",
      cartoon: "Cartoon",
      social: "Social Pack",
    }[type] || "Project"
  );
}

function normalizeStage(status: string): Stage {
  if (["Drafting", "Revising", "Editing"].includes(status)) return "Producing";
  if (status === "Publishing") return "Ready";
  if (["Idea", "Planning", "Producing", "Packaging", "Ready", "Published"].includes(status)) return status as Stage;
  return "Idea";
}

function migrateLegacyBooks(items: LegacyBook[]): StudioProject[] {
  return (items || []).map((b) => ({
    id: b.id || uid(),
    type: "book",
    title: b.title || "Untitled Book",
    subtitle: b.subtitle || "",
    status: normalizeStage(b.status || "Idea"),
    prompt: b.logline || "",
    concept: b.logline || "",
    audience: "",
    style: "",
    format: "Book / ebook",
    notes: b.notes || "",
    output: (b.chapters || []).map((ch) => `## ${ch.title}\n\n${ch.draft || ""}`.trim()).filter(Boolean).join("\n\n"),
    distribution: {
      description: b.logline || "",
      deliverables: ["manuscript", "cover", "blurb", "launch copy"],
      assetFiles: ["manuscript.md", "cover_brief.txt", "launch_copy.md"],
      releaseChecklist: ["polish draft", "format manuscript", "create cover", "publish listing"],
      publishTargets: ["KDP", "PDF", "social promo"],
    },
    chapters: Array.isArray(b.chapters) ? b.chapters : [],
    updatedAt: Number(b.updatedAt || Date.now()),
  }));
}

function loadInitialProjects(): StudioProject[] {
  const studio = loadJSON<StudioProject[]>(KEY_PROJECTS, []);
  if (Array.isArray(studio) && studio.length) return studio;
  const legacy = loadJSON<LegacyBook[]>(KEY_LEGACY_BOOKS, []);
  if (Array.isArray(legacy) && legacy.length) return migrateLegacyBooks(legacy);
  return [];
}

function ensureProjectShape(p: Partial<StudioProject>): StudioProject {
  return {
    id: String(p.id || uid()),
    type: (p.type as AssetType) || "book",
    title: String(p.title || "Untitled Project"),
    subtitle: String(p.subtitle || ""),
    status: normalizeStage(String(p.status || "Idea")),
    prompt: String(p.prompt || ""),
    concept: String(p.concept || ""),
    audience: String(p.audience || ""),
    style: String(p.style || ""),
    format: String(p.format || ""),
    notes: String(p.notes || ""),
    output: String(p.output || ""),
    distribution: {
      ...(p.distribution || {}),
      hooks: Array.isArray(p.distribution?.hooks) ? p.distribution?.hooks : [],
      hashtags: Array.isArray(p.distribution?.hashtags) ? p.distribution?.hashtags : [],
      deliverables: Array.isArray(p.distribution?.deliverables) ? p.distribution?.deliverables : [],
      assetFiles: Array.isArray(p.distribution?.assetFiles) ? p.distribution?.assetFiles : [],
      captions: Array.isArray(p.distribution?.captions) ? p.distribution?.captions : [],
      releaseChecklist: Array.isArray(p.distribution?.releaseChecklist) ? p.distribution?.releaseChecklist : [],
      publishTargets: Array.isArray(p.distribution?.publishTargets) ? p.distribution?.publishTargets : [],
      monetization: String(p.distribution?.monetization || ""),
    },
    chapters: Array.isArray(p.chapters) ? p.chapters : [],
    updatedAt: Number(p.updatedAt || Date.now()),
  };
}

function createProject(type: AssetType = "book"): StudioProject {
  const titles: Record<AssetType, string> = {
    book: "Untitled Book",
    music: "Untitled Song Pack",
    art: "Untitled Art Drop",
    video: "Untitled Video Project",
    cartoon: "Untitled Cartoon Episode",
    social: "Untitled Social Campaign",
  };
  const formats: Record<AssetType, string> = {
    book: "ebook / paperback",
    music: "single / EP / soundtrack",
    art: "poster / image set / product art",
    video: "short / trailer / longform video",
    cartoon: "episode / short / storyboard pack",
    social: "platform-ready post pack",
  };
  const deliverables: Record<AssetType, string[]> = {
    book: ["manuscript", "cover brief", "blurb", "launch copy"],
    music: ["lyrics", "song brief", "cover art brief", "release copy"],
    art: ["art brief", "prompt pack", "caption pack", "listing copy"],
    video: ["script", "shot list", "thumbnail brief", "distribution copy"],
    cartoon: ["episode script", "scene board", "character brief", "promo copy"],
    social: ["post copy", "caption variants", "hook list", "asset brief"],
  };
  const assetFiles: Record<AssetType, string[]> = {
    book: ["manuscript.md", "cover_brief.txt", "blurb.md", "launch_copy.md"],
    music: ["lyrics.md", "song_brief.md", "cover_art_brief.txt", "release_copy.md"],
    art: ["art_direction.md", "image_prompts.txt", "caption_pack.md", "listing_copy.md"],
    video: ["script.md", "shot_list.md", "thumbnail_brief.txt", "distribution_copy.md"],
    cartoon: ["episode_script.md", "scene_board.md", "character_briefs.md", "promo_copy.md"],
    social: ["post_pack.md", "caption_variants.md", "hook_list.txt", "asset_brief.md"],
  };
  return {
    id: uid(),
    type,
    title: titles[type],
    subtitle: "",
    status: "Idea",
    prompt: "",
    concept: "",
    audience: "",
    style: "",
    format: formats[type],
    notes: "",
    output: "",
    distribution: {
      deliverables: deliverables[type],
      assetFiles: assetFiles[type],
      releaseChecklist: ["generate core asset", "package distribution copy", "final polish", "publish / handoff"],
      publishTargets: [],
      monetization: "",
    },
    chapters: type === "book" ? [{ title: "Chapter 1", notes: "", draft: "" }] : [],
    updatedAt: Date.now(),
  };
}

function distributionMarkdown(p?: DistributionPack) {
  if (!p) return "";
  const lines: string[] = [];
  if (p.title) lines.push(`# ${p.title}`);
  if (p.tagline) lines.push(`\n**Tagline:** ${p.tagline}`);
  if (p.description) lines.push(`\n## Description\n${p.description}`);
  if (p.deliverables?.length) lines.push(`\n## Deliverables\n${p.deliverables.map((x) => `- ${x}`).join("\n")}`);
  if (p.assetFiles?.length) lines.push(`\n## Asset Files\n${p.assetFiles.map((x) => `- ${x}`).join("\n")}`);
  if (p.hooks?.length) lines.push(`\n## Hooks\n${p.hooks.map((x) => `- ${x}`).join("\n")}`);
  if (p.hashtags?.length) lines.push(`\n## Hashtags\n${p.hashtags.join(" ")}`);
  if (p.captions?.length) lines.push(`\n## Captions\n${p.captions.map((x, i) => `${i + 1}. ${x}`).join("\n")}`);
  if (p.coverBrief) lines.push(`\n## Cover Brief\n${p.coverBrief}`);
  if (p.thumbnailBrief) lines.push(`\n## Thumbnail Brief\n${p.thumbnailBrief}`);
  if (p.artBrief) lines.push(`\n## Art / Visual Brief\n${p.artBrief}`);
  if (p.audioBrief) lines.push(`\n## Audio / Music Brief\n${p.audioBrief}`);
  if (p.videoBrief) lines.push(`\n## Video / Motion Brief\n${p.videoBrief}`);
  if (p.script) lines.push(`\n## Script\n${p.script}`);
  if (p.monetization) lines.push(`\n## Monetization\n${p.monetization}`);
  if (p.releaseChecklist?.length) lines.push(`\n## Release Checklist\n${p.releaseChecklist.map((x) => `- ${x}`).join("\n")}`);
  if (p.publishTargets?.length) lines.push(`\n## Publish Targets\n${p.publishTargets.map((x) => `- ${x}`).join("\n")}`);
  return lines.join("\n").trim();
}

function splitListBlock(label: string, text: string): string[] {
  const rx = new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?:\\n[A-Z][A-Z /]+\\s*:|\\n[A-Z][A-Za-z ]+\\s*:|$)`, "i");
  const match = text.match(rx);
  if (!match?.[1]) return [];
  return match[1]
    .split(/\n|•|- /)
    .map((x) => x.replace(/^[-•\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

function blockValue(label: string, text: string): string {
  const rx = new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?:\\n[A-Z][A-Z /]+\\s*:|\\n[A-Z][A-Za-z ]+\\s*:|$)`, "i");
  return (text.match(rx)?.[1] || "").trim();
}

function parseDistributionFromReply(reply: string, project: StudioProject): DistributionPack {
  return {
    title: blockValue("TITLE", reply) || project.title,
    tagline: blockValue("TAGLINE", reply) || project.subtitle || "",
    description: blockValue("DESCRIPTION", reply) || project.concept || "",
    deliverables: splitListBlock("DELIVERABLES", reply),
    assetFiles: splitListBlock("ASSET FILES", reply),
    hooks: splitListBlock("HOOKS", reply),
    hashtags: splitListBlock("HASHTAGS", reply).map((x) => (x.startsWith("#") ? x : `#${x.replace(/^#/, "")}`)).slice(0, 20),
    captions: splitListBlock("CAPTIONS", reply),
    coverBrief: blockValue("COVER BRIEF", reply),
    thumbnailBrief: blockValue("THUMBNAIL BRIEF", reply),
    artBrief: blockValue("ART / VISUAL BRIEF", reply),
    audioBrief: blockValue("AUDIO / MUSIC BRIEF", reply),
    videoBrief: blockValue("VIDEO / MOTION BRIEF", reply),
    script: blockValue("SCRIPT", reply),
    monetization: blockValue("MONETIZATION", reply),
    releaseChecklist: splitListBlock("RELEASE CHECKLIST", reply),
    publishTargets: splitListBlock("PUBLISH TARGETS", reply),
  };
}

function extractOutput(reply: string) {
  return (reply.match(/OUTPUT\s*:\s*([\s\S]*)$/i)?.[1] || reply).trim();
}

function mediaSpecificGuidance(type: AssetType) {
  const map: Record<AssetType, string> = {
    book: "Create a publishable manuscript excerpt or structured core draft, chapter or section plan, back-cover blurb, cover brief, and launch materials.",
    music: "Create finished lyrics, song concept, production direction, cover art brief, release copy, and promotion assets.",
    art: "Create a finished art direction pack with image prompts, composition notes, caption copy, listing copy, and a distribution kit.",
    video: "Create a finished script, beat sheet, shot list, thumbnail brief, captions, hooks, and publish kit.",
    cartoon: "Create an episode script, scene board, character or visual notes, promo copy, hooks, and platform-ready package.",
    social: "Create a full campaign pack with final post copy, caption variants, hook bank, asset briefs, and publishing schedule cues.",
  };
  return map[type];
}

function buildProjectMarkdown(project: StudioProject) {
  const sections = [
    `# ${project.title}`,
    project.subtitle ? `\n## ${project.subtitle}` : "",
    `\n**Type:** ${assetLabel(project.type)}`,
    `\n**Stage:** ${project.status}`,
    project.prompt ? `\n## Master Prompt\n${project.prompt}` : "",
    project.concept ? `\n## Concept\n${project.concept}` : "",
    project.notes ? `\n## Notes\n${project.notes}` : "",
    project.output ? `\n## Finished Output\n${project.output}` : "",
    distributionMarkdown(project.distribution),
    project.type === "book" && project.chapters.length
      ? `\n## Chapters\n${project.chapters.map((c) => `### ${c.title}\n\n${c.draft || c.notes || ""}`).join("\n\n")}`
      : "",
  ].filter(Boolean);
  return sections.join("\n").trim();
}

function buildHandoff(project: StudioProject, files: GenFile[]): StudioHandoff {
  const dist = project.distribution || {};
  return {
    generatedAt: Date.now(),
    projectId: project.id,
    title: project.title,
    type: project.type,
    finalOutput: project.output || "",
    artifactCount: files.length,
    bundleName: `${slugify(project.title)}-studio-pack`,
    renderLab: {
      primaryBrief: dist.description || project.concept || project.prompt || "",
      visualBrief: dist.artBrief || dist.coverBrief || "",
      audioBrief: dist.audioBrief || "",
      videoBrief: dist.videoBrief || dist.thumbnailBrief || "",
      script: dist.script || project.output || "",
      requestedAssets: dist.deliverables || [],
    },
    distribution: {
      hooks: dist.hooks || [],
      captions: dist.captions || [],
      hashtags: dist.hashtags || [],
      targets: dist.publishTargets || [],
      checklist: dist.releaseChecklist || [],
      monetization: dist.monetization || "",
    },
  };
}

function buildArtifactFiles(project: StudioProject): GenFile[] {
  const safe = ensureProjectShape(project);
  const dist = safe.distribution || {};
  const files: GenFile[] = [];
  const readme = [
    `# ${safe.title}`,
    "",
    `Type: ${assetLabel(safe.type)}`,
    `Stage: ${safe.status}`,
    "",
    "This pack was assembled by FairlyOdd Studio inside OddEngine.",
    "",
    "Included:",
    "- core output",
    "- production metadata",
    "- render briefs",
    "- distribution kit",
    "- handoff package",
  ].join("\n");
  files.push({ path: "README.md", content: readme });
  files.push({ path: "project.json", content: JSON.stringify(safe, null, 2) });
  files.push({ path: "prompts/master_prompt.txt", content: safe.prompt || "" });
  files.push({ path: "prompts/creative_notes.txt", content: [safe.concept, safe.notes, `Audience: ${safe.audience || ""}`, `Style: ${safe.style || ""}`, `Format: ${safe.format || ""}`].filter(Boolean).join("\n") });
  files.push({ path: "output/final_output.md", content: safe.output || "" });
  files.push({ path: "distribution/distribution_pack.md", content: distributionMarkdown(dist) || "No distribution pack generated yet." });
  files.push({ path: "distribution/hooks.txt", content: (dist.hooks || []).join("\n") });
  files.push({ path: "distribution/captions.txt", content: (dist.captions || []).join("\n\n") });
  files.push({ path: "distribution/hashtags.txt", content: (dist.hashtags || []).join(" ") });
  files.push({ path: "distribution/publish_targets.txt", content: (dist.publishTargets || []).join("\n") });
  files.push({ path: "distribution/release_checklist.txt", content: (dist.releaseChecklist || []).join("\n") });
  files.push({ path: "distribution/monetization.md", content: dist.monetization || "" });
  files.push({ path: "render_lab/visual_brief.txt", content: dist.artBrief || dist.coverBrief || "" });
  files.push({ path: "render_lab/audio_brief.txt", content: dist.audioBrief || "" });
  files.push({ path: "render_lab/video_brief.txt", content: dist.videoBrief || dist.thumbnailBrief || "" });
  files.push({ path: "render_lab/script.md", content: dist.script || safe.output || "" });

  if (safe.type === "book") {
    files.push({ path: "book/manuscript.md", content: safe.output || "" });
    files.push({ path: "book/back_cover_blurb.md", content: dist.description || "" });
    safe.chapters.forEach((ch, idx) => {
      files.push({ path: `book/chapters/${String(idx + 1).padStart(2, "0")}-${slugify(ch.title || `chapter-${idx + 1}`)}.md`, content: `# ${ch.title || `Chapter ${idx + 1}`}\n\n${ch.draft || ch.notes || ""}` });
    });
  }
  if (safe.type === "music") {
    files.push({ path: "music/lyrics.md", content: safe.output || dist.script || "" });
    files.push({ path: "music/song_brief.md", content: dist.description || safe.concept || "" });
    files.push({ path: "music/production_notes.md", content: dist.audioBrief || safe.notes || "" });
    files.push({ path: "music/cover_art_brief.txt", content: dist.coverBrief || dist.artBrief || "" });
  }
  if (safe.type === "art") {
    files.push({ path: "art/art_direction.md", content: safe.output || dist.artBrief || "" });
    files.push({ path: "art/image_prompts.txt", content: [dist.artBrief, safe.output].filter(Boolean).join("\n\n") });
    files.push({ path: "art/listing_copy.md", content: dist.description || "" });
  }
  if (safe.type === "video") {
    files.push({ path: "video/script.md", content: dist.script || safe.output || "" });
    files.push({ path: "video/shot_list.md", content: dist.videoBrief || safe.notes || "" });
    files.push({ path: "video/thumbnail_brief.txt", content: dist.thumbnailBrief || dist.coverBrief || "" });
    files.push({ path: "video/distribution_copy.md", content: dist.description || "" });
  }
  if (safe.type === "cartoon") {
    files.push({ path: "cartoon/episode_script.md", content: dist.script || safe.output || "" });
    files.push({ path: "cartoon/scene_board.md", content: dist.videoBrief || dist.artBrief || safe.notes || "" });
    files.push({ path: "cartoon/character_briefs.md", content: dist.artBrief || "" });
    files.push({ path: "cartoon/promo_copy.md", content: dist.description || "" });
  }
  if (safe.type === "social") {
    files.push({ path: "social/post_pack.md", content: safe.output || "" });
    files.push({ path: "social/caption_variants.md", content: (dist.captions || []).join("\n\n") });
    files.push({ path: "social/hook_bank.txt", content: (dist.hooks || []).join("\n") });
    files.push({ path: "social/asset_brief.md", content: [dist.artBrief, dist.videoBrief, dist.coverBrief].filter(Boolean).join("\n\n") });
  }

  const handoff = buildHandoff(safe, files);
  files.push({ path: "handoff/render_lab.json", content: JSON.stringify(handoff.renderLab, null, 2) });
  files.push({ path: "handoff/distribution.json", content: JSON.stringify(handoff.distribution, null, 2) });
  files.push({ path: "handoff/studio_handoff.json", content: JSON.stringify(handoff, null, 2) });
  files.push({ path: "handoff/publisher_checklist.md", content: (dist.releaseChecklist || []).map((item) => `- [ ] ${item}`).join("\n") });
  return files;
}

export default function Books({ onNavigate }: { onNavigate: (panelId: string) => void }) {
  const [projects, setProjects] = useState<StudioProject[]>(() => loadInitialProjects().map(ensureProjectShape));
  const [activeId, setActiveId] = useState<string>(() => loadJSON<string>(KEY_ACTIVE, ""));
  const [activeChapterIdx, setActiveChapterIdx] = useState<number>(() => {
    const n = Number(loadJSON<any>(KEY_ACTIVE_CH, 0));
    return Number.isFinite(n) ? n : 0;
  });
  const [tab, setTab] = useState<"desk" | "outline" | "pipeline" | "export">("desk");
  const [chat, setChat] = useState<WriterMsg[]>(() => loadJSON<WriterMsg[]>(KEY_CHAT, []));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [bundleBusy, setBundleBusy] = useState(false);
  const [flowTick, setFlowTick] = useState(0);
  const [quickType, setQuickType] = useState<AssetType>("book");
  const [pipelineMode, setPipelineMode] = useState<"pack" | "draft" | "all">("all");
  const [autoPublishEnabled, setAutoPublishEnabled] = useState<boolean>(() => loadJSON<boolean>("oddengine:studio:autoPublish:v1", false));
  const [trackRevenueEnabled, setTrackRevenueEnabled] = useState<boolean>(() => loadJSON<boolean>("oddengine:studio:trackRevenue:v1", true));
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const active = useMemo(() => projects.find((p) => p.id === activeId) || projects[0] || null, [projects, activeId]);
  const chapters = active?.chapters || [];
  const safeChapterIdx = Math.max(0, Math.min(chapters.length - 1, activeChapterIdx));
  const chapter = chapters[safeChapterIdx];
  const outputWords = wordCount(active?.output || chapter?.draft || "");
  const outputMinutes = estimateMinutes(outputWords);
  const artifactFiles = useMemo(() => (active ? buildArtifactFiles(active) : []), [active]);
  const handoffPreview = useMemo(() => (active ? buildHandoff(active, artifactFiles) : null), [active, artifactFiles]);

  useEffect(() => {
    if (!activeId && projects[0]?.id) {
      setActiveId(projects[0].id);
      saveJSON(KEY_ACTIVE, projects[0].id);
    }
  }, [projects, activeId]);

  useEffect(() => {
    saveJSON(KEY_ACTIVE_CH, safeChapterIdx);
  }, [safeChapterIdx]);

  useEffect(() => {
    saveJSON("oddengine:studio:autoPublish:v1", autoPublishEnabled);
    saveJSON("oddengine:studio:trackRevenue:v1", trackRevenueEnabled);
  }, [autoPublishEnabled, trackRevenueEnabled]);

  useEffect(() => {
    saveJSON(KEY_CHAT, chat);
    try {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } catch {}
  }, [chat]);

  const toast = (text: string, kind: "ok" | "warn" = "ok") => {
    try {
      window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind, text } }));
    } catch {}
  };

  const persist = (next: StudioProject[]) => {
    const normalized = next.map(ensureProjectShape).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    setProjects(normalized);
    saveJSON(KEY_PROJECTS, normalized);
    saveJSON(KEY_LEGACY_BOOKS, normalized.filter((x) => x.type === "book").map((x) => ({
      id: x.id,
      title: x.title,
      subtitle: x.subtitle,
      status: x.status === "Ready" ? "Publishing" : x.status === "Producing" ? "Drafting" : (x.status as any),
      logline: x.prompt || x.concept || "",
      notes: x.notes || "",
      chapters: x.chapters || [],
      updatedAt: x.updatedAt,
    })));
  };

  const upsert = (project: StudioProject) => {
    const next = projects.some((x) => x.id === project.id) ? projects.map((x) => (x.id === project.id ? ensureProjectShape(project) : x)) : [ensureProjectShape(project), ...projects];
    persist(next);
  };

  const remove = (id: string) => {
    const next = projects.filter((p) => p.id !== id);
    persist(next);
    if (activeId === id) {
      const nid = next[0]?.id || "";
      setActiveId(nid);
      saveJSON(KEY_ACTIVE, nid);
      setActiveChapterIdx(0);
    }
  };

  const ensureChapter = () => {
    if (!active || active.type !== "book") return;
    if (!active.chapters.length) {
      const next = { ...active, chapters: [{ title: "Chapter 1", notes: "", draft: "" }], updatedAt: Date.now() };
      upsert(next);
      setActiveChapterIdx(0);
    }
  };

  const studioSystemPrompt = useMemo(() => {
    const title = active?.title || "Untitled Project";
    const projectType = assetLabel(active?.type || "book");
    const stage = active?.status || "Idea";
    return [
      "You are Homie running FairlyOdd Studio inside OddEngine.",
      "Turn one user prompt into a finished product engine output with a real production pack.",
      "Be practical, creative, commercially aware, organized, and shipping-focused.",
      "Never ask follow-up questions unless absolutely necessary.",
      "Return concise but useful sections with these exact labels when generating a master pack:",
      "TITLE:",
      "TAGLINE:",
      "DESCRIPTION:",
      "DELIVERABLES:",
      "ASSET FILES:",
      "ART / VISUAL BRIEF:",
      "AUDIO / MUSIC BRIEF:",
      "VIDEO / MOTION BRIEF:",
      "HOOKS:",
      "CAPTIONS:",
      "HASHTAGS:",
      "COVER BRIEF:",
      "THUMBNAIL BRIEF:",
      "SCRIPT:",
      "MONETIZATION:",
      "RELEASE CHECKLIST:",
      "PUBLISH TARGETS:",
      "OUTPUT:",
      `Current project title: ${title}`,
      `Project type: ${projectType}`,
      `Current stage: ${stage}`,
      `Audience: ${active?.audience || "general"}`,
      `Style: ${active?.style || "creator-grade, shippable"}`,
      `Format: ${active?.format || "multi-format"}`,
      `Concept: ${active?.concept || active?.prompt || ""}`,
      `Media guidance: ${mediaSpecificGuidance(active?.type || "book")}`,
    ].join("\n");
  }, [active]);

  const send = async (text: string, opts?: { mode?: "chat" | "pack" | "draft" | "all" }) => {
    const t = text.trim();
    if (!t) return;
    const nextChat: WriterMsg[] = [...chat, { role: "user", content: t, ts: Date.now() }];
    setChat(nextChat);
    setInput("");
    setBusy(true);

    try {
      const api = oddApi();
      if (!isDesktop() || !api.homieChat) {
        const msg = "(Studio assistant is local-only right now. Open Desktop mode for in-panel generation.)";
        setChat((c) => [...c, { role: "assistant", content: msg, ts: Date.now() }]);
        return;
      }

      const instruction =
        opts?.mode === "pack"
          ? `Build a full production pack for this ${assetLabel(active?.type || "book")} from the current prompt and context. Fill every labeled section, then put the main finished asset under OUTPUT.`
          : opts?.mode === "draft"
            ? `Write the main finished asset only for this ${assetLabel(active?.type || "book")}. Keep it strong and distribution-ready.`
            : opts?.mode === "all"
              ? `Act like a 1-prompt-to-finished-product engine for this ${assetLabel(active?.type || "book")}. Produce the finished core asset, the render briefs, the distribution materials, the monetization angle, and the final ship-ready package in one response.`
              : "Respond as the creative co-pilot for this project.";

      const payloadMsgs = nextChat.slice(-10).map((m) => ({ role: m.role, content: m.content })) as any;
      const res = await api.homieChat({ messages: [{ role: "system", content: `${studioSystemPrompt}\n\n${instruction}` }, ...payloadMsgs] });
      if (!res?.ok) {
        setChat((c) => [...c, { role: "assistant", content: res?.error ? `Error: ${res.error}` : "Studio assistant failed.", ts: Date.now() }]);
        return;
      }

      const reply = String(res.reply || "");
      setChat((c) => [...c, { role: "assistant", content: reply, ts: Date.now() }]);

      if (active && (opts?.mode === "pack" || opts?.mode === "draft" || opts?.mode === "all")) {
        const parsed = parseDistributionFromReply(reply, active);
        const output = extractOutput(reply);
        const next: StudioProject = {
          ...active,
          status: opts?.mode === "draft" ? "Producing" : "Packaging",
          output,
          distribution: {
            ...(active.distribution || {}),
            ...parsed,
            deliverables: parsed.deliverables?.length ? parsed.deliverables : active.distribution?.deliverables || [],
            assetFiles: parsed.assetFiles?.length ? parsed.assetFiles : active.distribution?.assetFiles || [],
            releaseChecklist: parsed.releaseChecklist?.length ? parsed.releaseChecklist : active.distribution?.releaseChecklist || [],
            publishTargets: parsed.publishTargets?.length ? parsed.publishTargets : active.distribution?.publishTargets || [],
            monetization: parsed.monetization || active.distribution?.monetization || "",
          },
          updatedAt: Date.now(),
        };
        if (next.type === "book") {
          const title = chapter?.title || `Chapter ${next.chapters.length || 1}`;
          const chapters2 = next.chapters.length
            ? next.chapters.map((c, i) => (i === safeChapterIdx ? { ...c, draft: output || c.draft || "" } : c))
            : [{ title, notes: next.prompt || "", draft: output }];
          next.chapters = chapters2;
        }
        upsert(next);
      }
    } catch (e: any) {
      setChat((c) => [...c, { role: "assistant", content: e?.message || String(e), ts: Date.now() }]);
    } finally {
      setBusy(false);
    }
  };

  const quickGenerate = async () => {
    if (!active) return;
    const seed = [
      `Create a production-ready ${assetLabel(active.type)} from this prompt: ${active.prompt || active.concept || active.notes || active.title}`,
      active.audience ? `Audience: ${active.audience}` : "",
      active.style ? `Style: ${active.style}` : "",
      active.format ? `Format: ${active.format}` : "",
      `Media guidance: ${mediaSpecificGuidance(active.type)}`,
    ].filter(Boolean).join("\n");
    await send(seed, { mode: pipelineMode === "all" ? "all" : "pack" });
  };


const flowRuns = useMemo(() => {
  void flowTick;
  return listOnePromptFlowRuns();
}, [flowTick]);

const runSinglePromptShipFlow = async () => {
  if (!active) return;
  await quickGenerate();
  const latestProjects = loadJSON<StudioProject[]>(KEY_PROJECTS, []);
  const latest = latestProjects.find((p) => p.id === active.id) || active;
  const files = buildArtifactFiles(latest);
  const handoff = buildHandoff(latest, files);
  saveJSON(KEY_HANDOFF, handoff);
  saveJSON(KEY_LAST_BUNDLE, { at: Date.now(), title: latest.title, type: latest.type, files: files.length, root: handoff.bundleName, mode: "one-prompt-flow" });
  const result = runOnePromptFlow({
    handoff,
    autoPublish: autoPublishEnabled,
    autoDraftProducts: trackRevenueEnabled,
    publishMode: autoPublishEnabled ? "assisted" : "manual",
  });
  setFlowTick((x) => x + 1);
  toast(result.summary, "ok");
  onNavigate(autoPublishEnabled ? "PublisherHub" : "RenderLab");
};

  const insertLastAssistantIntoOutput = () => {
    if (!active) return;
    const last = [...chat].reverse().find((m) => m.role === "assistant");
    if (!last?.content) return;
    const next = { ...active, output: (active.output || "") + ((active.output || "") ? "\n\n" : "") + last.content, updatedAt: Date.now() };
    upsert(next);
  };

  const copyText = async (text: string, okText: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      toast(okText, "ok");
    } catch {}
  };

  const handoffTo = async (panelId: string) => {
    if (!active) return;
    const files = buildArtifactFiles(active);
    const handoff = buildHandoff(active, files);
    saveJSON(KEY_HANDOFF, handoff);
    saveJSON(KEY_LAST_BUNDLE, { at: Date.now(), panelId, title: active.title, type: active.type, files: files.length });
    toast(`Prepared ${files.length} studio artifacts for ${panelId}.`, "ok");
    onNavigate(panelId);
  };

  const exportBundle = async (mode: "zip" | "folder") => {
    if (!active) return;
    setBundleBusy(true);
    try {
      const files = buildArtifactFiles(active);
      const root = `${slugify(active.title)}-studio-pack`;
      const handoff = buildHandoff(active, files);
      saveJSON(KEY_HANDOFF, handoff);
      saveJSON(KEY_LAST_BUNDLE, { at: Date.now(), title: active.title, type: active.type, files: files.length, root });
      if (mode === "zip") {
        await downloadZip(`${root}.zip`, files, root);
        toast(`Downloaded ${files.length} studio artifacts as ZIP.`, "ok");
      } else {
        await exportToFolderBrowser(root, files);
        toast(`Exported ${files.length} studio artifacts to folder.`, "ok");
      }
    } catch (e: any) {
      toast(`Bundle export failed: ${e?.message || String(e)}`, "warn");
    } finally {
      setBundleBusy(false);
    }
  };

  const exportBundleManifest = () => {
    if (!active) return;
    const files = buildArtifactFiles(active);
    const manifest = files.map((f) => f.path).join("\n");
    downloadTextFile(`${slugify(active.title)}-artifact-manifest.txt`, manifest);
  };

  const exportProjectMarkdown = (project: StudioProject) => buildProjectMarkdown(project);

  return (
    <div className="panelRoot">
      <PanelHeader
        title="✍️ FairlyOdd Studio"
        subtitle="1 prompt → finished product engine for books, music, art, video, cartoons, and social packs."
        panelId="Books"
        storagePrefix="oddengine:studio"
        showCopilot
      />

      <div className="writersGrid">
        <div className="writersLeft">
          <CardFrame title="Studio Library" subtitle="Recovered projects + new production lanes" storageKey="writers:library" className="softCard" defaultFloating={false}>
            <div className="cluster wrap spread">
              <div className="studioInlineSelect">
                <select className="input" value={quickType} onChange={(e) => setQuickType(e.target.value as AssetType)}>
                  <option value="book">Book</option>
                  <option value="music">Music</option>
                  <option value="art">Art</option>
                  <option value="video">Video</option>
                  <option value="cartoon">Cartoon</option>
                  <option value="social">Social Pack</option>
                </select>
                <button
                  className="tabBtn"
                  onClick={() => {
                    const p = createProject(quickType);
                    upsert(p);
                    setActiveId(p.id);
                    saveJSON(KEY_ACTIVE, p.id);
                    setActiveChapterIdx(0);
                  }}
                >
                  Add project
                </button>
              </div>
              <div className="small">{projects.length} total</div>
            </div>

            <div className="grid">
              {projects.length === 0 ? (
                <div className="small">No studio projects yet. Create one and turn a single prompt into a finished asset pack.</div>
              ) : (
                projects.map((p) => (
                  <div key={p.id} className="cluster spread">
                    <button
                      className={`tabBtn ${active?.id === p.id ? "active" : ""}`}
                      style={{ flex: 1, textAlign: "left" }}
                      onClick={() => {
                        setActiveId(p.id);
                        saveJSON(KEY_ACTIVE, p.id);
                        setActiveChapterIdx(0);
                      }}
                    >
                      <b>{p.title}</b>
                      <span className="small" style={{ marginLeft: 10 }}>
                        {assetLabel(p.type)} • {p.status}
                      </span>
                    </button>
                    <button className="tabBtn" onClick={() => remove(p.id)} title="Remove">✕</button>
                  </div>
                ))
              )}
            </div>
          </CardFrame>

          <CardFrame title="Pipeline Launch" subtitle="Push the current project into render, assets, publishing, money, or final distribution handoff" storageKey="writers:tools" className="softCard" defaultCollapsed={false}>
            <div className="row wrap">
              <button className="tabBtn" onClick={() => handoffTo("RenderLab")} disabled={!active}>🎞️ Render Lab</button>
              <button className="tabBtn" onClick={() => handoffTo("PublisherHub")} disabled={!active}>🚀 Publisher Hub</button>
              <button className="tabBtn" onClick={() => handoffTo("Money")} disabled={!active}>💵 Distribution</button>
              <button className="tabBtn" onClick={() => handoffTo("Brain")} disabled={!active}>🧠 Brain / Notes</button>
              <button className="tabBtn" onClick={() => handoffTo("Calendar")} disabled={!active}>📅 Deadlines</button>
            </div>
            <div className="row wrap mt-4">
              <label className="small"><input type="checkbox" checked={autoPublishEnabled} onChange={(e) => setAutoPublishEnabled(e.target.checked)} /> Auto Publish</label>
              <label className="small"><input type="checkbox" checked={trackRevenueEnabled} onChange={(e) => setTrackRevenueEnabled(e.target.checked)} /> Track Revenue</label>
              <button className="tabBtn" onClick={runSinglePromptShipFlow} disabled={!active || busy}>Run Full Auto Pipeline</button>
            </div>
            <div className="note">
              This pass turns Writers Lounge into a studio pipeline. The desk now builds a handoff pack with render briefs, output files, metadata, distribution materials, publish queue metadata, and money-tracking hooks from one prompt.
            </div>
          </CardFrame>

<CardFrame title="One Prompt Flow" subtitle="Studio → Render Lab → Publisher Hub → Outcomes" storageKey="writers:onePromptFlow" className="softCard" defaultCollapsed={false}>
  <div className="row wrap">
    <button className="tabBtn" disabled={busy || !active} onClick={runSinglePromptShipFlow}>Run 1 prompt flow</button>
    <button className="tabBtn" onClick={() => onNavigate("RenderLab")}>Open Render Lab</button>
    <button className="tabBtn" onClick={() => onNavigate("PublisherHub")}>Open Publisher Hub</button>
  </div>
  <div className="note mt-4">
    One click now generates the pack, saves the handoff, creates a Render Lab job, creates a Publisher Hub job, optionally auto-publishes it, and drafts product listings from winners.
  </div>
  <div className="grid mt-4">
    {(flowRuns || []).slice(0, 3).map((run) => (
      <div key={run.runId} className="studioPipelineCard">
        <div className="cluster spread">
          <div>
            <div className="h">{run.handoff?.title || "Untitled flow"}</div>
            <div className="small">{new Date(run.handoff?.generatedAt || Date.now()).toLocaleString()}</div>
          </div>
          <span className="studioPill">{run.published ? "published" : "packaged"}</span>
        </div>
        <div className="small mt-2">{run.summary}</div>
      </div>
    ))}
    {!flowRuns?.length ? <div className="small">No 1 prompt runs yet.</div> : null}
  </div>
</CardFrame>
        </div>

        <div className="writersCenter">
          <div className="card softCard">
            <div className="cluster wrap spread">
              <div>
                <div className="h">Production Desk</div>
                <div className="sub">Single prompt in. Core asset + render briefs + launch pack out.</div>
              </div>
              <div className="tabs">
                <button className={"tabBtn " + (tab === "desk" ? "active" : "")} onClick={() => setTab("desk")}>Desk</button>
                <button className={"tabBtn " + (tab === "outline" ? "active" : "")} onClick={() => { if (active?.type === "book") ensureChapter(); setTab("outline"); }}>Structure</button>
                <button className={"tabBtn " + (tab === "pipeline" ? "active" : "")} onClick={() => setTab("pipeline")}>Pipeline</button>
                <button className={"tabBtn " + (tab === "export" ? "active" : "")} onClick={() => setTab("export")}>Export</button>
              </div>
            </div>

            {!active ? (
              <div className="note mt-5">Pick a project from the Studio Library to start producing.</div>
            ) : (
              <div className="grid mt-5">
                <div className="studioMetaGrid">
                  <input className="input" value={active.title} onChange={(e) => upsert({ ...active, title: e.target.value, updatedAt: Date.now() })} placeholder="Project title" />
                  <select className="input" value={active.type} onChange={(e) => upsert({ ...active, type: e.target.value as AssetType, updatedAt: Date.now() })}>
                    <option value="book">Book</option>
                    <option value="music">Music</option>
                    <option value="art">Art</option>
                    <option value="video">Video</option>
                    <option value="cartoon">Cartoon</option>
                    <option value="social">Social Pack</option>
                  </select>
                  <select className="input" value={active.status} onChange={(e) => upsert({ ...active, status: e.target.value as Stage, updatedAt: Date.now() })}>
                    {(["Idea", "Planning", "Producing", "Packaging", "Ready", "Published"] as const).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {tab === "desk" && (
                  <>
                    <input className="input" value={active.subtitle || ""} onChange={(e) => upsert({ ...active, subtitle: e.target.value, updatedAt: Date.now() })} placeholder="Tagline / subtitle" />
                    <textarea className="input" style={{ minHeight: 110 }} value={active.prompt || ""} onChange={(e) => upsert({ ...active, prompt: e.target.value, concept: active.concept || e.target.value, updatedAt: Date.now() })} placeholder="Single master prompt: what should this desk create and ship?" />
                    <div className="studioMetaGrid">
                      <input className="input" value={active.audience || ""} onChange={(e) => upsert({ ...active, audience: e.target.value, updatedAt: Date.now() })} placeholder="Audience" />
                      <input className="input" value={active.style || ""} onChange={(e) => upsert({ ...active, style: e.target.value, updatedAt: Date.now() })} placeholder="Style / tone" />
                      <input className="input" value={active.format || ""} onChange={(e) => upsert({ ...active, format: e.target.value, updatedAt: Date.now() })} placeholder="Format / deliverable style" />
                    </div>
                    <textarea className="input" style={{ minHeight: 90 }} value={active.notes || ""} onChange={(e) => upsert({ ...active, notes: e.target.value, updatedAt: Date.now() })} placeholder="Notes, constraints, branding, character ideas, monetization angle..." />

                    <div className="cluster wrap spread">
                      <div className="small">
                        Output: <b>{outputWords}</b> words • ~{outputMinutes} min read • <b>{assetLabel(active.type)}</b>
                      </div>
                      <div className="row wrap studioInlineSelect">
                        <select className="input" value={pipelineMode} onChange={(e) => setPipelineMode(e.target.value as any)} style={{ width: 180 }}>
                          <option value="all">1 prompt → full engine</option>
                          <option value="pack">Pack only</option>
                          <option value="draft">Core asset only</option>
                        </select>
                        <button className="tabBtn" disabled={busy || !(active.prompt || active.notes || active.title)} onClick={quickGenerate}>Generate now</button>
                        <button className="tabBtn" disabled={busy || !(active.prompt || active.notes || active.title)} onClick={runSinglePromptShipFlow}>1 Prompt → Ship It</button>
                        <button className="tabBtn" disabled={busy || !(active.prompt || active.notes || active.title)} onClick={() => send(`Write the main finished ${assetLabel(active.type)} now from this prompt:\n${active.prompt || active.notes || active.title}`, { mode: "draft" })}>Generate main output</button>
                        <button className="tabBtn" onClick={() => copyText(active.prompt || "", "Copied master prompt.")} disabled={!active.prompt}>Copy prompt</button>
                      </div>
                    </div>

                    <textarea className="input studioOutput" value={active.output || ""} onChange={(e) => upsert({ ...active, output: e.target.value, updatedAt: Date.now() })} placeholder="Finished output lands here: manuscript, lyrics, script, storyboard text, post pack, etc." />
                  </>
                )}

                {tab === "outline" && (
                  <>
                    <textarea className="input" style={{ minHeight: 120 }} value={active.concept || ""} onChange={(e) => upsert({ ...active, concept: e.target.value, updatedAt: Date.now() })} placeholder="High-level concept / story arc / campaign direction" />
                    {active.type === "book" ? (
                      <>
                        <div className="cluster wrap spread">
                          <button className="tabBtn" onClick={() => {
                            const next = [...active.chapters, { title: `Chapter ${active.chapters.length + 1}`, notes: "", draft: "" }];
                            upsert({ ...active, chapters: next, updatedAt: Date.now() });
                            setActiveChapterIdx(next.length - 1);
                          }}>Add chapter</button>
                          <div className="small">Book mode keeps chapter drafting alive.</div>
                        </div>
                        <div className="grid mt-4">
                          {active.chapters.map((c, idx) => (
                            <div key={idx} className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
                              <div className="cluster spread">
                                <button className={"tabBtn " + (idx === safeChapterIdx ? "active" : "")} style={{ flex: 1, textAlign: "left" }} onClick={() => setActiveChapterIdx(idx)}>
                                  <b>{c.title}</b>
                                  <span className="small" style={{ marginLeft: 10 }}>{wordCount(c.draft || "")} words</span>
                                </button>
                                <button className="tabBtn" onClick={() => {
                                  const next = active.chapters.filter((_, i) => i !== idx);
                                  upsert({ ...active, chapters: next, updatedAt: Date.now() });
                                  setActiveChapterIdx(Math.max(0, idx - 1));
                                }}>✕</button>
                              </div>
                              <div className="mt-3 grid">
                                <input className="input" value={c.title} onChange={(e) => {
                                  const next = active.chapters.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x));
                                  upsert({ ...active, chapters: next, updatedAt: Date.now() });
                                }} />
                                <textarea className="input" style={{ minHeight: 90 }} value={c.notes || ""} onChange={(e) => {
                                  const next = active.chapters.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x));
                                  upsert({ ...active, chapters: next, updatedAt: Date.now() });
                                }} placeholder="Scene beats / notes" />
                                {idx === safeChapterIdx && (
                                  <textarea className="input" style={{ minHeight: 180 }} value={c.draft || ""} onChange={(e) => {
                                    const next = active.chapters.map((x, i) => (i === idx ? { ...x, draft: e.target.value } : x));
                                    upsert({ ...active, chapters: next, updatedAt: Date.now() });
                                  }} placeholder="Draft text" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="grid">
                        <textarea className="input" style={{ minHeight: 120 }} value={active.distribution?.script || ""} onChange={(e) => upsert({ ...active, distribution: { ...(active.distribution || {}), script: e.target.value }, updatedAt: Date.now() })} placeholder="Script / storyboard / lyric sheet / shot list" />
                        <textarea className="input" style={{ minHeight: 100 }} value={(active.distribution?.deliverables || []).join("\n")} onChange={(e) => upsert({ ...active, distribution: { ...(active.distribution || {}), deliverables: e.target.value.split(/\n+/).map((x) => x.trim()).filter(Boolean) }, updatedAt: Date.now() })} placeholder="One deliverable per line" />
                      </div>
                    )}
                  </>
                )}

                {tab === "pipeline" && (
                  <>
                    <div className="studioPipelineGrid">
                      <div className="studioPipelineCard">
                        <div className="small">Core engine</div>
                        <div className="h">Finished asset</div>
                        <div className="small">Main output, chapters or script, and type-specific core content.</div>
                        <div className="studioPillRow">
                          <span className="studioPill">{assetLabel(active.type)}</span>
                          <span className="studioPill">{outputWords} words</span>
                        </div>
                      </div>
                      <div className="studioPipelineCard">
                        <div className="small">Render Lab handoff</div>
                        <div className="h">Visual / audio / motion briefs</div>
                        <div className="small">Prepared for art, video, thumbnail, cover, or soundtrack generation.</div>
                        <div className="studioPillRow">
                          <span className="studioPill">{(active.distribution?.assetFiles || []).length || artifactFiles.length} files</span>
                          <span className="studioPill">Builder-ready</span>
                        </div>
                      </div>
                      <div className="studioPipelineCard">
                        <div className="small">Distribution handoff</div>
                        <div className="h">Captions, hooks, hashtags, targets</div>
                        <div className="small">Everything needed to launch, list, post, or pass downstream.</div>
                        <div className="studioPillRow">
                          <span className="studioPill">{(active.distribution?.publishTargets || []).length} targets</span>
                          <span className="studioPill">{(active.distribution?.releaseChecklist || []).length} checks</span>
                        </div>
                      </div>
                    </div>

                    <div className="studioExportBlock">
                      <div className="small">Render / asset brief preview</div>
                      <pre>{[active.distribution?.artBrief, active.distribution?.audioBrief, active.distribution?.videoBrief].filter(Boolean).join("\n\n") || "Generate the full engine pack to produce render-ready briefs."}</pre>
                    </div>

                    <div className="studioExportBlock">
                      <div className="small">Distribution preview</div>
                      <pre>{distributionMarkdown(active.distribution) || "Generate the full engine pack to produce distribution materials."}</pre>
                    </div>

                    <div className="row wrap">
                      <button className="tabBtn" disabled={busy || !(active.prompt || active.notes || active.title)} onClick={() => send(`Run the full 1-prompt engine now for this ${assetLabel(active.type)}. Build the finished output, asset files, render briefs, and launch materials all together.`, { mode: "all" })}>Run full engine</button>
                      <button className="tabBtn" onClick={() => handoffTo("RenderLab")} disabled={!active}>Send to Render Lab</button>
                      <button className="tabBtn" onClick={() => handoffTo("PublisherHub")} disabled={!active}>Send to Publisher Hub</button>
                      <button className="tabBtn" onClick={() => handoffTo("Money")} disabled={!active}>Send to Distribution</button>
                    </div>
                  </>
                )}

                {tab === "export" && (
                  <>
                    <div className="note">Download a real studio artifact pack or push the handoff into the next OddEngine lanes.</div>
                    <div className="row wrap">
                      <button className="tabBtn" onClick={() => copyText(exportProjectMarkdown(active), "Copied full studio project markdown.")}>Copy full pack</button>
                      <button className="tabBtn" onClick={() => copyText(active.output || "", "Copied finished output.")} disabled={!active.output}>Copy finished output</button>
                      <button className="tabBtn" onClick={() => copyText(distributionMarkdown(active.distribution), "Copied distribution pack.")} disabled={!distributionMarkdown(active.distribution)}>Copy distribution pack</button>
                      <button className="tabBtn" onClick={() => copyText(JSON.stringify(active, null, 2), "Copied studio project JSON.")}>Copy project JSON</button>
                      <button className="tabBtn" onClick={() => { if (!active) return; const files = buildArtifactFiles(active); const handoff = buildHandoff(active, files); queueAutoProductionLoop({ handoff, mode: autoPublishEnabled ? "full-auto" : "assisted", autoPublish: autoPublishEnabled }); toast("Queued publish loop from export tab.", "ok"); }}>Queue publish loop</button>
                    </div>
                    <div className="row wrap mt-4">
                      <button className="tabBtn" disabled={bundleBusy} onClick={() => exportBundle("zip")}>Download artifact ZIP</button>
                      <button className="tabBtn" disabled={bundleBusy} onClick={() => exportBundle("folder")}>Export artifact folder</button>
                      <button className="tabBtn" onClick={exportBundleManifest}>Download manifest</button>
                    </div>

                    <div className="studioExportBlock mt-4">
                      <div className="small">Artifact bundle preview</div>
                      <pre>{artifactFiles.map((f) => f.path).join("\n") || "No artifact files yet."}</pre>
                    </div>

                    <div className="studioExportBlock mt-4">
                      <div className="small">Handoff preview</div>
                      <pre>{handoffPreview ? JSON.stringify(handoffPreview, null, 2) : "No handoff ready."}</pre>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="writersRight">
          <div className="card softCard">
            <div className="cluster wrap spread">
              <div>
                <div className="h">Studio Copilot</div>
                <div className="sub">Outline, generate, package, and prep render + distribution from one conversation.</div>
              </div>
              <div className="row wrap">
                <button className="tabBtn" onClick={() => setChat([])}>Clear</button>
                <button className="tabBtn" onClick={insertLastAssistantIntoOutput} disabled={!active}>Insert → output</button>
              </div>
            </div>

            <div className="writersPromptRow mt-4">
              <button className="tabBtn" onClick={() => send(`Give me 3 strong directions for this ${assetLabel(active?.type || "book")}. Keep them commercial and memorable.`)} disabled={!active}>3 directions</button>
              <button className="tabBtn" onClick={() => send(`Package this project for distribution with launch hooks, deliverables, publish targets, and asset files.`, { mode: "pack" })} disabled={!active || busy}>Pack it</button>
              <button className="tabBtn" onClick={() => send(`Give me 5 title and tagline ideas for this ${assetLabel(active?.type || "book")}.`)} disabled={!active}>Titles</button>
              <button className="tabBtn" onClick={() => send(`Write promo copy for this ${assetLabel(active?.type || "book")}: short, medium, and long versions.`)} disabled={!active}>Promo</button>
            </div>

            <div className="writersChat mt-4">
              {chat.length ? chat.map((m, i) => (
                <div key={i} className={"writersBubble " + (m.role === "user" ? "user" : "assistant")} title={new Date(m.ts).toLocaleString()}>{m.content}</div>
              )) : (
                <div className="small" style={{ opacity: 0.85 }}>
                  Ask for a full production pack, finished lyrics, video scripts, image prompt packs, book chapters, or a social campaign that is ready to ship.
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="cluster mt-4">
              <input
                className="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={busy ? "Thinking…" : "Ask Studio Copilot"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <button className="tabBtn" disabled={busy} onClick={() => send(input)}>Send</button>
            </div>

            {!isDesktop() && (
              <div className="note">
                Running Web mode. For in-panel AI generation, use Desktop mode or open Homie.
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
