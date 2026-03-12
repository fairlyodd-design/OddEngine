import React, { useEffect, useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import {
  generateFullStudioPipeline,
  generateStudioRoomAssets,
  inferStudioProjectType,
  mapProjectTypeToProductionType,
  type StudioAsset as AutomationStudioAsset,
  type StudioProjectType,
  type StudioRoomKey,
} from "../lib/studioAutomation";
import {
  createRenderJob,
  getRenderJob,
  getRenderJobs,
  importRenderOutput,
  markRenderWatched,
  type RenderJob,
} from "../lib/renderWorkerBridge";

type WriterMode = "story" | "song" | "cartoon" | "video" | "movie";
type VisualStyle =
  | "neo-noir anime"
  | "cartoon surreal"
  | "punk comic"
  | "dreamy watercolor"
  | "glitch cyberpop"
  | "cinematic realism";
type ProductionType =
  | "Book"
  | "Story"
  | "Song"
  | "Movie"
  | "Music Video"
  | "Cartoon"
  | "Series";
type ReleaseTarget =
  | "Indie Launch"
  | "YouTube / Social"
  | "Festival Circuit"
  | "Pitch / Publishing"
  | "Streaming / Platform";
type BudgetBand = "$" | "$$" | "$$$" | "$$$$";
type ScopeLevel = "Lean" | "Balanced" | "Epic";

type ProjectAsset = {
  id: string;
  kind: string;
  title: string;
  content: string;
  ts: number;
};

type StudioProject = {
  id: string;
  title: string;
  subtitle?: string;
  status: "Idea" | "Drafting" | "Revising" | "Editing" | "Publishing";
  logline?: string;
  notes?: string;
  chapters?: Array<{ title: string; notes?: string; draft?: string }>;
  updatedAt: number;

  masterPrompt: string;
  projectType: StudioProjectType;
  writerMode: WriterMode;
  visualStyle: VisualStyle;
  productionType: ProductionType;
  releaseTarget: ReleaseTarget;
  budgetBand: BudgetBand;
  scopeLevel: ScopeLevel;

  renderProvider: string;
  renderFormat: string;
  renderFps: string;
  renderResolution: string;
  renderBaseUrl: string;
  autoCreateRenderAfterPipeline?: boolean;

  studioAssets: ProjectAsset[];
};

const KEY = "oddengine:books:v1";
const KEY_ACTIVE = "oddengine:books:active";
const KEY_STUDIO_ASSETS = "oddengine:writers:studioAssets:v1";
const KEY_STUDIO_ROOM = "oddengine:writers:studioRoom:v1";
const KEY_STUDIO_PIPELINE_RUN = "oddengine:writers:studioPipelineRun:v1";
const DEFAULT_RENDER_BASE = "http://127.0.0.1:8899";

const ROOM_META: Array<{
  key: StudioRoomKey;
  label: string;
  blurb: string;
  kinds: string[];
}> = [
  { key: "home", label: "Studio Home", blurb: "One prompt in, one full project packet out.", kinds: ["oneSheet"] },
  { key: "writing", label: "Writing Room", blurb: "Drafts, lyrics, scripts, story, and working copy.", kinds: ["story", "song"] },
  { key: "director", label: "Director Room", blurb: "Storyboard beats, shot planning, scene flow, and camera logic.", kinds: ["storyboard", "shotList", "videoTreatment", "featureOutline"] },
  { key: "music", label: "Music Lab", blurb: "Song direction, cues, voice ideas, and soundtrack notes.", kinds: ["productionPack", "song"] },
  { key: "render", label: "Render Lab", blurb: "Render handoff, queue, status polling, import, and watch flow.", kinds: ["renderHandoff", "renderJob"] },
  { key: "ops", label: "Producer Ops", blurb: "Runbooks, packaging, screening packets, and final ship checklist.", kinds: ["productionRunbook", "screeningPacket", "oneSheet"] },
];

const PROJECT_TYPES: StudioProjectType[] = ["song", "book", "cartoon", "video", "music video", "other"];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function titleFromPrompt(prompt: string, fallback = "Untitled Studio Project") {
  const text = String(prompt || "").trim();
  if (!text) return fallback;
  return text.split(/\s+/).slice(0, 8).join(" ").replace(/[.,:;!?]+$/g, "");
}

function projectTypeToWriterMode(projectType: StudioProjectType): WriterMode {
  if (projectType === "song") return "song";
  if (projectType === "cartoon") return "cartoon";
  if (projectType === "video" || projectType === "music video") return "video";
  return "story";
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function createBlankProject(seed?: Partial<StudioProject>): StudioProject {
  const projectType = seed?.projectType || "video";
  return {
    id: uid(),
    title: seed?.title || "Untitled Studio Project",
    subtitle: seed?.subtitle || "",
    status: seed?.status || "Idea",
    logline: seed?.logline || "",
    notes: seed?.notes || "",
    chapters: seed?.chapters || [],
    updatedAt: Date.now(),

    masterPrompt: seed?.masterPrompt || "",
    projectType,
    writerMode: seed?.writerMode || projectTypeToWriterMode(projectType),
    visualStyle: seed?.visualStyle || "cinematic realism",
    productionType: (seed?.productionType || mapProjectTypeToProductionType(projectType)) as ProductionType,
    releaseTarget: seed?.releaseTarget || "Indie Launch",
    budgetBand: seed?.budgetBand || "$$",
    scopeLevel: seed?.scopeLevel || "Balanced",

    renderProvider: seed?.renderProvider || "local-worker",
    renderFormat: seed?.renderFormat || "mp4",
    renderFps: seed?.renderFps || "24 fps",
    renderResolution: seed?.renderResolution || "1080p",
    renderBaseUrl: seed?.renderBaseUrl || DEFAULT_RENDER_BASE,
    autoCreateRenderAfterPipeline: Boolean(seed?.autoCreateRenderAfterPipeline),

    studioAssets: seed?.studioAssets || [],
  };
}

function coerceProject(raw: any, fallbackAssets: ProjectAsset[] = []): StudioProject {
  const inferred = (raw?.projectType || inferStudioProjectType(raw?.writerMode || "story")) as StudioProjectType;
  const assets = Array.isArray(raw?.studioAssets) ? raw.studioAssets : fallbackAssets;

  return createBlankProject({
    id: String(raw?.id || uid()),
    title: String(raw?.title || titleFromPrompt(raw?.masterPrompt || raw?.logline || "")),
    subtitle: String(raw?.subtitle || ""),
    status: raw?.status || "Idea",
    logline: String(raw?.logline || ""),
    notes: String(raw?.notes || ""),
    chapters: Array.isArray(raw?.chapters) ? raw.chapters : [],
    updatedAt: Number(raw?.updatedAt || Date.now()),
    masterPrompt: String(raw?.masterPrompt || raw?.logline || ""),
    projectType: inferred,
    writerMode: (raw?.writerMode || projectTypeToWriterMode(inferred)) as WriterMode,
    visualStyle: (raw?.visualStyle || "cinematic realism") as VisualStyle,
    productionType: (raw?.productionType || mapProjectTypeToProductionType(inferred)) as ProductionType,
    releaseTarget: (raw?.releaseTarget || "Indie Launch") as ReleaseTarget,
    budgetBand: (raw?.budgetBand || "$$") as BudgetBand,
    scopeLevel: (raw?.scopeLevel || "Balanced") as ScopeLevel,
    renderProvider: String(raw?.renderProvider || "local-worker"),
    renderFormat: String(raw?.renderFormat || "mp4"),
    renderFps: String(raw?.renderFps || "24 fps"),
    renderResolution: String(raw?.renderResolution || "1080p"),
    renderBaseUrl: String(raw?.renderBaseUrl || DEFAULT_RENDER_BASE),
    autoCreateRenderAfterPipeline: Boolean(raw?.autoCreateRenderAfterPipeline),
    studioAssets: Array.isArray(assets) ? assets : [],
  });
}

function newestFirst<T extends { ts?: number }>(items: T[]) {
  return [...items].sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
}

function latestAsset(assets: ProjectAsset[], kinds: string[]) {
  return newestFirst(assets).find((a) => kinds.includes(a.kind));
}

function roomAssets(assets: ProjectAsset[], room: StudioRoomKey) {
  const meta = ROOM_META.find((r) => r.key === room);
  if (!meta) return [];
  return newestFirst(assets).filter((asset) => meta.kinds.includes(asset.kind));
}

function shortStatus(status?: string) {
  return String(status || "unknown").toLowerCase();
}

function isFinishedStatus(status?: string) {
  const s = shortStatus(status);
  return s === "completed" || s === "imported" || s === "failed";
}

async function copyText(text: string) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

export default function Books() {
  const [projects, setProjects] = useState<StudioProject[]>(() => {
    const legacyAssets = loadJSON<ProjectAsset[]>(KEY_STUDIO_ASSETS, []);
    const raw = loadJSON<any[]>(KEY, []);
    if (Array.isArray(raw) && raw.length) {
      return raw.map((item, idx) => coerceProject(item, idx === 0 ? legacyAssets : []));
    }
    return [createBlankProject({ studioAssets: legacyAssets })];
  });

  const [activeId, setActiveId] = useState<string>(() => loadJSON<string>(KEY_ACTIVE, ""));
  const [studioRoom, setStudioRoom] = useState<StudioRoomKey>(() => loadJSON<StudioRoomKey>(KEY_STUDIO_ROOM, "home"));

  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineError, setPipelineError] = useState("");
  const [lastPipelineRunAt, setLastPipelineRunAt] = useState<number>(() => loadJSON<number>(KEY_STUDIO_PIPELINE_RUN, 0));
  const [copiedState, setCopiedState] = useState("");

  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [activeRenderJobId, setActiveRenderJobId] = useState<string>("");
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [lastRenderSyncAt, setLastRenderSyncAt] = useState<number>(0);

  const activeProject = useMemo(() => projects.find((p) => p.id === activeId) || projects[0] || null, [projects, activeId]);
  const activeRoomMeta = ROOM_META.find((room) => room.key === studioRoom) || ROOM_META[0];
  const activeRoomAssets = useMemo(() => (activeProject ? roomAssets(activeProject.studioAssets, studioRoom) : []), [activeProject, studioRoom]);
  const latestRenderHandoff = useMemo(() => (activeProject ? latestAsset(activeProject.studioAssets, ["renderHandoff"]) : undefined), [activeProject]);
  const latestRenderPayload = useMemo(() => safeJsonParse(latestRenderHandoff?.content || ""), [latestRenderHandoff]);

  const assetCounts = useMemo(() => {
    const assets = activeProject?.studioAssets || [];
    return {
      total: assets.length,
      home: roomAssets(assets, "home").length,
      writing: roomAssets(assets, "writing").length,
      director: roomAssets(assets, "director").length,
      music: roomAssets(assets, "music").length,
      render: roomAssets(assets, "render").length,
      ops: roomAssets(assets, "ops").length,
    };
  }, [activeProject]);

  const activeRenderJob = useMemo(() => renderJobs.find((job) => job.id === activeRenderJobId) || renderJobs[0] || null, [renderJobs, activeRenderJobId]);

  useEffect(() => {
    if (!activeId && projects[0]?.id) setActiveId(projects[0].id);
  }, [activeId, projects]);

  useEffect(() => {
    saveJSON(KEY, projects);
  }, [projects]);

  useEffect(() => {
    if (!activeProject) return;
    saveJSON(KEY_ACTIVE, activeProject.id);
    saveJSON(KEY_STUDIO_ASSETS, activeProject.studioAssets);
  }, [activeProject]);

  useEffect(() => {
    saveJSON(KEY_STUDIO_ROOM, studioRoom);
  }, [studioRoom]);

  useEffect(() => {
    saveJSON(KEY_STUDIO_PIPELINE_RUN, lastPipelineRunAt);
  }, [lastPipelineRunAt]);

  const updateActiveProject = (patch: Partial<StudioProject>) => {
    if (!activeProject) return;
    setProjects((prev) => prev.map((project) => project.id === activeProject.id ? { ...project, ...patch, updatedAt: Date.now() } : project));
  };

  const prependAssetsToActiveProject = (assets: ProjectAsset[]) => {
    if (!activeProject || !assets.length) return;
    updateActiveProject({
      studioAssets: [...assets, ...activeProject.studioAssets],
      title: titleFromPrompt(activeProject.masterPrompt, activeProject.title),
    });
  };

  const addProject = () => {
    const next = createBlankProject();
    setProjects((prev) => [next, ...prev]);
    setActiveId(next.id);
    setStudioRoom("home");
  };

  const duplicateProject = () => {
    if (!activeProject) return;
    const next = createBlankProject({ ...activeProject, id: uid(), title: `${activeProject.title} Copy`, studioAssets: [...activeProject.studioAssets] });
    setProjects((prev) => [next, ...prev]);
    setActiveId(next.id);
  };

  const deleteProject = () => {
    if (!activeProject || projects.length <= 1) return;
    const remaining = projects.filter((project) => project.id !== activeProject.id);
    setProjects(remaining);
    setActiveId(remaining[0]?.id || "");
  };

  const buildAutomationInput = () => {
    if (!activeProject) throw new Error("No active project.");
    return {
      masterPrompt: activeProject.masterPrompt,
      projectType: activeProject.projectType,
      visualStyle: activeProject.visualStyle,
      productionType: activeProject.productionType,
      releaseTarget: activeProject.releaseTarget,
      budgetBand: activeProject.budgetBand,
      scopeLevel: activeProject.scopeLevel,
      existingAssets: activeProject.studioAssets as AutomationStudioAsset[],
    };
  };

  const createRenderFromProject = async (project: StudioProject, opts?: { handoffContent?: string; sourceLabel?: string }) => {
    const handoffContent = opts?.handoffContent || latestAsset(project.studioAssets, ["renderHandoff"])?.content || "";
    const parsedPayload = safeJsonParse(handoffContent || "");
    const directionAsset = latestAsset(project.studioAssets, ["storyboard", "shotList"]);
    const title = project.title || titleFromPrompt(project.masterPrompt);

    const res = await createRenderJob({
      baseUrl: project.renderBaseUrl || DEFAULT_RENDER_BASE,
      projectTitle: title,
      title,
      kind: "video",
      prompt: project.masterPrompt,
      provider: project.renderProvider,
      productionType: project.productionType,
      visualStyle: project.visualStyle,
      releaseTarget: project.releaseTarget,
      format: project.renderFormat,
      fps: project.renderFps,
      resolution: project.renderResolution,
      storyboardSummary: directionAsset?.content || project.masterPrompt,
      assetIds: project.studioAssets.map((asset) => asset.id),
      handoff: parsedPayload || { source: opts?.sourceLabel || "latest render handoff" },
      promptPack: parsedPayload || undefined,
      payload:
        parsedPayload ||
        {
          title,
          projectType: project.projectType,
          productionType: project.productionType,
          visualStyle: project.visualStyle,
          releaseTarget: project.releaseTarget,
          budgetBand: project.budgetBand,
          scopeLevel: project.scopeLevel,
        },
    });

    setRenderJobs((prev) => [res.job, ...prev.filter((job) => job.id !== res.job.id)]);
    setActiveRenderJobId(res.job.id);
    setLastRenderSyncAt(Date.now());

    prependAssetsToActiveProject([
      {
        id: uid(),
        kind: "renderJob",
        title: `Render Job • ${title}`,
        content: JSON.stringify(res.job, null, 2),
        ts: Date.now(),
      },
    ]);

    return res.job;
  };

  const runGenerateFullPipeline = async () => {
    if (!activeProject) return;
    setPipelineBusy(true);
    setPipelineError("");
    try {
      const input = buildAutomationInput();
      const packet = generateFullStudioPipeline(input as any);
      const generated = [...packet.home, ...packet.writing, ...packet.director, ...packet.music, ...packet.render, ...packet.ops] as ProjectAsset[];
      prependAssetsToActiveProject(generated);
      const nextProject = {
        ...activeProject,
        title: titleFromPrompt(activeProject.masterPrompt, activeProject.title),
        productionType: mapProjectTypeToProductionType(activeProject.projectType) as ProductionType,
        writerMode: projectTypeToWriterMode(activeProject.projectType),
        logline: activeProject.masterPrompt,
      } as StudioProject;
      updateActiveProject(nextProject);
      setLastPipelineRunAt(Date.now());
      setStudioRoom("home");
      if (activeProject.autoCreateRenderAfterPipeline) {
        const freshHandoff = generated.find((asset) => asset.kind === "renderHandoff")?.content || "";
        await createRenderFromProject({ ...nextProject, studioAssets: [...generated, ...activeProject.studioAssets] }, { handoffContent: freshHandoff, sourceLabel: "auto-created from full pipeline" });
      }
    } catch (error: any) {
      setPipelineError(error?.message || String(error));
    } finally {
      setPipelineBusy(false);
    }
  };

  const regenerateCurrentRoom = async () => {
    if (!activeProject) return;
    setPipelineBusy(true);
    setPipelineError("");
    try {
      const input = buildAutomationInput();
      const generated = generateStudioRoomAssets(input as any, studioRoom as StudioRoomKey) as ProjectAsset[];
      prependAssetsToActiveProject(generated);
      updateActiveProject({
        productionType: mapProjectTypeToProductionType(activeProject.projectType) as ProductionType,
        writerMode: projectTypeToWriterMode(activeProject.projectType),
      });
      setLastPipelineRunAt(Date.now());
    } catch (error: any) {
      setPipelineError(error?.message || String(error));
    } finally {
      setPipelineBusy(false);
    }
  };

  const refreshRenderJobs = async () => {
    if (!activeProject?.renderBaseUrl) return;
    try {
      const res = await getRenderJobs(activeProject.renderBaseUrl);
      setRenderJobs(res.jobs || []);
      setLastRenderSyncAt(Date.now());
      if (!activeRenderJobId && res.jobs?.[0]?.id) setActiveRenderJobId(res.jobs[0].id);
    } catch (error: any) {
      setRenderError(error?.message || String(error));
    }
  };

  const submitRenderJob = async () => {
    if (!activeProject) return;
    setRenderBusy(true);
    setRenderError("");
    try {
      await createRenderFromProject(activeProject, { sourceLabel: "manual create render job" });
    } catch (error: any) {
      setRenderError(error?.message || String(error));
    } finally {
      setRenderBusy(false);
    }
  };

  const pollActiveRenderJob = async () => {
    if (!activeProject?.renderBaseUrl || !activeRenderJobId) return;
    try {
      const res = await getRenderJob(activeProject.renderBaseUrl, activeRenderJobId);
      setRenderJobs((prev) => [res.job, ...prev.filter((job) => job.id !== res.job.id)]);
      setLastRenderSyncAt(Date.now());
    } catch (error: any) {
      setRenderError(error?.message || String(error));
    }
  };

  const runImportCompletedRender = async () => {
    if (!activeProject?.renderBaseUrl || !activeRenderJobId) return;
    setRenderBusy(true);
    setRenderError("");
    try {
      const res = await importRenderOutput(activeProject.renderBaseUrl, activeRenderJobId, "OddEngine Render Lab", false);
      setRenderJobs((prev) => [res.job, ...prev.filter((job) => job.id !== res.job.id)]);
      prependAssetsToActiveProject([
        {
          id: uid(),
          kind: "renderJob",
          title: `Imported Render • ${res.job.title || res.job.projectTitle || activeProject.title}`,
          content: JSON.stringify(res.job, null, 2),
          ts: Date.now(),
        },
      ]);
    } catch (error: any) {
      setRenderError(error?.message || String(error));
    } finally {
      setRenderBusy(false);
    }
  };

  const runWatchCompletedRender = async () => {
    if (!activeProject?.renderBaseUrl || !activeRenderJobId) return;
    setRenderBusy(true);
    setRenderError("");
    try {
      const res = await markRenderWatched(activeProject.renderBaseUrl, activeRenderJobId);
      setRenderJobs((prev) => [res.job, ...prev.filter((job) => job.id !== res.job.id)]);
      const previewUrl = res.job.output?.previewUrl || res.job.output?.localPath || "";
      if (previewUrl) window.open(previewUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      setRenderError(error?.message || String(error));
    } finally {
      setRenderBusy(false);
    }
  };

  const copyLatestRenderPayload = async () => {
    if (!latestRenderHandoff?.content) return;
    await copyText(latestRenderHandoff.content);
    setCopiedState("Copied latest render payload");
    window.setTimeout(() => setCopiedState(""), 1800);
  };

  useEffect(() => {
    if (!activeProject?.renderBaseUrl || studioRoom !== "render") return;
    void refreshRenderJobs();
  }, [activeProject?.renderBaseUrl, studioRoom]);

  useEffect(() => {
    if (!activeProject?.renderBaseUrl || !activeRenderJobId || studioRoom !== "render") return;
    if (isFinishedStatus(activeRenderJob?.status)) return;
    const timer = window.setInterval(() => {
      void pollActiveRenderJob();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [activeProject?.renderBaseUrl, activeRenderJobId, studioRoom, activeRenderJob?.status]);

  if (!activeProject) return <div className="card softCard">Studio is loading…</div>;

  const latestPreviewUrl = activeRenderJob?.output?.previewUrl || activeRenderJob?.output?.localPath || "";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card softCard">
        <div className="small shellEyebrow">FAIRLYODD OS / STUDIO</div>
        <div className="h mt-2">Prompt-to-project creative pipeline inside the larger FairlyOdd OS.</div>
        <div className="sub mt-2">
          One master prompt can drive songs, books, cartoons, videos, music videos,
          and producer-ready working packets without changing the stable Books route under the hood.
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)", alignItems: "start" }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div className="card softCard">
            <div className="cluster wrap spread">
              <div>
                <div className="small shellEyebrow">STUDIO PROJECTS</div>
                <div className="sub mt-2">Keep multiple projects in one Studio workspace.</div>
              </div>
              <button className="tabBtn active" onClick={addProject}>New</button>
            </div>

            <div className="mt-3" style={{ display: "grid", gap: 10 }}>
              {projects.map((project) => (
                <button
                  key={project.id}
                  className="card softCard"
                  style={{
                    textAlign: "left",
                    border: project.id === activeProject.id ? "1px solid rgba(255,255,255,0.28)" : "1px solid transparent",
                    padding: 12,
                    minHeight: 96,
                    display: "grid",
                    alignContent: "start",
                    gap: 6,
                  }}
                  onClick={() => setActiveId(project.id)}
                >
                  <div className="small shellEyebrow">{project.projectType}</div>
                  <div className="small mt-2"><b>{project.title}</b></div>
                  <div className="small mt-2">{project.masterPrompt || "No master prompt yet."}</div>
                </button>
              ))}
            </div>

            <div className="row wrap mt-4" style={{ gap: 10 }}>
              <button className="tabBtn" onClick={duplicateProject}>Duplicate</button>
              <button className="tabBtn" onClick={deleteProject} disabled={projects.length <= 1}>Delete</button>
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">PIPELINE COVERAGE</div>
            <div className="small mt-3"><b>Total assets:</b> {assetCounts.total}</div>
            <div className="small mt-2">Studio Home: {assetCounts.home}</div>
            <div className="small mt-1">Writing Room: {assetCounts.writing}</div>
            <div className="small mt-1">Director Room: {assetCounts.director}</div>
            <div className="small mt-1">Music Lab: {assetCounts.music}</div>
            <div className="small mt-1">Render Lab: {assetCounts.render}</div>
            <div className="small mt-1">Producer Ops: {assetCounts.ops}</div>
            <div className="small mt-3"><b>Last full run:</b> {lastPipelineRunAt ? new Date(lastPipelineRunAt).toLocaleString() : "Not run yet"}</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div className="card softCard">
            <div className="row wrap" style={{ gap: 10 }}>
              {ROOM_META.map((room) => (
                <button key={room.key} className={`tabBtn ${studioRoom === room.key ? "active" : ""}`} onClick={() => setStudioRoom(room.key)}>
                  {room.label}
                </button>
              ))}
            </div>

            <div className="card softCard mt-4">
              <div className="small shellEyebrow">{activeRoomMeta.label.toUpperCase()}</div>
              <div className="sub mt-2">{activeRoomMeta.blurb}</div>
            </div>

            <div className="card softCard mt-4">
              <div className="small shellEyebrow">PROMPT → PROJECT AUTOMATION</div>
              <div className="sub mt-2">
                Generate the full Studio packet from one master prompt, regenerate only the current room, and optionally auto-create the render job from the newest handoff.
              </div>

              <div className="mt-4" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
                <div className="card softCard">
                  <div className="small shellEyebrow">MASTER PROMPT</div>
                  <textarea
                    className="input mt-2"
                    rows={8}
                    value={activeProject.masterPrompt}
                    onChange={(e) => updateActiveProject({ masterPrompt: e.target.value, title: titleFromPrompt(e.target.value, activeProject.title), logline: e.target.value })}
                    placeholder="Describe the song, book, cartoon, video, music video, or other project you want the Studio to build end-to-end."
                  />
                </div>

                <div className="card softCard">
                  <div className="small shellEyebrow">PIPELINE CONTROLS</div>
                  <div className="mt-2" style={{ display: "grid", gap: 10 }}>
                    <label className="small">
                      Project type
                      <select
                        className="input mt-2"
                        value={activeProject.projectType}
                        onChange={(e) => {
                          const next = e.target.value as StudioProjectType;
                          updateActiveProject({ projectType: next, writerMode: projectTypeToWriterMode(next), productionType: mapProjectTypeToProductionType(next) as ProductionType });
                        }}
                      >
                        {PROJECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>

                    <label className="small">
                      Visual style
                      <input className="input mt-2" value={activeProject.visualStyle} onChange={(e) => updateActiveProject({ visualStyle: e.target.value as VisualStyle })} />
                    </label>

                    <label className="small">
                      Release target
                      <input className="input mt-2" value={activeProject.releaseTarget} onChange={(e) => updateActiveProject({ releaseTarget: e.target.value as ReleaseTarget })} />
                    </label>

                    <label className="small" style={{ display: "grid", gap: 8 }}>
                      <span>Render autoflow</span>
                      <label className="small" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="checkbox" checked={Boolean(activeProject.autoCreateRenderAfterPipeline)} onChange={(e) => updateActiveProject({ autoCreateRenderAfterPipeline: e.target.checked })} />
                        Auto-create render job after full pipeline
                      </label>
                    </label>

                    <div className="row wrap" style={{ gap: 10 }}>
                      <button className="tabBtn active" disabled={pipelineBusy} onClick={() => void runGenerateFullPipeline()}>
                        {pipelineBusy ? "Generating…" : "Generate full pipeline"}
                      </button>
                      <button className="tabBtn" disabled={pipelineBusy} onClick={() => void regenerateCurrentRoom()}>
                        {pipelineBusy ? "Working…" : `Regenerate ${activeRoomMeta.label}`}
                      </button>
                    </div>

                    {pipelineError ? <div className="note">{pipelineError}</div> : null}
                    {copiedState ? <div className="small">{copiedState}</div> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "start" }}>
              <div className="card softCard">
                <div className="small shellEyebrow">PROJECT CORE</div>
                <div className="small mt-2"><b>Title:</b> {activeProject.title}</div>
                <div className="small mt-2"><b>Project type:</b> {activeProject.projectType}</div>
                <div className="small mt-2"><b>Production type:</b> {activeProject.productionType}</div>
                <div className="small mt-2"><b>Visual style:</b> {activeProject.visualStyle}</div>
                <div className="small mt-2"><b>Release target:</b> {activeProject.releaseTarget}</div>
              </div>

              <div className="card softCard">
                <div className="small shellEyebrow">ACTIVE ROOM OUTPUTS</div>
                <div className="small mt-2">{activeRoomAssets.length} assets in {activeRoomMeta.label}</div>
                <div className="small mt-2">Most recent: {activeRoomAssets[0]?.title || "Nothing generated yet."}</div>
              </div>
            </div>

            {studioRoom === "render" ? (
              <div className="card softCard mt-4">
                <div className="small shellEyebrow">RENDER LAB</div>
                <div className="sub mt-2">Existing local render backend target stays at {activeProject.renderBaseUrl || DEFAULT_RENDER_BASE}.</div>

                <div className="card softCard mt-3">
                  <div className="small shellEyebrow">LATEST RENDER STATUS</div>
                  <div className="small mt-2">
                    {activeRenderJob ? `${activeRenderJob.status || "unknown"} • ${activeRenderJob.title || activeRenderJob.projectTitle || activeRenderJob.id}` : "No render job yet."}
                  </div>
                  {latestPreviewUrl ? (
                    <div className="row wrap mt-3" style={{ gap: 10 }}>
                      <button className="tabBtn" onClick={() => window.open(latestPreviewUrl, "_blank", "noopener,noreferrer")}>Open latest output</button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3" style={{ display: "grid", gap: 10 }}>
                  <input className="input" value={activeProject.renderBaseUrl} onChange={(e) => updateActiveProject({ renderBaseUrl: e.target.value })} placeholder={DEFAULT_RENDER_BASE} />

                  <div className="small"><b>Latest handoff:</b> {latestRenderHandoff?.title || "No render handoff yet."}</div>
                  <div className="small"><b>Payload ready:</b> {latestRenderPayload ? "Yes" : "Fallback payload will be used"}</div>

                  <div className="row wrap" style={{ gap: 10 }}>
                    <button className="tabBtn active" disabled={renderBusy || !latestRenderHandoff} onClick={() => void submitRenderJob()}>
                      {renderBusy ? "Submitting…" : "Create render from latest handoff"}
                    </button>
                    <button className="tabBtn" onClick={() => void refreshRenderJobs()}>Refresh queue</button>
                    <button className="tabBtn" onClick={() => void pollActiveRenderJob()} disabled={!activeRenderJobId}>Poll active</button>
                    <button className="tabBtn" onClick={() => void runImportCompletedRender()} disabled={!activeRenderJobId}>Import completed</button>
                    <button className="tabBtn" onClick={() => void runWatchCompletedRender()} disabled={!activeRenderJobId}>Watch completed</button>
                    <button className="tabBtn" onClick={() => void copyLatestRenderPayload()} disabled={!latestRenderHandoff}>Copy render payload</button>
                  </div>

                  {!latestRenderHandoff ? <div className="small">Generate the Render Lab room first so the latest handoff can seed the worker.</div> : null}
                  {renderError ? <div className="note">{renderError}</div> : null}
                  <div className="small"><b>Last sync:</b> {lastRenderSyncAt ? new Date(lastRenderSyncAt).toLocaleString() : "No sync yet"}</div>

                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "start" }}>
                    <div className="card softCard">
                      <div className="small shellEyebrow">QUEUE</div>
                      {!renderJobs.length ? (
                        <div className="small mt-3">No render jobs yet.</div>
                      ) : (
                        <div className="mt-3" style={{ display: "grid", gap: 10 }}>
                          {renderJobs.slice(0, 8).map((job) => (
                            <button
                              key={job.id}
                              className="card softCard"
                              style={{
                                textAlign: "left",
                                border: activeRenderJobId === job.id ? "1px solid rgba(255,255,255,0.28)" : "1px solid transparent",
                                padding: 12,
                                minHeight: 110,
                                display: "grid",
                                alignContent: "start",
                                gap: 6,
                              }}
                              onClick={() => setActiveRenderJobId(job.id)}
                            >
                              <div className="small shellEyebrow">{job.status || "unknown"}</div>
                              <div className="small mt-2"><b>{job.title || job.projectTitle || job.id}</b></div>
                              <div className="small mt-2">Provider: {job.provider || "local-worker"}</div>
                              <div className="small mt-1">Progress: {job.progress ?? "—"}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="card softCard">
                      <div className="small shellEyebrow">ACTIVE JOB</div>
                      {!activeRenderJob ? (
                        <div className="small mt-3">Select a render job from the queue.</div>
                      ) : (
                        <>
                          <div className="small mt-3"><b>{activeRenderJob.title || activeRenderJob.projectTitle || activeRenderJob.id}</b></div>
                          <div className="small mt-2">Status: <b>{activeRenderJob.status || "unknown"}</b></div>
                          <div className="small mt-1">Provider: {activeRenderJob.provider || "local-worker"}</div>
                          <div className="small mt-1">Progress: {activeRenderJob.progress ?? "—"}</div>
                          {activeRenderJob.workerMessage ? <div className="small mt-2">{activeRenderJob.workerMessage}</div> : null}
                          {latestPreviewUrl ? <div className="small mt-2"><b>Output:</b> {latestPreviewUrl}</div> : null}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="card softCard mt-4">
              <div className="small shellEyebrow">{activeRoomMeta.label.toUpperCase()} ASSETS</div>
              {!activeRoomAssets.length ? (
                <div className="small mt-3">No assets yet for this room. Generate the full pipeline or regenerate this room.</div>
              ) : (
                <div className="mt-3" style={{ display: "grid", gap: 12 }}>
                  {activeRoomAssets.map((asset) => (
                    <div key={asset.id} className="card softCard">
                      <div className="small shellEyebrow">{asset.kind}</div>
                      <div className="small mt-2"><b>{asset.title}</b></div>
                      <div className="small mt-2">{new Date(asset.ts).toLocaleString()}</div>
                      <pre className="writersPlannerPreview" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 12, maxHeight: 360, overflow: "auto", lineHeight: 1.45, padding: 14 }}>
                        {asset.content}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
