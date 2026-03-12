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
import {
  getStudioTemplates,
  getStudioTemplateById,
  applyStudioTemplateToProjectSeed,
  type TemplateId,
} from "../lib/studioTemplates";

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
  selectedTemplateId?: TemplateId | "";

  renderProvider: string;
  renderFormat: string;
  renderFps: string;
  renderResolution: string;
  renderBaseUrl: string;

  studioAssets: ProjectAsset[];
};

const KEY = "oddengine:books:v1";
const KEY_ACTIVE = "oddengine:books:active";
const KEY_STUDIO_ROOM = "oddengine:writers:studioRoom:v1";
const KEY_STUDIO_PIPELINE_RUN = "oddengine:writers:studioPipelineRun:v1";

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
  try { return JSON.parse(text); } catch { return null; }
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
    selectedTemplateId: seed?.selectedTemplateId || "",

    renderProvider: seed?.renderProvider || "local-worker",
    renderFormat: seed?.renderFormat || "mp4",
    renderFps: seed?.renderFps || "24 fps",
    renderResolution: seed?.renderResolution || "1080p",
    renderBaseUrl: seed?.renderBaseUrl || "http://127.0.0.1:8899",

    studioAssets: seed?.studioAssets || [],
  };
}

function coerceProject(raw: any): StudioProject {
  const inferred = (raw?.projectType || inferStudioProjectType(raw?.writerMode || "story")) as StudioProjectType;
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
    selectedTemplateId: (raw?.selectedTemplateId || "") as TemplateId | "",
    renderProvider: String(raw?.renderProvider || "local-worker"),
    renderFormat: String(raw?.renderFormat || "mp4"),
    renderFps: String(raw?.renderFps || "24 fps"),
    renderResolution: String(raw?.renderResolution || "1080p"),
    renderBaseUrl: String(raw?.renderBaseUrl || "http://127.0.0.1:8899"),
    studioAssets: Array.isArray(raw?.studioAssets) ? raw.studioAssets : [],
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

export default function Books() {
  const templates = getStudioTemplates();
  const [projects, setProjects] = useState<StudioProject[]>(() => {
    const raw = loadJSON<any[]>(KEY, []);
    if (Array.isArray(raw) && raw.length) return raw.map((item) => coerceProject(item));
    const starter = createBlankProject();
    return [starter];
  });
  const [activeId, setActiveId] = useState<string>(() => loadJSON<string>(KEY_ACTIVE, ""));
  const [studioRoom, setStudioRoom] = useState<StudioRoomKey>(() => loadJSON<StudioRoomKey>(KEY_STUDIO_ROOM, "home"));
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineError, setPipelineError] = useState("");
  const [lastPipelineRunAt, setLastPipelineRunAt] = useState<number>(() => loadJSON<number>(KEY_STUDIO_PIPELINE_RUN, 0));
  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [activeRenderJobId, setActiveRenderJobId] = useState<string>("");
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [lastRenderSyncAt, setLastRenderSyncAt] = useState<number>(0);

  const activeProject = useMemo(() => projects.find((p) => p.id === activeId) || projects[0] || null, [projects, activeId]);
  const activeRoomMeta = ROOM_META.find((room) => room.key === studioRoom) || ROOM_META[0];
  const activeRoomAssets = useMemo(() => activeProject ? roomAssets(activeProject.studioAssets, studioRoom) : [], [activeProject, studioRoom]);
  const activeTemplate = useMemo(
    () => (activeProject?.selectedTemplateId ? getStudioTemplateById(activeProject.selectedTemplateId as TemplateId) : null),
    [activeProject?.selectedTemplateId]
  );
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
  const activeRenderJob = useMemo(
    () => renderJobs.find((job) => job.id === activeRenderJobId) || renderJobs[0] || null,
    [renderJobs, activeRenderJobId]
  );

  useEffect(() => {
    if (!activeId && projects[0]?.id) setActiveId(projects[0].id);
  }, [activeId, projects]);

  useEffect(() => { saveJSON(KEY, projects); }, [projects]);
  useEffect(() => { if (activeProject) saveJSON(KEY_ACTIVE, activeProject.id); }, [activeProject]);
  useEffect(() => { saveJSON(KEY_STUDIO_ROOM, studioRoom); }, [studioRoom]);
  useEffect(() => { saveJSON(KEY_STUDIO_PIPELINE_RUN, lastPipelineRunAt); }, [lastPipelineRunAt]);

  const updateActiveProject = (patch: Partial<StudioProject>) => {
    if (!activeProject) return;
    setProjects((prev) => prev.map((project) => (
      project.id === activeProject.id ? { ...project, ...patch, updatedAt: Date.now() } : project
    )));
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

  const addProjectFromTemplate = (templateId: TemplateId) => {
    const template = getStudioTemplateById(templateId);
    if (!template) return;
    const applied = applyStudioTemplateToProjectSeed(template);
    const starterAssets: ProjectAsset[] = applied.starterAssets.map((asset) => ({
      id: uid(),
      kind: asset.kind,
      title: asset.title,
      content: asset.content,
      ts: Date.now(),
    }));
    const next = createBlankProject({
      title: `${template.label} Project`,
      masterPrompt: applied.masterPrompt,
      projectType: applied.projectType,
      writerMode: projectTypeToWriterMode(applied.projectType),
      visualStyle: applied.visualStyle as VisualStyle,
      productionType: applied.productionType as ProductionType,
      releaseTarget: applied.releaseTarget as ReleaseTarget,
      budgetBand: applied.budgetBand as BudgetBand,
      scopeLevel: applied.scopeLevel as ScopeLevel,
      selectedTemplateId: template.id,
      studioAssets: starterAssets,
    });
    setProjects((prev) => [next, ...prev]);
    setActiveId(next.id);
    setStudioRoom(applied.recommendedFirstRoom);
  };

  const applyTemplateToActiveProject = (templateId: TemplateId) => {
    const template = getStudioTemplateById(templateId);
    if (!activeProject || !template) return;
    const applied = applyStudioTemplateToProjectSeed(template, activeProject.masterPrompt);
    const starterAssets: ProjectAsset[] = applied.starterAssets.map((asset) => ({
      id: uid(),
      kind: asset.kind,
      title: `${asset.title} • ${template.label}`,
      content: asset.content,
      ts: Date.now(),
    }));
    prependAssetsToActiveProject(starterAssets);
    updateActiveProject({
      selectedTemplateId: template.id,
      projectType: applied.projectType,
      writerMode: projectTypeToWriterMode(applied.projectType),
      visualStyle: applied.visualStyle as VisualStyle,
      productionType: applied.productionType as ProductionType,
      releaseTarget: applied.releaseTarget as ReleaseTarget,
      budgetBand: applied.budgetBand as BudgetBand,
      scopeLevel: applied.scopeLevel as ScopeLevel,
      masterPrompt: activeProject.masterPrompt || applied.masterPrompt,
      title: activeProject.title === "Untitled Studio Project" ? `${template.label} Project` : activeProject.title,
    });
    setStudioRoom(applied.recommendedFirstRoom);
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

  const runGenerateFullPipeline = async () => {
    if (!activeProject) return;
    setPipelineBusy(true);
    setPipelineError("");
    try {
      const packet = generateFullStudioPipeline(buildAutomationInput() as any);
      const generated = [...packet.home, ...packet.writing, ...packet.director, ...packet.music, ...packet.render, ...packet.ops] as ProjectAsset[];
      prependAssetsToActiveProject(generated);
      updateActiveProject({
        title: titleFromPrompt(activeProject.masterPrompt, activeProject.title),
        productionType: mapProjectTypeToProductionType(activeProject.projectType) as ProductionType,
        writerMode: projectTypeToWriterMode(activeProject.projectType),
        logline: activeProject.masterPrompt,
      });
      setLastPipelineRunAt(Date.now());
      setStudioRoom("home");
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
      const generated = generateStudioRoomAssets(buildAutomationInput() as any, studioRoom as StudioRoomKey) as ProjectAsset[];
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
      const renderAsset = latestAsset(activeProject.studioAssets, ["renderHandoff"]);
      const directionAsset = latestAsset(activeProject.studioAssets, ["storyboard", "shotList"]);
      const parsedPayload = safeJsonParse(renderAsset?.content || "");
      const title = activeProject.title || titleFromPrompt(activeProject.masterPrompt);
      const res = await createRenderJob({
        baseUrl: activeProject.renderBaseUrl,
        projectTitle: title,
        title,
        kind: "video",
        prompt: activeProject.masterPrompt,
        provider: activeProject.renderProvider,
        productionType: activeProject.productionType,
        visualStyle: activeProject.visualStyle,
        releaseTarget: activeProject.releaseTarget,
        format: activeProject.renderFormat,
        fps: activeProject.renderFps,
        resolution: activeProject.renderResolution,
        storyboardSummary: directionAsset?.content || activeProject.masterPrompt,
        assetIds: activeProject.studioAssets.map((asset) => asset.id),
        handoff: parsedPayload || { renderAssetTitle: renderAsset?.title || null },
        promptPack: parsedPayload || undefined,
        payload: parsedPayload || {
          title,
          projectType: activeProject.projectType,
          productionType: activeProject.productionType,
          visualStyle: activeProject.visualStyle,
          releaseTarget: activeProject.releaseTarget,
        },
      });
      setRenderJobs((prev) => [res.job, ...prev.filter((job) => job.id !== res.job.id)]);
      setActiveRenderJobId(res.job.id);
      prependAssetsToActiveProject([{ id: uid(), kind: "renderJob", title: `Render Job • ${title}`, content: JSON.stringify(res.job, null, 2), ts: Date.now() }]);
      setLastRenderSyncAt(Date.now());
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
      prependAssetsToActiveProject([{ id: uid(), kind: "renderJob", title: `Imported Render • ${res.job.title || res.job.projectTitle || activeProject.title}`, content: JSON.stringify(res.job, null, 2), ts: Date.now() }]);
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

  useEffect(() => {
    if (!activeProject?.renderBaseUrl || studioRoom !== "render") return;
    void refreshRenderJobs();
  }, [activeProject?.renderBaseUrl, studioRoom]);

  useEffect(() => {
    if (!activeProject?.renderBaseUrl || !activeRenderJobId || studioRoom !== "render") return;
    const timer = window.setInterval(() => { void pollActiveRenderJob(); }, 3000);
    return () => window.clearInterval(timer);
  }, [activeProject?.renderBaseUrl, activeRenderJobId, studioRoom]);

  if (!activeProject) return <div className="card softCard">Studio is loading…</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card softCard">
        <div className="small shellEyebrow">FAIRLYODD OS / STUDIO</div>
        <div className="h mt-2">All-in-one idea → product spot inside the larger FairlyOdd OS.</div>
        <div className="sub mt-2">
          Use templates to launch faster from blank prompt to a structured project shape, then generate, render, package, and ship in one Studio workspace.
        </div>
      </div>

      <div className="card softCard">
        <div className="small shellEyebrow">STUDIO TEMPLATES</div>
        <div className="sub mt-2">Fast starts for song, book, cartoon short, music video, promo video, and pitch packet.</div>
        <div className="mt-4" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", alignItems: "start" }}>
          {templates.map((template) => (
            <div key={template.id} className="card softCard" style={{ padding: 12, display: "grid", gap: 8 }}>
              <div className="small shellEyebrow">{template.shortLabel.toUpperCase()}</div>
              <div className="small"><b>{template.label}</b></div>
              <div className="small">{template.description}</div>
              <div className="small"><b>First room:</b> {template.recommendedFirstRoom}</div>
              <div className="row wrap" style={{ gap: 8 }}>
                <button className="tabBtn" onClick={() => addProjectFromTemplate(template.id)}>New from template</button>
                <button className={`tabBtn ${activeProject.selectedTemplateId === template.id ? "active" : ""}`} onClick={() => applyTemplateToActiveProject(template.id)}>
                  Apply to active
                </button>
              </div>
            </div>
          ))}
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
                  <div className="small"><b>{project.title}</b></div>
                  <div className="small">{project.masterPrompt || "No master prompt yet."}</div>
                </button>
              ))}
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
              <div className="sub mt-2">Generate the full Studio packet from one master prompt, or regenerate only the current room without wiping the rest of the project.</div>
              <div className="mt-4" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
                <div className="card softCard">
                  <div className="small shellEyebrow">MASTER PROMPT</div>
                  <textarea
                    className="input mt-2"
                    rows={8}
                    value={activeProject.masterPrompt}
                    onChange={(e) => updateActiveProject({
                      masterPrompt: e.target.value,
                      title: titleFromPrompt(e.target.value, activeProject.title),
                      logline: e.target.value,
                    })}
                    placeholder={activeTemplate?.masterPromptStarter || "Describe the song, book, cartoon, video, music video, or other project you want the Studio to build end-to-end."}
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
                          updateActiveProject({
                            projectType: next,
                            writerMode: projectTypeToWriterMode(next),
                            productionType: mapProjectTypeToProductionType(next) as ProductionType,
                          });
                        }}
                      >
                        {PROJECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>

                    <label className="small">
                      Template
                      <select
                        className="input mt-2"
                        value={activeProject.selectedTemplateId || ""}
                        onChange={(e) => {
                          const next = e.target.value as TemplateId | "";
                          updateActiveProject({ selectedTemplateId: next });
                          if (next) applyTemplateToActiveProject(next as TemplateId);
                        }}
                      >
                        <option value="">No template</option>
                        {templates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
                      </select>
                    </label>

                    <button className="tabBtn active" disabled={pipelineBusy} onClick={() => void runGenerateFullPipeline()}>
                      {pipelineBusy ? "Generating…" : "Generate full pipeline"}
                    </button>
                    <button className="tabBtn" disabled={pipelineBusy} onClick={() => void regenerateCurrentRoom()}>
                      {pipelineBusy ? "Working…" : `Regenerate ${activeRoomMeta.label}`}
                    </button>
                    {pipelineError ? <div className="note">{pipelineError}</div> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "start" }}>
              <div className="card softCard">
                <div className="small shellEyebrow">PROJECT CORE</div>
                <div className="small mt-2"><b>Title:</b> {activeProject.title}</div>
                <div className="small mt-2"><b>Project type:</b> {activeProject.projectType}</div>
                <div className="small mt-2"><b>Template:</b> {activeTemplate?.label || "Custom"}</div>
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
                <div className="sub mt-2">Existing local render backend target stays at {activeProject.renderBaseUrl || "http://127.0.0.1:8899"}.</div>
                <div className="mt-3" style={{ display: "grid", gap: 10 }}>
                  <input className="input" value={activeProject.renderBaseUrl} onChange={(e) => updateActiveProject({ renderBaseUrl: e.target.value })} placeholder="http://127.0.0.1:8899" />
                  <div className="row wrap" style={{ gap: 10 }}>
                    <button className="tabBtn active" disabled={renderBusy} onClick={() => void submitRenderJob()}>{renderBusy ? "Submitting…" : "Create render job"}</button>
                    <button className="tabBtn" onClick={() => void refreshRenderJobs()}>Refresh queue</button>
                    <button className="tabBtn" onClick={() => void pollActiveRenderJob()} disabled={!activeRenderJobId}>Poll active</button>
                    <button className="tabBtn" onClick={() => void runImportCompletedRender()} disabled={!activeRenderJobId}>Import completed</button>
                    <button className="tabBtn" onClick={() => void runWatchCompletedRender()} disabled={!activeRenderJobId}>Watch completed</button>
                  </div>
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
                              <div className="small"><b>{job.title || job.projectTitle || job.id}</b></div>
                              <div className="small">Provider: {job.provider || "local-worker"}</div>
                              <div className="small">Progress: {job.progress ?? "—"}</div>
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
                <div className="small mt-3">No assets yet for this room. Generate the full pipeline, or start from a template.</div>
              ) : (
                <div className="mt-3" style={{ display: "grid", gap: 12 }}>
                  {activeRoomAssets.map((asset) => (
                    <div key={asset.id} className="card softCard">
                      <div className="small shellEyebrow">{asset.kind}</div>
                      <div className="small mt-2"><b>{asset.title}</b></div>
                      <div className="small mt-2">{new Date(asset.ts).toLocaleString()}</div>
                      <pre
                        className="writersPlannerPreview"
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          marginTop: 12,
                          maxHeight: 360,
                          overflow: "auto",
                          lineHeight: 1.45,
                          padding: 14,
                        }}
                      >
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
