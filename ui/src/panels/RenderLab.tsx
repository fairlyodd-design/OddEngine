import React, { useEffect, useMemo, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import { addQuickEvent, fmtDate } from "../lib/calendarStore";
import { pushNotif } from "../lib/notifs";
import { loadJSON, saveJSON } from "../lib/storage";
import { downloadTextFile, downloadZip, exportToFolderBrowser, GenFile } from "../lib/files";
import { isDesktop, oddApi } from "../lib/odd";

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
    narrationEnabled?: boolean;
    familyVoiceName?: string;
    narrationText?: string;
    timingMode?: string;
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
  path: string;
  bytes?: number;
  updatedAt?: number;
  url?: string;
  downloadUrl?: string;
  absoluteUrl?: string;
  absoluteDownloadUrl?: string;
};

type ReleasePayload = {
  baseUrl?: string;
  outputRoot?: string;
  artifacts?: BackendArtifact[];
  release: {
    video?: ReleaseAsset | null;
    poster?: ReleaseAsset | null;
    summary?: ReleaseAsset | null;
    captions?: ReleaseAsset | null;
    audio?: ReleaseAsset | null;
    transcript?: ReleaseAsset | null;
  };
};

const KEY_HANDOFF = "oddengine:studio:handoff:v1";
const KEY_JOBS = "oddengine:renderlab:jobs:v1";
const KEY_SETTINGS = "oddengine:renderlab:settings:v1";
const KEY_ACTIVE = "oddengine:renderlab:activeJob:v1";

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

function toneForStatus(status: RenderJob["status"]) {
  if (status === "published") return "good" as const;
  if (status === "failed") return "bad" as const;
  if (status === "queued") return "warn" as const;
  return "warn" as const;
}

function buildFiles(job: RenderJob): GenFile[] {
  const h = job.handoff;
  const root = `${slugify(job.title)}-${job.id.slice(0, 6)}`;
  const targets = (h.distribution.targets || []).join("\n") || "Direct / manual publish";
  const checklist = (h.distribution.checklist || []).map((x, i) => `${i + 1}. ${x}`).join("\n");
  const hooks = (h.distribution.hooks || []).join("\n- ");
  const captions = (h.distribution.captions || []).join("\n\n---\n\n");
  const requestedAssets = (h.renderLab.requestedAssets || []).join("\n- ");
  const manifest = {
    title: h.title,
    type: h.type,
    projectId: h.projectId,
    generatedAt: h.generatedAt,
    bundleName: h.bundleName,
    outputRoot: job.outputRoot,
    renderAssets: h.renderLab.requestedAssets || [],
    publishTargets: h.distribution.targets || [],
    status: job.status,
    backendJobId: job.backendJobId || null,
  };
  return [
    { path: `${root}/01_final_output.md`, content: h.finalOutput || "" },
    { path: `${root}/02_render_primary_brief.md`, content: h.renderLab.primaryBrief || "" },
    { path: `${root}/03_visual_brief.md`, content: h.renderLab.visualBrief || "" },
    { path: `${root}/04_audio_brief.md`, content: h.renderLab.audioBrief || "" },
    { path: `${root}/05_video_brief.md`, content: h.renderLab.videoBrief || "" },
    { path: `${root}/06_script.md`, content: h.renderLab.script || "" },
    { path: `${root}/07_hooks.md`, content: hooks ? `- ${hooks}` : "" },
    { path: `${root}/08_captions.md`, content: captions || "" },
    { path: `${root}/09_publish_targets.txt`, content: targets },
    { path: `${root}/10_release_checklist.md`, content: checklist },
    { path: `${root}/11_requested_assets.md`, content: requestedAssets ? `- ${requestedAssets}` : "" },
    { path: `${root}/manifest.json`, content: JSON.stringify(manifest, null, 2) },
  ];
}

function defaultSteps(autoPublish: boolean) {
  const base = [
    { id: "ingest", label: "Ingest studio handoff", done: false },
    { id: "render", label: "Build render/artifact pack", done: false },
    { id: "package", label: "Package outputs for delivery", done: false },
  ];
  if (autoPublish) base.push({ id: "publish", label: "Prepare publish handoff", done: false });
  return base;
}

