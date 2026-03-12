import React, { useEffect, useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import {
  assembleFinalProjectPacket,
  downloadTextFile,
  finalProjectPacketToMarkdown,
  generateFullStudioPipeline,
  generateStudioRoomAssets,
  getMissingRooms,
  inferStudioProjectType,
  mapProjectTypeToProductionType,
  splitAssetsByRoom,
  type FinalProjectPacket,
  type StudioAsset as AutomationStudioAsset,
  type StudioProjectType,
  type StudioRoomKey,
} from "../lib/studioAutomation";
import {
  canAdvanceStage,
  getMissingPieces,
  getNextRecommendedAction,
  getReadinessScore,
  getShipBlockers,
  inferStageFromProject,
  nextStage,
  previousStage,
  STAGE_ORDER,
  type WorkflowStage,
} from "../lib/studioWorkflow";
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
  workflowStage: WorkflowStage;

  renderProvider: string;
  renderFormat: string;
  renderFps: string;
  renderResolution: string;
  renderBaseUrl: string;
  autoCreateRenderAfterPipeline?: boolean;

  studioAssets: ProjectAsset[];
  workflowSnapshots?: Array<{ id: string; label: string; packetJson: string; ts: number }>;
};

const KEY = "oddengine:books:v1";
const KEY_ACTIVE = "oddengine:books:active";
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
const KEY_STUDIO_ROOM = "oddengine:writers:studioRoom:v1";
const KEY_STUDIO_PIPELINE_RUN = "oddengine:writers:studioPipelineRun:v1";

type RoomMeta = {
  key: StudioRoomKey;
  label: string;
  blurb: string;
  kinds: string[];
};

const ROOM_META: RoomMeta[] = [
  { key: "home", label: "Studio Home", blurb: "One prompt in, one full project packet out.", kinds: ["oneSheet"] },
  { key: "writing", label: "Writing Room", blurb: "Drafts, lyrics, scripts, story, and working copy.", kinds: ["story", "song"] },
  { key: "director", label: "Director Room", blurb: "Storyboard beats, shot planning, scene flow, and camera logic.", kinds: ["storyboard", "shotList", "videoTreatment", "featureOutline"] },
  { key: "music", label: "Music Lab", blurb: "Song direction, cues, voice ideas, and soundtrack notes.", kinds: ["productionPack", "song"] },
  { key: "render", label: "Render Lab", blurb: "Render handoff, queue, status polling, import, and watch flow.", kinds: ["renderHandoff", "renderJob"] },
  { key: "ops", label: "Producer Ops", blurb: "Runbooks, packaging, screening packets, and final ship checklist.", kinds: ["productionRunbook", "screeningPacket", "oneSheet", "productionPack"] },
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

function newestFirst<T extends { ts?: number }>(items: T[]) {
  return [...items].sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
}

function createBlankProject(seed?: Partial<StudioProject>): StudioProject {
  const projectType = seed?.projectType || "video";
  const stage = (seed?.workflowStage || "Idea") as WorkflowStage;
  return {
    id: seed?.id || uid(),
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
    workflowStage: stage,

    renderProvider: seed?.renderProvider || "local-worker",
    renderFormat: seed?.renderFormat || "mp4",
    renderFps: seed?.renderFps || "24 fps",
    renderResolution: seed?.renderResolution || "1080p",
    renderBaseUrl: seed?.renderBaseUrl || "http://127.0.0.1:8899",
    autoCreateRenderAfterPipeline: Boolean(seed?.autoCreateRenderAfterPipeline),

    studioAssets: seed?.studioAssets || [],
    workflowSnapshots: seed?.workflowSnapshots || [],
  };
}

function coerceProject(raw: any, fallbackAssets: ProjectAsset[] = []): StudioProject {
  const inferred = (raw?.projectType || inferStudioProjectType(raw?.writerMode || "story")) as StudioProjectType;
  const assets = Array.isArray(raw?.studioAssets) ? raw.studioAssets : fallbackAssets;
  const stage = (raw?.workflowStage || inferStageFromProject({
    title: String(raw?.title || ""),
    masterPrompt: String(raw?.masterPrompt || raw?.logline || ""),
    projectType: inferred,
    productionType: String(raw?.productionType || mapProjectTypeToProductionType(inferred)),
    stage: "Idea",
    assets: Array.isArray(assets) ? assets : [],
    renderJobs: [],
  })) as WorkflowStage;
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
    workflowStage: stage,
    renderProvider: String(raw?.renderProvider || "local-worker"),
    renderFormat: String(raw?.renderFormat || "mp4"),
    renderFps: String(raw?.renderFps || "24 fps"),
    renderResolution: String(raw?.renderResolution || "1080p"),
    renderBaseUrl: String(raw?.renderBaseUrl || "http://127.0.0.1:8899"),
    autoCreateRenderAfterPipeline: Boolean(raw?.autoCreateRenderAfterPipeline),
    studioAssets: Array.isArray(assets) ? assets : [],
    workflowSnapshots: Array.isArray(raw?.workflowSnapshots) ? raw.workflowSnapshots : [],
  });
}

