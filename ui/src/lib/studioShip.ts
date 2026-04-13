import { loadJSON, saveJSON } from "./storage";
import { isDesktop, oddApi } from "./odd";
import { createPublisherJob, runPublisherJob } from "./publisherEngine";
import { autoDraftListingsFromWinners } from "./commerceEngine";

type AssetType = "book" | "music" | "art" | "video" | "cartoon" | "social";

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

type RenderWorker = { id: string; label: string; kind: string; status: string; outputs?: string[]; startedAt?: number | null; completedAt?: number | null };
type BackendArtifact = { path: string; bytes?: number; updatedAt?: number };

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
  backendArtifacts?: BackendArtifact[];
  workerStates?: RenderWorker[];
  publishTargets: string[];
  publishMode: "manual" | "assisted";
  backendJobId?: string;
};

type ProviderConfig = {
  enabled: boolean;
  mode: "stub" | "webhook" | "a1111" | "bark" | "comfyui" | "legacy-local";
  endpoint: string;
  model: string;
  healthPath: string;
  timeoutMs: number;
};

type RenderSettings = {
  backendUrl: string;
  autoPublish: boolean;
  autoExecuteWorkers: boolean;
  exportMode: "zip" | "folder";
  publishMode: "manual" | "assisted";
  providerBridge: {
    image: ProviderConfig;
    audio: ProviderConfig;
    video: ProviderConfig;
  };
};

type ReleaseAsset = {
  path?: string;
  url?: string;
  downloadUrl?: string;
  absoluteUrl?: string;
  absoluteDownloadUrl?: string;
  bytes?: number;
  updatedAt?: number;
};

type ReleasePayload = {
  ok?: boolean;
  release?: {
    video?: ReleaseAsset | null;
    poster?: ReleaseAsset | null;
    audio?: ReleaseAsset | null;
    summary?: ReleaseAsset | null;
    transcript?: ReleaseAsset | null;
  };
  artifacts?: BackendArtifact[];
  job?: any;
};

export type StudioShipReceipt = {
  runId: string;
  title: string;
  handoff: StudioHandoff;
  job: RenderJob;
  backendJobId?: string;
  publisherJobId?: string;
  published: boolean;
  draftedProducts: number;
  release?: ReleasePayload["release"] | null;
  summary: string;
};

const KEY_JOBS = "oddengine:renderlab:jobs:v1";
const KEY_ACTIVE = "oddengine:renderlab:activeJob:v1";
const KEY_SETTINGS = "oddengine:renderlab:settings:v1";
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

function defaultRenderSettings(): RenderSettings {
  return {
    backendUrl: "http://127.0.0.1:8899",
    autoPublish: true,
    autoExecuteWorkers: true,
    exportMode: "zip",
    publishMode: "assisted",
    providerBridge: {
      image: { enabled: false, mode: "stub", endpoint: "", model: "", healthPath: "/health", timeoutMs: 30000 },
      audio: { enabled: false, mode: "stub", endpoint: "", model: "", healthPath: "/health", timeoutMs: 45000 },
      video: { enabled: true, mode: "legacy-local", endpoint: "", model: "FFmpeg local runtime", healthPath: "/health", timeoutMs: 180000 },
    },
  };
}

function loadRenderLabSettings(): RenderSettings {
  const base = defaultRenderSettings();
  const raw = loadJSON<Partial<RenderSettings>>(KEY_SETTINGS, {} as any) || {};
  return {
    ...base,
    ...raw,
    providerBridge: {
      image: { ...base.providerBridge.image, ...(raw.providerBridge?.image || {}) },
      audio: { ...base.providerBridge.audio, ...(raw.providerBridge?.audio || {}) },
      video: { ...base.providerBridge.video, ...(raw.providerBridge?.video || {}) },
    },
  };
}

