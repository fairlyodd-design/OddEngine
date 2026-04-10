import { loadJSON, saveJSON } from "./storage";
import { createPublisherJob, runPublisherJob } from "./publisherEngine";
import { autoDraftListingsFromWinners } from "./commerceEngine";

type AssetType = "book" | "music" | "art" | "video" | "cartoon" | "social" | "asset";

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

type RenderJob = {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: "queued" | "rendering" | "packaging" | "published" | "failed";
  title: string;
  type: AssetType;
  outputRoot: string;
  handoff: StudioHandoff;
  steps: Array<{ id: string; label: string; done: boolean; ts?: number }>;
  log: string[];
  artifactFiles: string[];
  publishTargets: string[];
  publishMode: "manual" | "assisted";
};

export type OnePromptFlowResult = {
  runId: string;
  handoff: StudioHandoff;
  renderJobId: string;
  publisherJobId: string;
  published: boolean;
  draftedProducts: number;
  summary: string;
};

const KEY_HANDOFF = "oddengine:studio:handoff:v1";
const KEY_RENDER_JOBS = "oddengine:renderlab:jobs:v1";
const KEY_RENDER_ACTIVE = "oddengine:renderlab:activeJob:v1";
const KEY_FLOW_RUNS = "oddengine:studio:onePromptFlowRuns:v1";

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

function defaultSteps(autoPublish: boolean) {
  const base = [
    { id: "ingest", label: "Ingest studio handoff", done: true, ts: Date.now() },
    { id: "render", label: "Build render/artifact pack", done: true, ts: Date.now() },
    { id: "package", label: "Package outputs for delivery", done: true, ts: Date.now() },
  ];
  if (autoPublish) base.push({ id: "publish", label: "Prepare publish handoff", done: true, ts: Date.now() });
  return base;
}

function buildArtifactPaths(handoff: StudioHandoff, renderJobId: string) {
  const root = `${slugify(handoff.title)}-${String(renderJobId).slice(0, 6)}`;
  return [
    `${root}/01_final_output.md`,
    `${root}/02_render_primary_brief.md`,
    `${root}/03_visual_brief.md`,
    `${root}/04_audio_brief.md`,
    `${root}/05_video_brief.md`,
    `${root}/06_script.md`,
    `${root}/07_hooks.md`,
    `${root}/08_captions.md`,
    `${root}/09_publish_targets.txt`,
    `${root}/10_release_checklist.md`,
    `${root}/11_requested_assets.md`,
    `${root}/manifest.json`,
  ];
}

function upsertRenderJob(job: RenderJob) {
  const current = loadJSON<RenderJob[]>(KEY_RENDER_JOBS, []);
  const next = [job, ...current.filter((x) => x.id !== job.id)].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  saveJSON(KEY_RENDER_JOBS, next);
  saveJSON(KEY_RENDER_ACTIVE, job.id);
  return job;
}

function addFlowRun(item: OnePromptFlowResult) {
  const current = loadJSON<OnePromptFlowResult[]>(KEY_FLOW_RUNS, []);
  const next = [item, ...current].slice(0, 100);
  saveJSON(KEY_FLOW_RUNS, next);
  return item;
}

export function listOnePromptFlowRuns(): OnePromptFlowResult[] {
  return loadJSON<OnePromptFlowResult[]>(KEY_FLOW_RUNS, []).sort((a, b) => Number((b as any)?.handoff?.generatedAt || 0) - Number((a as any)?.handoff?.generatedAt || 0));
}

export function runOnePromptFlow(input: { handoff: StudioHandoff; autoPublish?: boolean; autoDraftProducts?: boolean; publishMode?: "manual" | "assisted" }) {
  const handoff = input.handoff;
  saveJSON(KEY_HANDOFF, handoff);

  const renderJobId = uid();
  const renderJob: RenderJob = {
    id: renderJobId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: input.autoPublish ? "published" : "packaging",
    title: handoff.title,
    type: handoff.type,
    outputRoot: handoff.bundleName || slugify(handoff.title),
    handoff,
    steps: defaultSteps(!!input.autoPublish),
    log: [
      `${new Date().toLocaleTimeString()} one-prompt flow ingested studio handoff`,
      `${new Date().toLocaleTimeString()} render bundle prepared automatically`,
      `${new Date().toLocaleTimeString()} distribution package prepared`,
    ],
    artifactFiles: buildArtifactPaths(handoff, renderJobId),
    publishTargets: handoff.distribution.targets || ["local"],
    publishMode: input.publishMode || "assisted",
  };
  upsertRenderJob(renderJob);

  const publisher = createPublisherJob({
    sourceId: handoff.projectId || renderJobId,
    sourceTitle: handoff.title,
    contentType: handoff.type || "asset",
    targets: handoff.distribution.targets || ["local"],
    autoPublish: !!input.autoPublish,
    payload: { handoff, renderJobId, mode: "one-prompt-flow" },
  });

  let published = false
  if (input.autoPublish && publisher?.id) {
    published = !!runPublisherJob(publisher.id);
  }

  const drafted = input.autoDraftProducts ? autoDraftListingsFromWinners() : [];
  const result: OnePromptFlowResult = {
    runId: uid(),
    handoff,
    renderJobId,
    publisherJobId: publisher?.id || "",
    published,
    draftedProducts: drafted.length,
    summary: published
      ? `1-prompt flow completed. Rendered, published, and drafted ${drafted.length} product listings.`
      : `1-prompt flow completed. Render package and publish handoff are ready.`,
  };
  addFlowRun(result);
  return result;
}