function latestAsset(assets: ProjectAsset[], kinds: string[]) {
  return newestFirst(assets).find((a) => kinds.includes(a.kind));
}

function roomAssets(assets: ProjectAsset[], room: StudioRoomKey) {
  const meta = ROOM_META.find((r) => r.key === room);
  if (!meta) return [];
  return newestFirst(assets).filter((asset) => meta.kinds.includes(asset.kind));
}

function toPacketFilename(title: string, ext: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "studio-project"}.${ext}`;
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
  const [assetViewMode, setAssetViewMode] = useState<"latest" | "all">("latest");
  const [assetFilterKind, setAssetFilterKind] = useState<string>("all");
  const [collapsedAssetIds, setCollapsedAssetIds] = useState<Record<string, boolean>>({});
  const [packetCopiedState, setPacketCopiedState] = useState<"" | "json" | "md">("");
  const [snapshotMessage, setSnapshotMessage] = useState("");

  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [activeRenderJobId, setActiveRenderJobId] = useState<string>("");
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [lastRenderSyncAt, setLastRenderSyncAt] = useState<number>(0);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeId) || projects[0] || null,
    [projects, activeId]
  );

  const activeRoomMeta = ROOM_META.find((room) => room.key === studioRoom) || ROOM_META[0];
  const activeRoomAssets = useMemo(() => (activeProject ? roomAssets(activeProject.studioAssets, studioRoom) : []), [activeProject, studioRoom]);
  const splitRooms = useMemo(() => splitAssetsByRoom((activeProject?.studioAssets || []) as AutomationStudioAsset[]), [activeProject]);
  const missingRooms = useMemo(() => getMissingRooms((activeProject?.studioAssets || []) as AutomationStudioAsset[]), [activeProject]);

  const activeRenderJob = useMemo(
    () => renderJobs.find((job) => job.id === activeRenderJobId) || renderJobs[0] || null,
    [renderJobs, activeRenderJobId]
  );

  const workflowSummary = useMemo(() => {
    if (!activeProject) return null;
    return {
      title: activeProject.title,
      masterPrompt: activeProject.masterPrompt,
      projectType: activeProject.projectType,
      productionType: activeProject.productionType,
      stage: activeProject.workflowStage,
      assets: activeProject.studioAssets,
      renderJobs,
    };
  }, [activeProject, renderJobs]);

  const readinessScore = workflowSummary ? getReadinessScore(workflowSummary) : 0;
  const missingPieces = workflowSummary ? getMissingPieces(workflowSummary) : [];
  const shipBlockers = workflowSummary ? getShipBlockers(workflowSummary) : [];
  const nextRecommendedAction = workflowSummary ? getNextRecommendedAction(workflowSummary) : "";

  const finalPacket = useMemo<FinalProjectPacket | null>(() => {
    if (!activeProject) return null;
    return assembleFinalProjectPacket({
      masterPrompt: activeProject.masterPrompt,
      projectType: activeProject.projectType,
      visualStyle: activeProject.visualStyle,
      productionType: activeProject.productionType,
      releaseTarget: activeProject.releaseTarget,
      budgetBand: activeProject.budgetBand,
      scopeLevel: activeProject.scopeLevel,
      existingAssets: activeProject.studioAssets as AutomationStudioAsset[],
    });
  }, [activeProject]);

  const filteredRoomAssets = useMemo(() => {
    let list = activeRoomAssets;
    if (assetFilterKind !== "all") list = list.filter((asset) => asset.kind === assetFilterKind);
    if (assetViewMode === "latest") {
      const seen = new Set<string>();
      list = list.filter((asset) => {
        if (seen.has(asset.kind)) return false;
        seen.add(asset.kind);
        return true;
      });
    }
    return list;
  }, [activeRoomAssets, assetFilterKind, assetViewMode]);

  useEffect(() => {
    if (!activeId && projects[0]?.id) setActiveId(projects[0].id);
  }, [activeId, projects]);

  useEffect(() => { saveJSON(KEY, projects); }, [projects]);
  useEffect(() => { saveJSON(KEY_STUDIO_ROOM, studioRoom); }, [studioRoom]);
  useEffect(() => { saveJSON(KEY_STUDIO_PIPELINE_RUN, lastPipelineRunAt); }, [lastPipelineRunAt]);

  useEffect(() => {
    if (!activeProject) return;
    saveJSON(KEY_ACTIVE, activeProject.id);
    saveJSON(KEY_WRITER_MODE, activeProject.writerMode);
    saveJSON(KEY_STUDIO_PROMPT, activeProject.masterPrompt);
    saveJSON(KEY_STUDIO_ASSETS, activeProject.studioAssets);
    saveJSON(KEY_VISUAL_STYLE, activeProject.visualStyle);
    saveJSON(KEY_PRODUCTION_TYPE, activeProject.productionType);
    saveJSON(KEY_RELEASE_TARGET, activeProject.releaseTarget);
    saveJSON(KEY_BUDGET_BAND, activeProject.budgetBand);
    saveJSON(KEY_SCOPE_LEVEL, activeProject.scopeLevel);
    saveJSON(KEY_RENDER_PROVIDER, activeProject.renderProvider);
    saveJSON(KEY_RENDER_FORMAT, activeProject.renderFormat);
    saveJSON(KEY_RENDER_FPS, activeProject.renderFps);
    saveJSON(KEY_RENDER_RESOLUTION, activeProject.renderResolution);
    saveJSON(KEY_RENDER_BASE, activeProject.renderBaseUrl);
  }, [activeProject]);

  const updateActiveProject = (patch: Partial<StudioProject>) => {
    if (!activeProject) return;
    setProjects((prev) => prev.map((project) => project.id === activeProject.id ? { ...project, ...patch, updatedAt: Date.now() } : project));
  };

  const prependAssetsToActiveProject = (assets: ProjectAsset[]) => {
    if (!activeProject || !assets.length) return;
    updateActiveProject({ studioAssets: [...assets, ...activeProject.studioAssets] });
  };

  const addProject = () => {
    const next = createBlankProject();
    setProjects((prev) => [next, ...prev]);
    setActiveId(next.id);
    setStudioRoom("home");
  };

  const duplicateProject = () => {
    if (!activeProject) return;
    const next = createBlankProject({ ...activeProject, id: uid(), title: `${activeProject.title} Copy`, studioAssets: [...activeProject.studioAssets], workflowSnapshots: [...(activeProject.workflowSnapshots || [])] });
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

  const createRenderFromLatestHandoff = async () => {
    if (!activeProject) return;
    setRenderBusy(true);
    setRenderError("");
    try {
      const renderAsset = latestAsset(activeProject.studioAssets, ["renderHandoff"]);
      if (!renderAsset) throw new Error("Generate the Render Lab room first.");
      const directionAsset = latestAsset(activeProject.studioAssets, ["storyboard", "shotList"]);
      const parsedPayload = safeJsonParse(renderAsset.content || "");
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
        handoff: parsedPayload || { renderAssetTitle: renderAsset.title },
        promptPack: parsedPayload || undefined,
        payload: parsedPayload || {
          title,
          projectType: activeProject.projectType,
          productionType: activeProject.productionType,
          visualStyle: activeProject.visualStyle,
          releaseTarget: activeProject.releaseTarget,
          budgetBand: activeProject.budgetBand,
          scopeLevel: activeProject.scopeLevel,
        },
      });
      setRenderJobs((prev) => [res.job, ...prev.filter((job) => job.id !== res.job.id)]);
      setActiveRenderJobId(res.job.id);
      setLastRenderSyncAt(Date.now());
      prependAssetsToActiveProject([{ id: uid(), kind: "renderJob", title: `Render Job • ${title}`, content: JSON.stringify(res.job, null, 2), ts: Date.now() }]);
      if (activeProject.workflowStage === "Render") updateActiveProject({ workflowStage: "Review" });
    } catch (error: any) {
      setRenderError(error?.message || String(error));
    } finally {
      setRenderBusy(false);
    }
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
      updateActiveProject({
        title: titleFromPrompt(activeProject.masterPrompt, activeProject.title),
        productionType: mapProjectTypeToProductionType(activeProject.projectType) as ProductionType,
        writerMode: projectTypeToWriterMode(activeProject.projectType),
        logline: activeProject.masterPrompt,
        workflowStage: activeProject.autoCreateRenderAfterPipeline ? "Render" : "Draft",
      });
      setLastPipelineRunAt(Date.now());
      setStudioRoom("home");
      if (activeProject.autoCreateRenderAfterPipeline) await createRenderFromLatestHandoff();
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
      setLastPipelineRunAt(Date.now());
    } catch (error: any) {
      setPipelineError(error?.message || String(error));
    } finally {
      setPipelineBusy(false);
    }
  };

  const generateMissingRooms = async () => {
    if (!activeProject) return;
    setPipelineBusy(true);
    setPipelineError("");
    try {
      const input = buildAutomationInput();
      const generated = missingRooms.flatMap((room) => generateStudioRoomAssets(input as any, room)) as ProjectAsset[];
      prependAssetsToActiveProject(generated);
      setLastPipelineRunAt(Date.now());
    } catch (error: any) {
      setPipelineError(error?.message || String(error));
    } finally {
      setPipelineBusy(false);
    }
  };

  const advanceStage = () => {
    if (!activeProject) return;
    if (!canAdvanceStage(activeProject.workflowStage)) return;
    updateActiveProject({ workflowStage: nextStage(activeProject.workflowStage) });
  };

  const moveStageBack = () => {
    if (!activeProject) return;
    updateActiveProject({ workflowStage: previousStage(activeProject.workflowStage) });
  };

  const autoStageFromProject = () => {
    if (!workflowSummary || !activeProject) return;
    updateActiveProject({ workflowStage: inferStageFromProject(workflowSummary) });
  };

  const copyPacketJson = async () => {
    if (!finalPacket) return;
    await navigator.clipboard.writeText(JSON.stringify(finalPacket, null, 2));
    setPacketCopiedState("json");
  };
  const copyPacketMarkdown = async () => {
    if (!finalPacket) return;
    await navigator.clipboard.writeText(finalProjectPacketToMarkdown(finalPacket));
    setPacketCopiedState("md");
  };
  const downloadPacketJson = () => {
    if (!finalPacket || !activeProject) return;
    downloadTextFile(toPacketFilename(activeProject.title || "studio-project", "json"), JSON.stringify(finalPacket, null, 2), "application/json");
  };
  const downloadPacketMarkdown = () => {
    if (!finalPacket || !activeProject) return;
    downloadTextFile(toPacketFilename(activeProject.title || "studio-project", "md"), finalProjectPacketToMarkdown(finalPacket), "text/markdown");
  };

  const freezeCurrentPacket = () => {
    if (!activeProject || !finalPacket) return;
    const snapshot = {
      id: uid(),
      label: `${activeProject.workflowStage} • ${new Date().toLocaleString()}`,
      packetJson: JSON.stringify(finalPacket, null, 2),
      ts: Date.now(),
    };
    updateActiveProject({ workflowSnapshots: [snapshot, ...(activeProject.workflowSnapshots || [])] });
    setSnapshotMessage(`Snapshot saved: ${snapshot.label}`);
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

  const copyLatestRenderPayload = async () => {
    const latest = latestAsset(activeProject?.studioAssets || [], ["renderHandoff"]);
    if (!latest) return;
    await navigator.clipboard.writeText(latest.content);
  };

  const toggleAssetCollapse = (id: string) => setCollapsedAssetIds((prev) => ({ ...prev, [id]: !prev[id] }));

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
        <div className="h mt-2">Idea-to-product workflow desk inside the larger FairlyOdd OS.</div>
        <div className="sub mt-2">
          Move projects from Idea → Draft → Build → Render → Review → Package → Publish,
          while the Studio keeps showing what is missing, what is blocking ship, and what to do next.
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
                  <div className="small shellEyebrow">{project.projectType} • {project.workflowStage}</div>
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
            <div className="small shellEyebrow">WORKFLOW STATUS</div>
            <div className="small mt-3"><b>Readiness:</b> {readinessScore}%</div>
            <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginTop: 10 }}>
              <div style={{ width: `${readinessScore}%`, height: "100%", background: "linear-gradient(90deg, rgba(97,235,166,0.7), rgba(255,210,102,0.8))" }} />
            </div>
            <div className="small mt-3"><b>Next action:</b> {nextRecommendedAction}</div>
            <div className="small mt-2"><b>Missing pieces:</b> {missingPieces.length ? missingPieces.join(", ") : "None"}</div>
            <div className="small mt-2"><b>Ship blockers:</b> {shipBlockers.length ? shipBlockers.length : 0}</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div className="card softCard">
            <div className="small shellEyebrow">IDEA → PRODUCT WORKFLOW</div>
            <div className="row wrap mt-3" style={{ gap: 8 }}>
              {STAGE_ORDER.map((stage, idx) => {
                const active = activeProject.workflowStage === stage;
                const passed = STAGE_ORDER.indexOf(activeProject.workflowStage) > idx;
                return (
                  <button
                    key={stage}
                    className={`tabBtn ${active ? "active" : ""}`}
                    style={{ opacity: passed || active ? 1 : 0.72 }}
                    onClick={() => updateActiveProject({ workflowStage: stage })}
                  >
                    {stage}
                  </button>
                );
              })}
            </div>

            <div className="card softCard mt-4">
              <div className="small shellEyebrow">STAGE CONTROLS</div>
              <div className="sub mt-2">Advance, step back, or auto-infer the right stage from the current project state.</div>
              <div className="row wrap mt-3" style={{ gap: 10 }}>
                <button className="tabBtn" onClick={moveStageBack}>Back</button>
                <button className="tabBtn active" onClick={advanceStage} disabled={!canAdvanceStage(activeProject.workflowStage)}>Advance stage</button>
                <button className="tabBtn" onClick={autoStageFromProject}>Auto stage from project</button>
              </div>
            </div>

            <div className="card softCard mt-4">
              <div className="small shellEyebrow">NEXT RECOMMENDED ACTION</div>
              <div className="sub mt-2">{nextRecommendedAction}</div>
              <div className="note mt-3">
                {shipBlockers.length ? shipBlockers.join(" • ") : "No active ship blockers right now."}
              </div>
            </div>
          </div>

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
              <div className="sub mt-2">Generate the full pipeline, generate only missing rooms, or regenerate the current room without wiping the rest of the project.</div>

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
                      Visual style
                      <input className="input mt-2" value={activeProject.visualStyle} onChange={(e) => updateActiveProject({ visualStyle: e.target.value as VisualStyle })} />
                    </label>

                    <label className="small">
                      Release target
                      <input className="input mt-2" value={activeProject.releaseTarget} onChange={(e) => updateActiveProject({ releaseTarget: e.target.value as ReleaseTarget })} />
                    </label>

                    <label className="small">
                      <input type="checkbox" checked={!!activeProject.autoCreateRenderAfterPipeline} onChange={(e) => updateActiveProject({ autoCreateRenderAfterPipeline: e.target.checked })} />
                      <span style={{ marginLeft: 8 }}>Auto-create render after full pipeline</span>
                    </label>

                    <button className="tabBtn active" disabled={pipelineBusy} onClick={() => void runGenerateFullPipeline()}>
                      {pipelineBusy ? "Generating…" : "Generate full pipeline"}
                    </button>

                    <button className="tabBtn" disabled={pipelineBusy} onClick={() => void generateMissingRooms()}>
                      {pipelineBusy ? "Working…" : `Generate missing rooms${missingRooms.length ? ` (${missingRooms.length})` : ""}`}
                    </button>

                    <button className="tabBtn" disabled={pipelineBusy} onClick={() => void regenerateCurrentRoom()}>
                      {pipelineBusy ? "Working…" : `Regenerate ${activeRoomMeta.label}`}
                    </button>

                    <div className="small"><b>Missing rooms:</b> {missingRooms.length ? missingRooms.join(", ") : "None"}</div>
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
                <div className="small mt-2"><b>Production type:</b> {activeProject.productionType}</div>
                <div className="small mt-2"><b>Visual style:</b> {activeProject.visualStyle}</div>
                <div className="small mt-2"><b>Release target:</b> {activeProject.releaseTarget}</div>
                <div className="small mt-2"><b>Stage:</b> {activeProject.workflowStage}</div>
              </div>

              <div className="card softCard">
                <div className="small shellEyebrow">ACTIVE ROOM OUTPUTS</div>
                <div className="small mt-2">{activeRoomAssets.length} assets in {activeRoomMeta.label}</div>
                <div className="small mt-2">Most recent: {activeRoomAssets[0]?.title || "Nothing generated yet."}</div>
                <div className="small mt-2"><b>Last full run:</b> {lastPipelineRunAt ? new Date(lastPipelineRunAt).toLocaleString() : "Not run yet"}</div>
              </div>
            </div>

            <div className="card softCard mt-4">
              <div className="small shellEyebrow">ROOM SUMMARY</div>
              <div className="row wrap mt-3" style={{ gap: 10 }}>
                <div className="small"><b>Room:</b> {activeRoomMeta.label}</div>
                <div className="small"><b>Assets:</b> {activeRoomAssets.length}</div>
                <div className="small"><b>Latest:</b> {activeRoomAssets[0]?.title || "None yet"}</div>
                <div className="small"><b>Updated:</b> {activeRoomAssets[0] ? new Date(activeRoomAssets[0].ts).toLocaleString() : "—"}</div>
              </div>
              <div className="row wrap mt-3" style={{ gap: 10 }}>
                <button className={`tabBtn ${assetViewMode === "latest" ? "active" : ""}`} onClick={() => setAssetViewMode("latest")}>Latest only</button>
                <button className={`tabBtn ${assetViewMode === "all" ? "active" : ""}`} onClick={() => setAssetViewMode("all")}>All</button>
                <select className="input" value={assetFilterKind} onChange={(e) => setAssetFilterKind(e.target.value)} style={{ minWidth: 180 }}>
                  <option value="all">All asset types</option>
                  {Array.from(new Set(activeRoomAssets.map((a) => a.kind))).map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                </select>
              </div>
            </div>

            <div className="card softCard mt-4">
              <div className="small shellEyebrow">WORKFLOW DIAGNOSTICS</div>
              <div className="sub mt-2">The Studio reads your current stage, missing pieces, blockers, and readiness so you know what to do next.</div>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "start", marginTop: 12 }}>
                <div className="card softCard">
                  <div className="small shellEyebrow">MISSING PIECES</div>
                  {missingPieces.length ? <ul style={{ marginTop: 12, paddingLeft: 18 }}>{missingPieces.map((piece) => <li key={piece}>{piece}</li>)}</ul> : <div className="small mt-3">Nothing obvious is missing for this stage.</div>}
                </div>
                <div className="card softCard">
                  <div className="small shellEyebrow">SHIP BLOCKERS</div>
                  {shipBlockers.length ? <ul style={{ marginTop: 12, paddingLeft: 18 }}>{shipBlockers.map((piece) => <li key={piece}>{piece}</li>)}</ul> : <div className="small mt-3">No active ship blockers right now.</div>}
                </div>
              </div>
            </div>

            <div className="card softCard mt-4">
              <div className="small shellEyebrow">FINAL PROJECT PACKET</div>
              <div className="sub mt-2">Assemble a ready-to-copy or downloadable Studio packet from the current project state.</div>
              <div className="row wrap mt-3" style={{ gap: 10 }}>
                <button className="tabBtn" onClick={() => void copyPacketJson()}>Copy JSON</button>
                <button className="tabBtn" onClick={() => void copyPacketMarkdown()}>Copy Markdown</button>
                <button className="tabBtn" onClick={() => void downloadPacketJson()}>Download .json</button>
                <button className="tabBtn" onClick={() => void downloadPacketMarkdown()}>Download .md</button>
                <button className="tabBtn" onClick={() => freezeCurrentPacket()}>Freeze current packet</button>
              </div>
              <div className="small mt-3"><b>Status:</b> {packetCopiedState ? `Copied ${packetCopiedState}` : "Ready"}</div>
              {snapshotMessage ? <div className="note mt-3">{snapshotMessage}</div> : null}
              <pre className="writersPlannerPreview" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 12, maxHeight: 360, overflow: "auto", lineHeight: 1.45, padding: 14 }}>
                {finalPacket ? JSON.stringify(finalPacket, null, 2) : "No packet yet."}
              </pre>
            </div>

            {studioRoom === "render" ? (
              <div className="card softCard mt-4">
                <div className="small shellEyebrow">RENDER LAB</div>
                <div className="sub mt-2">Existing local render backend target stays at {activeProject.renderBaseUrl || "http://127.0.0.1:8899"}.</div>
                <div className="card softCard mt-3">
                  <div className="small shellEyebrow">LATEST RENDER STATUS</div>
                  <div className="small mt-2">{activeRenderJob ? `${activeRenderJob.status || "unknown"} • ${activeRenderJob.title || activeRenderJob.projectTitle || activeRenderJob.id}` : "No render job yet."}</div>
                </div>
                <div className="mt-3" style={{ display: "grid", gap: 10 }}>
                  <input className="input" value={activeProject.renderBaseUrl} onChange={(e) => updateActiveProject({ renderBaseUrl: e.target.value })} placeholder="http://127.0.0.1:8899" />
                  <div className="row wrap" style={{ gap: 10 }}>
                    <button className="tabBtn active" disabled={renderBusy || !latestAsset(activeProject.studioAssets, ["renderHandoff"])} onClick={() => void createRenderFromLatestHandoff()}>
                      {renderBusy ? "Submitting…" : "Create render from latest handoff"}
                    </button>
                    <button className="tabBtn" onClick={() => void refreshRenderJobs()}>Refresh queue</button>
                    <button className="tabBtn" onClick={() => void pollActiveRenderJob()} disabled={!activeRenderJobId}>Poll active</button>
                    <button className="tabBtn" onClick={() => void runImportCompletedRender()} disabled={!activeRenderJobId}>Import completed</button>
                    <button className="tabBtn" onClick={() => void runWatchCompletedRender()} disabled={!activeRenderJobId}>Watch completed</button>
                    <button className="tabBtn" onClick={() => void copyLatestRenderPayload()} disabled={!latestAsset(activeProject.studioAssets, ["renderHandoff"])}>Copy render payload</button>
                  </div>
                  {renderError ? <div className="note">{renderError}</div> : null}
                  <div className="small"><b>Last sync:</b> {lastRenderSyncAt ? new Date(lastRenderSyncAt).toLocaleString() : "No sync yet"}</div>
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "start" }}>
                    <div className="card softCard">
                      <div className="small shellEyebrow">QUEUE</div>
                      {!renderJobs.length ? <div className="small mt-3">No render jobs yet.</div> : (
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
                      {!activeRenderJob ? <div className="small mt-3">Select a render job from the queue.</div> : (
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
              {!filteredRoomAssets.length ? (
                <div className="small mt-3">No assets yet for this room. Generate the full pipeline or regenerate this room.</div>
              ) : (
                <div className="mt-3" style={{ display: "grid", gap: 12 }}>
                  {filteredRoomAssets.map((asset, index) => {
                    const collapsed = collapsedAssetIds[asset.id] ?? (index > 1);
                    return (
                      <div key={asset.id} className="card softCard">
                        <div className="row wrap spread" style={{ gap: 10 }}>
                          <div>
                            <div className="small shellEyebrow">{asset.kind}</div>
                            <div className="small mt-2"><b>{asset.title}</b></div>
                            <div className="small mt-2">{new Date(asset.ts).toLocaleString()}</div>
                          </div>
                          <button className="tabBtn" onClick={() => toggleAssetCollapse(asset.id)}>
                            {collapsed ? "Expand" : "Collapse"}
                          </button>
                        </div>
                        {!collapsed ? (
                          <pre className="writersPlannerPreview" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 12, maxHeight: 360, overflow: "auto", lineHeight: 1.45, padding: 14 }}>
                            {asset.content}
                          </pre>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card softCard mt-4">
              <div className="small shellEyebrow">WORKFLOW SNAPSHOTS</div>
              {!activeProject.workflowSnapshots?.length ? (
                <div className="small mt-3">No snapshots yet. Freeze the current packet to preserve a project milestone.</div>
              ) : (
                <div className="mt-3" style={{ display: "grid", gap: 10 }}>
                  {activeProject.workflowSnapshots.slice(0, 6).map((snap) => (
                    <div key={snap.id} className="card softCard">
                      <div className="small shellEyebrow">{snap.label}</div>
                      <div className="small mt-2">{new Date(snap.ts).toLocaleString()}</div>
                      <pre className="writersPlannerPreview" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 12, maxHeight: 180, overflow: "auto", lineHeight: 1.45, padding: 14 }}>
                        {snap.packetJson}
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