function defaultSteps(autoPublish: boolean) {
  const base = [
    { id: "ingest", label: "Ingest studio handoff", done: true, ts: Date.now() },
    { id: "render", label: "Build render/artifact pack", done: false },
    { id: "package", label: "Package outputs for delivery", done: false },
  ];
  if (autoPublish) base.push({ id: "publish", label: "Prepare publish handoff", done: false });
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

function appendLog(job: RenderJob, text: string): RenderJob {
  return {
    ...job,
    updatedAt: Date.now(),
    log: [`${new Date().toLocaleTimeString()} ${text}`, ...(job.log || [])].slice(0, 120),
  };
}

function upsertRenderJob(job: RenderJob) {
  const current = loadJSON<RenderJob[]>(KEY_JOBS, []);
  const next = [job, ...current.filter((x) => x.id !== job.id)].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  saveJSON(KEY_JOBS, next);
  saveJSON(KEY_ACTIVE, job.id);
  return job;
}

function mergeBackendJob(local: RenderJob, backendJob: any, backendArtifacts?: any[]): RenderJob {
  const artifacts = Array.isArray(backendArtifacts) ? backendArtifacts : Array.isArray(backendJob?.artifacts) ? backendJob.artifacts : [];
  return {
    ...local,
    updatedAt: Number(backendJob?.updatedAt || Date.now()),
    status: (backendJob?.status || local.status) as any,
    backendArtifacts: artifacts,
    artifactFiles: artifacts.length ? artifacts.map((x: any) => x.path) : local.artifactFiles,
    workerStates: Array.isArray(backendJob?.workers) ? backendJob.workers : local.workerStates,
    log: Array.isArray(backendJob?.log) && backendJob.log.length ? backendJob.log : local.log,
  };
}

async function readBackendJson(url: string, init?: RequestInit): Promise<any> {
  if (isDesktop()) {
    const res = await oddApi().fetchText({
      url,
      method: init?.method || "GET",
      headers: (init?.headers || {}) as any,
      body: typeof init?.body === "string" ? init.body : undefined,
      timeoutMs: 20000,
      maxBytes: 1_000_000,
    });
    if (!res?.ok) throw new Error(res?.error || `Request failed: ${url}`);
    return res?.text ? JSON.parse(res.text) : {};
  }
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function saveFlowRun(item: { runId: string; handoff: StudioHandoff; renderJobId: string; publisherJobId: string; published: boolean; draftedProducts: number; summary: string }) {
  const current = loadJSON<any[]>(KEY_FLOW_RUNS, []);
  saveJSON(KEY_FLOW_RUNS, [item, ...current].slice(0, 100));
}

export async function shipStudioHandoffToFinishedProduct(input: {
  handoff: StudioHandoff;
  autoPublish?: boolean;
  trackRevenue?: boolean;
}): Promise<StudioShipReceipt> {
  const handoff = input.handoff;
  const settings = loadRenderLabSettings();
  const autoPublish = !!input.autoPublish;
  let job: RenderJob = {
    id: uid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "queued",
    title: handoff.title,
    type: handoff.type,
    outputRoot: handoff.bundleName || slugify(handoff.title),
    handoff,
    steps: defaultSteps(autoPublish),
    log: [`${new Date().toLocaleTimeString()} queued from Writers Lounge one-prompt flow`],
    artifactFiles: buildArtifactPaths(handoff, uid()),
    publishTargets: handoff.distribution.targets || ["local"],
    publishMode: autoPublish ? settings.publishMode : "manual",
  };
  upsertRenderJob(job);

  const base = (settings.backendUrl || "").replace(/\/$/, "");
  let release: ReleasePayload["release"] | null = null;
  let publisherJobId = "";
  let published = false;
  let draftedProducts = 0;

  if (base) {
    try {
      job = appendLog(job, "sending real handoff to render backend");
      job.status = "rendering";
      upsertRenderJob(job);
      const created = await readBackendJson(`${base}/render/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handoff,
          autoPublish,
          publishMode: autoPublish ? settings.publishMode : "manual",
          executeNow: false,
          providerBridge: settings.providerBridge,
        }),
      });
      if (created?.ok && created?.jobId) {
        job.backendJobId = created.jobId;
        job.workerStates = Array.isArray(created?.workers) ? created.workers : [];
        job.steps = job.steps.map((s) => s.id === "ingest" ? { ...s, done: true, ts: Date.now() } : s);
        job = appendLog(job, `backend accepted job ${created.jobId}`);
        upsertRenderJob(job);

        if (settings.autoExecuteWorkers) {
          const ran = await readBackendJson(`${base}/render/jobs/${encodeURIComponent(created.jobId)}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ providerBridge: settings.providerBridge }),
          });
          if (ran?.ok && ran?.job) {
            job = mergeBackendJob(job, ran.job, ran.artifacts);
            job.steps = job.steps.map((s) => s.id === "render" || s.id === "package" ? { ...s, done: true, ts: Date.now() } : s);
            if (autoPublish) job.steps = job.steps.map((s) => s.id === "publish" ? { ...s, done: true, ts: Date.now() } : s);
            job = appendLog(job, "backend workers executed successfully");
            upsertRenderJob(job);
          }
        } else {
          job = appendLog(job, "backend job created; waiting for manual worker execution");
          upsertRenderJob(job);
        }

        try {
          const rel = await readBackendJson(`${base}/render/jobs/${encodeURIComponent(created.jobId)}/release`);
          release = rel?.release || null;
          if (release?.video) {
            job = appendLog(job, "finished product release is ready");
            upsertRenderJob(job);
          }
        } catch (e: any) {
          job = appendLog(job, `release refresh skipped (${e?.message || String(e)})`);
          upsertRenderJob(job);
        }
      } else {
        job.status = "packaging";
        job.steps = job.steps.map((s) => s.id === "render" || s.id === "package" ? { ...s, done: true, ts: Date.now() } : s);
        job = appendLog(job, "backend did not return a job id; kept local package ready");
        upsertRenderJob(job);
      }
    } catch (e: any) {
      job.status = "packaging";
      job.steps = job.steps.map((s) => s.id === "render" || s.id === "package" ? { ...s, done: true, ts: Date.now() } : s);
      job = appendLog(job, `backend unavailable, package is still ready (${e?.message || String(e)})`);
      upsertRenderJob(job);
    }
  } else {
    job.status = "packaging";
    job.steps = job.steps.map((s) => s.id === "render" || s.id === "package" ? { ...s, done: true, ts: Date.now() } : s);
    job = appendLog(job, "no backend URL configured; package is ready for manual export only");
    upsertRenderJob(job);
  }

  const targets = handoff.distribution.targets?.length ? handoff.distribution.targets : ["local"];
  const publisher = createPublisherJob({
    sourceId: handoff.projectId || job.id,
    sourceTitle: handoff.title,
    contentType: handoff.type || "asset",
    targets,
    autoPublish,
    payload: { handoff, backendJobId: job.backendJobId || "", renderJobId: job.id, mode: "writers-finished-product" },
  });
  publisherJobId = publisher?.id || "";

  if (autoPublish && publisherJobId) {
    published = !!runPublisherJob(publisherJobId);
  }

  if (input.trackRevenue) {
    draftedProducts = autoDraftListingsFromWinners().length;
  }

  const summary = release?.video
    ? `Finished product ready. Real release artifacts were returned${published ? ", publish queue updated" : ""}${draftedProducts ? `, and ${draftedProducts} product drafts were created` : ""}.`
    : job.backendJobId
      ? `Studio asset shipped into Render Lab. Open Render Lab to inspect the backend job and finished release.`
      : `Studio package is ready. Open Render Lab to continue the final media step.`;

  const flowRun = {
    runId: uid(),
    handoff,
    renderJobId: job.id,
    publisherJobId,
    published,
    draftedProducts,
    summary,
  };
  saveFlowRun(flowRun);

  return {
    runId: flowRun.runId,
    title: handoff.title,
    handoff,
    job,
    backendJobId: job.backendJobId || "",
    publisherJobId,
    published,
    draftedProducts,
    release,
    summary,
  };
}