export default function RenderLab({ onOpenHowTo, onNavigate }: { onOpenHowTo?: () => void; onNavigate?: (id: string) => void } = {}) {
  const nav = onNavigate || (() => {});
  const desktop = isDesktop();
  const [handoff, setHandoff] = useState<StudioHandoff | null>(() => loadJSON(KEY_HANDOFF, null as any));
  const [jobs, setJobs] = useState<RenderJob[]>(() => loadJSON(KEY_JOBS, []));
  const [activeJobId, setActiveJobId] = useState<string>(() => loadJSON(KEY_ACTIVE, ""));
  const [settings, setSettings] = useState<RenderSettings>(() => loadJSON(KEY_SETTINGS, {
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
  }));
  const [busy, setBusy] = useState(false);
  const [backendState, setBackendState] = useState<{ ok?: boolean; detail?: string; capabilities?: string[]; providers?: Record<string, any> }>({});
  const [releaseState, setReleaseState] = useState<{ loading: boolean; data: ReleasePayload | null; error: string }>({ loading: false, data: null, error: "" });
  const [previewNonce, setPreviewNonce] = useState(0);

  useEffect(() => {
    saveJSON(KEY_SETTINGS, settings);
  }, [settings]);
  useEffect(() => {
    saveJSON(KEY_JOBS, jobs);
  }, [jobs]);
  useEffect(() => {
    saveJSON(KEY_ACTIVE, activeJobId);
  }, [activeJobId]);
  useEffect(() => {
    const onFocus = () => setHandoff(loadJSON(KEY_HANDOFF, null as any));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const activeJob = useMemo(() => jobs.find((j) => j.id === activeJobId) || jobs[0] || null, [jobs, activeJobId]);
  const handoffAge = handoff?.generatedAt ? Math.max(0, Math.round((Date.now() - handoff.generatedAt) / 60000)) : null;

  useEffect(() => {
    if (activeJob?.backendJobId) refreshRelease(activeJob);
    else setReleaseState({ loading: false, data: null, error: "" });
  }, [activeJob?.backendJobId, settings.backendUrl, previewNonce]);

  async function pingBackend() {
    const base = (settings.backendUrl || "").replace(/\/$/, "");
    if (!base) {
      setBackendState({ ok: false, detail: "Set backend URL first." });
      return;
    }
    try {
      let result: any = null;
      if (desktop) {
        result = await oddApi().fetchText({ url: `${base}/health`, timeoutMs: 5000, maxBytes: 100_000 });
        if (result?.ok && result?.text) {
          const parsed = JSON.parse(result.text);
          setBackendState({ ok: !!parsed?.ok, detail: parsed?.service || parsed?.status || "ready", capabilities: parsed?.capabilities || [], providers: parsed?.providers || {} });
          return;
        }
      } else {
        const res = await fetch(`${base}/health`);
        const parsed = await res.json();
        setBackendState({ ok: !!parsed?.ok, detail: parsed?.service || parsed?.status || "ready", capabilities: parsed?.capabilities || [], providers: parsed?.providers || {} });
        return;
      }
      setBackendState({ ok: false, detail: result?.error || "Backend unreachable." });
    } catch (e: any) {
      setBackendState({ ok: false, detail: e?.message || String(e) });
    }
  }

  function upsertJob(job: RenderJob) {
    setJobs((prev) => {
      const next = [job, ...prev.filter((x) => x.id !== job.id)].sort((a, b) => b.updatedAt - a.updatedAt);
      return next;
    });
    setActiveJobId(job.id);
  }

  function appendLog(job: RenderJob, text: string) {
    return { ...job, updatedAt: Date.now(), log: [`${new Date().toLocaleTimeString()} ${text}`, ...(job.log || [])].slice(0, 120) };
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
    if (desktop) {
      const res = await oddApi().fetchText({
        url,
        method: init?.method || "GET",
        headers: (init?.headers || {}) as any,
        body: typeof init?.body === "string" ? init.body : undefined,
        timeoutMs: 20000,
        maxBytes: 500_000,
      });
      if (!res?.ok) throw new Error(res?.error || `Request failed: ${url}`);
      return res?.text ? JSON.parse(res.text) : {};
    }
    const res = await fetch(url, init);
    return await res.json();
  }

  function absolutizeAssetUrl(asset?: ReleaseAsset | null, useDownload = false) {
    const raw = useDownload
      ? (asset?.absoluteDownloadUrl || asset?.downloadUrl || asset?.absoluteUrl || asset?.url || "")
      : (asset?.absoluteUrl || asset?.url || "");
    if (!raw) return "";
    const base = (settings.backendUrl || "").replace(/\/$/, "");
    const abs = /^https?:\/\//i.test(raw) ? raw : `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
    const extra = `previewTs=${encodeURIComponent(String(asset?.updatedAt || Date.now()))}&nonce=${previewNonce}`;
    return `${abs}${abs.includes("?") ? "&" : "?"}${extra}`;
  }

  async function refreshRelease(job?: RenderJob | null) {
    if (!job?.backendJobId) {
      setReleaseState({ loading: false, data: null, error: "" });
      return;
    }
    const base = (settings.backendUrl || "").replace(/\/$/, "");
    if (!base) {
      setReleaseState({ loading: false, data: null, error: "Backend URL is not set." });
      return;
    }
    setReleaseState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await readBackendJson(`${base}/render/jobs/${encodeURIComponent(job.backendJobId)}/release`);
      setReleaseState({ loading: false, data: data as ReleasePayload, error: "" });
    } catch (e: any) {
      setReleaseState({ loading: false, data: null, error: e?.message || String(e) });
    }
  }

  function openAsset(asset?: ReleaseAsset | null, useDownload = false) {
    const url = absolutizeAssetUrl(asset, useDownload);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function queueFromHandoff() {
    if (!handoff) {
      pushNotif({ title: "Render Lab", body: "No studio handoff found yet.", tags: ["RenderLab"], level: "warn" as any });
      return;
    }
    const files = buildFiles({
      id: "preview",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "queued",
      title: handoff.title,
      type: handoff.type,
      outputRoot: handoff.bundleName || slugify(handoff.title),
      handoff,
      steps: defaultSteps(settings.autoPublish),
      log: [],
      artifactFiles: [],
      publishTargets: handoff.distribution.targets || [],
      publishMode: settings.publishMode,
    }).map((f) => f.path);
    const job: RenderJob = {
      id: uid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "queued",
      title: handoff.title,
      type: handoff.type,
      outputRoot: handoff.bundleName || slugify(handoff.title),
      handoff,
      steps: defaultSteps(settings.autoPublish),
      log: [`${new Date().toLocaleTimeString()} queued from studio handoff`],
      artifactFiles: files,
      publishTargets: handoff.distribution.targets || [],
      publishMode: settings.publishMode,
    };
    upsertJob(job);
    pushNotif({ title: "Render Lab", body: `Queued ${handoff.title} for render pipeline.`, tags: ["RenderLab"], level: "good" as any });
  }

  async function runPipeline(job: RenderJob) {
    setBusy(true);
    try {
      let next = appendLog(job, "starting render pipeline");
      next.status = "rendering";
      next.steps = next.steps.map((s, i) => i === 0 ? { ...s, done: true, ts: Date.now() } : s);
      upsertJob(next);

      const base = (settings.backendUrl || "").replace(/\/$/, "");
      let remoteCreated = false;
      if (base) {
        try {
          const created = await readBackendJson(`${base}/render/jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ handoff: next.handoff, autoPublish: settings.autoPublish, publishMode: settings.publishMode, executeNow: false, providerBridge: settings.providerBridge }),
          });
          if (created?.ok && created?.jobId) {
            next.backendJobId = created.jobId;
            next.workerStates = Array.isArray(created?.workers) ? created.workers : [];
            next = appendLog(next, `backend accepted job ${created.jobId}`);
            remoteCreated = true;
            upsertJob(next);

            if (settings.autoExecuteWorkers) {
              const ran = await readBackendJson(`${base}/render/jobs/${created.jobId}/run`, { method: "POST", body: JSON.stringify({ providerBridge: settings.providerBridge }) });
              if (ran?.ok && ran?.job) {
                next = mergeBackendJob(next, ran.job, ran.artifacts);
                next = appendLog(next, "backend workers executed successfully");
                remoteCreated = true;
              }
            } else {
              next = appendLog(next, "backend job created; workers waiting for manual execution");
            }
          }
        } catch (e: any) {
          next = appendLog(next, `backend unavailable, using local packaging path (${e?.message || String(e)})`);
        }
      }

      next.steps = next.steps.map((s, i) => i === 1 ? { ...s, done: true, ts: Date.now() } : s);
      next.status = remoteCreated ? (next.status as any) : "packaging";
      next = appendLog(next, remoteCreated ? "media worker plan completed" : "render bundle prepared locally");
      upsertJob(next);

      const files = buildFiles(next);
      if (settings.exportMode === "folder") {
        try {
          await exportToFolderBrowser(next.outputRoot, files);
          next = appendLog(next, "artifact folder exported");
        } catch (e: any) {
          next = appendLog(next, `folder export skipped (${e?.message || String(e)})`);
        }
      } else {
        await downloadZip(`${next.outputRoot}.zip`, files);
        next = appendLog(next, "artifact zip downloaded");
      }

      next.steps = next.steps.map((s, i) => i === 2 ? { ...s, done: true, ts: Date.now() } : s);
      if (settings.autoPublish) {
        next.steps = next.steps.map((s) => s.id === "publish" ? { ...s, done: true, ts: Date.now() } : s);
        next.status = next.status === "failed" ? next.status : "published";
        next = appendLog(next, settings.publishMode === "assisted" ? "publish handoff prepared for targets" : "manual publish pack ready");
      } else if (next.status !== "published") {
        next.status = "packaging";
      }
      upsertJob(next);
      pushNotif({ title: "Render Lab", body: `${next.title} pipeline completed.`, tags: ["RenderLab"], level: "good" as any });
    } catch (e: any) {
      const failed = appendLog({ ...job, status: "failed" }, `pipeline failed: ${e?.message || String(e)}`);
      upsertJob(failed);
      pushNotif({ title: "Render Lab", body: `Pipeline failed: ${e?.message || String(e)}`, tags: ["RenderLab"], level: "bad" as any });
    } finally {
      setBusy(false);
    }
  }

  async function runBackendWorkers(job: RenderJob) {
    if (!job?.backendJobId) return;
    setBusy(true);
    try {
      const base = (settings.backendUrl || "").replace(/\/$/, "");
      const ran = await readBackendJson(`${base}/render/jobs/${job.backendJobId}/run`, { method: "POST", body: JSON.stringify({ providerBridge: settings.providerBridge }) });
      if (ran?.ok && ran?.job) {
        const merged = appendLog(mergeBackendJob(job, ran.job, ran.artifacts), "manual backend worker run completed");
        upsertJob(merged);
        pushNotif({ title: "Render Lab", body: `${job.title} backend workers finished.`, tags: ["RenderLab"], level: "good" as any });
      }
    } catch (e: any) {
      const failed = appendLog(job, `manual backend run failed (${e?.message || String(e)})`);
      upsertJob(failed);
      pushNotif({ title: "Render Lab", body: `Backend run failed: ${e?.message || String(e)}`, tags: ["RenderLab"], level: "bad" as any });
    } finally {
      setBusy(false);
    }
  }
  function exportActiveManifest() {
    if (!activeJob) return;
    downloadTextFile(`${slugify(activeJob.title)}-renderlab-job.json`, JSON.stringify(activeJob, null, 2));
  }

  function setProvider(kind: "image" | "audio" | "video", patch: Partial<ProviderConfig>) {
    setSettings((prev) => ({
      ...prev,
      providerBridge: {
        ...prev.providerBridge,
        [kind]: { ...prev.providerBridge[kind], ...patch },
      },
    }));
  }

  function applyLocalPreset(kind: "image" | "audio" | "video") {
    if (kind === "image") {
      setProvider("image", {
        enabled: true,
        mode: "a1111",
        endpoint: "http://127.0.0.1:7860",
        model: "AUTOMATIC1111",
        healthPath: "/sdapi/v1/sd-models",
        timeoutMs: 120000,
      });
      pushNotif({ title: "Render Lab", body: "Applied local image preset for AUTOMATIC1111.", tags: ["RenderLab"], level: "good" as any });
      return;
    }
    if (kind === "audio") {
      setProvider("audio", {
        enabled: true,
        mode: "bark",
        endpoint: "http://127.0.0.1:7000",
        model: "Bark wrapper",
        healthPath: "/health",
        timeoutMs: 120000,
      });
      pushNotif({ title: "Render Lab", body: "Applied local audio preset for Bark wrapper.", tags: ["RenderLab"], level: "good" as any });
      return;
    }
    setProvider("video", {
      enabled: true,
      mode: "legacy-local",
      endpoint: "",
      model: "FFmpeg local runtime",
      healthPath: "/health",
      timeoutMs: 180000,
    });
    pushNotif({ title: "Render Lab", body: "Applied local legacy-local video preset.", tags: ["RenderLab"], level: "good" as any });
  }

  function applyAllLocalPresets() {
    applyLocalPreset("image");
    applyLocalPreset("audio");
    applyLocalPreset("video");
  }

  async function saveProviderBridge() {
    const base = (settings.backendUrl || "").replace(/\/$/, "");
    if (!base) return;
    try {
      await readBackendJson(`${base}/providers`, { method: "POST", body: JSON.stringify({ providers: settings.providerBridge }) });
      pushNotif({ title: "Render Lab", body: "Provider bridge settings saved to backend.", tags: ["RenderLab"], level: "good" as any });
      await pingBackend();
    } catch (e: any) {
      pushNotif({ title: "Render Lab", body: `Save failed: ${e?.message || String(e)}`, tags: ["RenderLab"], level: "bad" as any });
    }
  }

  async function probeProviderBridge() {
    const base = (settings.backendUrl || "").replace(/\/$/, "");
    if (!base) return;
    try {
      const result = await readBackendJson(`${base}/providers/probe`, { method: "POST", body: JSON.stringify({ providers: settings.providerBridge }) });
      setBackendState((prev) => ({ ...prev, providers: result?.providers || {} }));
      pushNotif({ title: "Render Lab", body: "Provider bridge probe completed.", tags: ["RenderLab"], level: "good" as any });
    } catch (e: any) {
      pushNotif({ title: "Render Lab", body: `Provider probe failed: ${e?.message || String(e)}`, tags: ["RenderLab"], level: "bad" as any });
    }
  }

  const release = releaseState.data?.release || {};
  const videoPreviewUrl = absolutizeAssetUrl(release.video || null);
  const posterPreviewUrl = absolutizeAssetUrl(release.poster || null);
  const audioPreviewUrl = absolutizeAssetUrl(release.audio || null);

  const badges = [
    { label: handoff ? "Studio handoff ready" : "No handoff", tone: handoff ? "good" : "warn" as any },
    { label: activeJob ? `${activeJob.status}` : "No jobs", tone: activeJob ? toneForStatus(activeJob.status) : "warn" as any },
    { label: desktop ? "Desktop" : "Web", tone: desktop ? "good" : "warn" as any },
  ];

  return (
    <div className="page">
      <PanelHeader
        title="🎞️ Render Lab"
        subtitle="Consumes oddengine:studio:handoff:v1 and runs the render/package/publish chain."
        panelId="RenderLab"
        storagePrefix="oddengine:renderlab"
        showCopilot
        badges={badges as any}
        rightSlot={
          <ActionMenu
            title="Render tools"
            items={[
              { label: "Open Studio", onClick: () => nav("Books") },
              { label: "Queue current handoff", onClick: () => queueFromHandoff(), disabled: !handoff },
              { label: "Add render reminder", onClick: () => { addQuickEvent({ title: "Render Lab: run studio pipeline", panelId: "RenderLab", date: fmtDate(new Date()), notes: "Run render/package/publish flow for latest studio handoff." }); pushNotif({ title: "Render Lab", body: "Added render reminder to Calendar.", tags: ["RenderLab"], level: "good" as any }); } },
              { label: "How to Use", onClick: () => onOpenHowTo?.() },
            ]}
          />
        }
      />

      <PanelScheduleCard
        panelId="RenderLab"
        title="Render schedule"
        subtitle="Keep artifact runs and publish dates visible."
        presets={[
          { label: "+ Run now", title: "Render: run current studio job", notes: "Queue and execute the latest studio handoff." },
          { label: "+ Publish review", title: "Render: publish review", offsetDays: 1, notes: "Review the distribution pack before release." },
          { label: "+ Launch day", title: "Render: launch asset", offsetDays: 2, notes: "Push final pack to chosen channels." },
        ]}
        onNavigate={nav}
      />

      <div className="grid2">
        <div className="card softCard">
          <div className="h">Studio intake</div>
          {!handoff ? (
            <div className="note mt-5">No studio handoff found yet. In FairlyOdd Studio, generate a project pack first, then send it here.</div>
          ) : (
            <>
              <div className="cluster spread mt-5">
                <div>
                  <div><b>{handoff.title}</b></div>
                  <div className="small">{handoff.type} • {handoff.artifactCount} artifacts • {handoffAge} min ago</div>
                </div>
                <button className="tabBtn" onClick={() => queueFromHandoff()}>Queue handoff</button>
              </div>
              <div className="grid mt-5">
                <div className="note"><b>Primary brief</b><br />{handoff.renderLab.primaryBrief || "—"}</div>
                <div className="note"><b>Requested assets</b><br />{(handoff.renderLab.requestedAssets || []).join(", ") || "—"}</div>
                <div className="note"><b>Legacy image beats</b><br />{handoff.renderLab.timingMode || "image_beat_frames_v1"} • {handoff.renderLab.narrationEnabled === false ? "narration off" : `voice ${handoff.renderLab.familyVoiceName || "Family Narrator"}`}</div>
                <div className="note"><b>Publish targets</b><br />{(handoff.distribution.targets || []).join(", ") || "—"}</div>
              </div>
            </>
          )}
        </div>

        <div className="card softCard">
          <div className="h">Automation settings</div>
          <div className="studioMetaGrid mt-5">
            <input className="input" value={settings.backendUrl} onChange={(e) => setSettings({ ...settings, backendUrl: e.target.value })} placeholder="Backend URL (example http://127.0.0.1:8899)" />
            <select className="input" value={settings.exportMode} onChange={(e) => setSettings({ ...settings, exportMode: e.target.value as any })}>
              <option value="zip">Download ZIP</option>
              <option value="folder">Export folder</option>
            </select>
            <select className="input" value={settings.publishMode} onChange={(e) => setSettings({ ...settings, publishMode: e.target.value as any })}>
              <option value="assisted">Assisted publish handoff</option>
              <option value="manual">Manual publish pack</option>
            </select>
          </div>
          <label className="cluster mt-5" style={{ alignItems: "center" }}>
            <input type="checkbox" checked={settings.autoPublish} onChange={(e) => setSettings({ ...settings, autoPublish: e.target.checked })} />
            <span>Auto-complete publish handoff after packaging</span>
          </label>
          <label className="cluster mt-5" style={{ alignItems: "center" }}>
            <input type="checkbox" checked={settings.autoExecuteWorkers} onChange={(e) => setSettings({ ...settings, autoExecuteWorkers: e.target.checked })} />
            <span>Auto-run backend media workers after job creation</span>
          </label>
          <div className="row wrap mt-5">
            <button className="tabBtn" onClick={pingBackend}>Probe backend</button>
            <button className="tabBtn" onClick={() => nav("DevEngine")}>Open Dev Engine</button>
            <button className="tabBtn" onClick={() => nav("Money")}>Open Money</button>
          </div>
          <div className="note mt-5">Backend: <b>{backendState.ok ? "ready" : "not confirmed"}</b>{backendState.detail ? ` — ${backendState.detail}` : ""}</div>
          {!!backendState.capabilities?.length && <div className="note mt-5"><b>Workers</b><br />{backendState.capabilities.join(", ")}</div>}
        </div>
      </div>

      <div className="card softCard mt-5">
        <div className="cluster spread">
          <div>
            <div className="h">Real media provider bridge</div>
            <div className="sub">Route image, audio, and video workers into local engines or remote webhooks.</div>
          </div>
          <div className="row wrap">
            <button className="tabBtn" onClick={probeProviderBridge}>Probe providers</button>
            <button className="tabBtn" onClick={saveProviderBridge}>Save bridge config</button>
            <button className="tabBtn" onClick={applyAllLocalPresets}>Apply local stack presets</button>
          </div>
        </div>
        <div className="note mt-4">
          <div className="h">Local stack quick start</div>
          <div className="small mt-2">Click <b>Apply local stack presets</b>, then <b>Save bridge config</b>, then <b>Probe providers</b>. That fills in AUTOMATIC1111, Bark, and ComfyUI wrapper endpoints automatically.</div>
        </div>
        <div className="grid mt-5">
          {(["image", "audio", "video"] as const).map((kind) => {
            const cfg = settings.providerBridge[kind];
            const state = backendState.providers?.[kind];
            const suggestedMode = kind === "image" ? "a1111" : kind === "audio" ? "bark" : "comfyui";
            const suggestedEndpoint = kind === "image" ? "http://127.0.0.1:7860" : kind === "audio" ? "http://127.0.0.1:7000" : "http://127.0.0.1:8188";
            const suggestedHealth = kind === "image" ? "/sdapi/v1/sd-models" : kind === "audio" ? "/health" : "/system_stats";
            return (
              <div key={kind} className="note">
                <div className="cluster spread">
                  <b>{kind.toUpperCase()} provider</b>
                  <span className="small">{state?.status || (cfg.enabled ? "configured" : "disabled")}</span>
                </div>

                <div className="row wrap mt-4">
                  <button className="tabBtn" onClick={() => applyLocalPreset(kind)}>Use local preset</button>
                  <span className="studioPill">recommended mode: {suggestedMode}</span>
                  <span className="studioPill">{suggestedEndpoint}</span>
                </div>

                <label className="cluster mt-5" style={{ alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={cfg.enabled}
                    onChange={(e) =>
                      setProvider(kind, {
                        enabled: e.target.checked,
                        mode: e.target.checked && cfg.mode === "stub" ? (suggestedMode as any) : cfg.mode,
                        endpoint: e.target.checked && !cfg.endpoint ? suggestedEndpoint : cfg.endpoint,
                        healthPath: e.target.checked && (!cfg.healthPath || cfg.healthPath === "/health") ? suggestedHealth : cfg.healthPath,
                      })
                    }
                  />
                  <span>Enable real bridge for {kind}</span>
                </label>

                <div className="studioMetaGrid mt-5">
                  <select className="input" value={cfg.mode} onChange={(e) => setProvider(kind, { mode: e.target.value as any })}>
                    <option value="stub">Stub / package only</option>
                    <option value="webhook">Webhook / local engine</option>
                    <option value="a1111">AUTOMATIC1111</option>
                    <option value="bark">Bark / TTS wrapper</option>
                    <option value="comfyui">ComfyUI workflow wrapper</option>
                    <option value="legacy-local">Legacy local FFmpeg runtime</option>
                  </select>
                  <input className="input" value={cfg.endpoint} onChange={(e) => setProvider(kind, { endpoint: e.target.value })} placeholder={`${kind} endpoint (example ${suggestedEndpoint})`} />
                  <input className="input" value={cfg.model} onChange={(e) => setProvider(kind, { model: e.target.value })} placeholder="Model or workflow name" />
                  <input className="input" value={cfg.healthPath} onChange={(e) => setProvider(kind, { healthPath: e.target.value })} placeholder={suggestedHealth} />
                </div>

                <div className="small mt-5">The backend will call <b>/generate</b> on this endpoint and save returned base64 files, URLs, or text outputs into the render artifact bundle.</div>
                {!!state?.detail && <div className="small mt-5">{state.detail}</div>}
              </div>
            );
          })}        </div>
      </div>

      <div className="grid2 mt-5">
        <div className="card softCard">
          <div className="cluster spread">
            <div>
              <div className="h">Job queue</div>
              <div className="sub">Newest on top. Each job stays tied to the studio handoff that created it.</div>
            </div>
            <div className="small">{jobs.length} jobs</div>
          </div>
          <div className="grid mt-5">
            {jobs.length === 0 && <div className="small">No render jobs yet.</div>}
            {jobs.map((job) => (
              <div key={job.id} className="cluster spread">
                <button className={`tabBtn ${activeJob?.id === job.id ? "active" : ""}`} style={{ flex: 1, textAlign: "left" }} onClick={() => setActiveJobId(job.id)}>
                  <b>{job.title}</b>
                  <span className="small" style={{ marginLeft: 10 }}>{job.type} • {job.status}</span>
                </button>
                <button className="tabBtn" disabled={busy} onClick={() => runPipeline(job)}>Run</button>
                <button className="tabBtn" disabled={busy || !job.backendJobId} onClick={() => runBackendWorkers(job)}>Workers</button>
              </div>
            ))}
          </div>
        </div>

        <div className="card softCard">
          <div className="cluster spread">
            <div>
              <div className="h">Active job</div>
              <div className="sub">Render, package, and publish handoff details.</div>
            </div>
            <div className="row wrap">
              <button className="tabBtn" onClick={exportActiveManifest} disabled={!activeJob}>Export job JSON</button>
              <button className="tabBtn" onClick={() => activeJob && runPipeline(activeJob)} disabled={!activeJob || busy}>Run pipeline</button>
              <button className="tabBtn" onClick={() => activeJob && runBackendWorkers(activeJob)} disabled={!activeJob || busy || !activeJob?.backendJobId}>Run workers</button>
            </div>
          </div>
          {!activeJob ? (
            <div className="note mt-5">Queue a studio handoff to see the pipeline details here.</div>
          ) : (
            <>
              <div className="grid mt-5">
                {activeJob.steps.map((step) => (
                  <div key={step.id} className="note">
                    <b>{step.done ? "✅" : "⬜"} {step.label}</b>
                    <div className="small">{step.ts ? new Date(step.ts).toLocaleString() : "waiting"}</div>
                  </div>
                ))}
              </div>
              {!!activeJob.workerStates?.length && (
                <div className="grid mt-5">
                  {activeJob.workerStates.map((worker) => (
                    <div key={worker.id} className="note">
                      <b>{worker.status === "completed" ? "✅" : worker.status === "running" ? "🟡" : "⬜"} {worker.label}</b>
                      <div className="small">{worker.kind} • {(worker.outputs || []).join(", ") || "no outputs listed"}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="note mt-5">
                <div className="cluster spread">
                  <div>
                    <b>Release preview</b>
                    <div className="small">This should play the real rendered MP4 from the backend. If it stays black at 0:00, use Open video below.</div>
                  </div>
                  <div className="row wrap">
                    <button className="tabBtn" onClick={() => refreshRelease(activeJob)} disabled={releaseState.loading || !activeJob?.backendJobId}>Refresh release</button>
                    <button className="tabBtn" onClick={() => setPreviewNonce((n) => n + 1)} disabled={!activeJob?.backendJobId}>Reload player</button>
                  </div>
                </div>
                {releaseState.error && <div className="small mt-4" style={{ color: "#fda4af" }}>{releaseState.error}</div>}
                {!releaseState.error && !release.video && !releaseState.loading && <div className="small mt-4">No release video found yet. Run backend workers first.</div>}
                {release.video && (
                  <div className="grid mt-4">
                    <video
                      key={videoPreviewUrl}
                      controls
                      preload="metadata"
                      playsInline
                      poster={posterPreviewUrl || undefined}
                      style={{ width: "100%", maxHeight: 420, borderRadius: 12, background: "#000" }}
                      src={videoPreviewUrl}
                    />
                    <div className="row wrap">
                      <button className="tabBtn" onClick={() => openAsset(release.video)}>Open video</button>
                      <button className="tabBtn" onClick={() => openAsset(release.video, true)}>Download video</button>
                      {release.poster && <button className="tabBtn" onClick={() => openAsset(release.poster)}>Open poster</button>}
                      {release.audio && <button className="tabBtn" onClick={() => openAsset(release.audio)}>Open narration</button>}
                      {release.transcript && <button className="tabBtn" onClick={() => openAsset(release.transcript)}>Open transcript</button>}
                    </div>
                    {release.audio && (
                      <audio key={audioPreviewUrl} controls preload="metadata" style={{ width: "100%" }} src={audioPreviewUrl} />
                    )}
                  </div>
                )}
              </div>
              <div className="grid2 mt-5">
                <div className="note"><b>Artifacts</b><br />{(activeJob.artifactFiles || []).join("\n")}</div>
                <div className="note"><b>Targets</b><br />{(activeJob.publishTargets || []).join("\n") || "Manual / direct"}</div>
              </div>
              <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 14, padding: 10, background: "rgba(0,0,0,0.22)", maxHeight: 260, overflow: "auto" }}>
                {(activeJob.log || []).length === 0 ? <div className="small">No logs yet.</div> : activeJob.log.map((line, i) => <div key={i} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, whiteSpace: "pre-wrap" }}>{line}</div>)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
