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
import { buildPanelConnectionStatus, buildMissingInputsLabel } from "../lib/panelConnections";
import {
  WORKFLOW_STAGES,
  ROOM_LABELS,
  createDefaultReviewBoardState,
  nextStage,
  previousStage,
  inferStageFromProject,
  buildReadinessSnapshot,
  roomKinds,
  type WorkflowStage,
  type RoomReviewStatus,
  type ReviewBoardState,
} from "../lib/studioReviewBoard";
import {
  INTAKE_PRESETS,
  buildCreativeBriefFromIntake,
  buildScopeDefinitionFromIntake,
  createIntakeSnapshot,
  intakeSnapshotToMarkdown,
  toLineItems,
  type BriefApprovalState,
  type CreativeBrief,
  type IntakeSnapshot,
  type ScopeDefinition,
  type StudioIntake,
} from "../lib/studioIntake";

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

type StudioSnapshot = {
  id: string;
  label: string;
  createdAt: number;
  stage: WorkflowStage;
  title: string;
  packetJson: string;
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

  studioAssets: ProjectAsset[];
  reviewBoard: ReviewBoardState;
  intakeSnapshot: IntakeSnapshot;
  snapshots: StudioSnapshot[];
  publishTitle: string;
  publishSubtitle: string;
  publishSummary: string;
};

const KEY = "oddengine:books:v1";
const KEY_ACTIVE = "oddengine:books:active";
const KEY_STUDIO_ROOM = "oddengine:writers:studioRoom:v1";

const ROOM_META: Array<{
  key: StudioRoomKey;
  label: string;
  blurb: string;
}> = [
  { key: "home", label: "Studio Home", blurb: "Brief, concept, and product framing." },
  { key: "writing", label: "Writing Room", blurb: "Story, scripts, lyrics, and working copy." },
  { key: "director", label: "Director Room", blurb: "Storyboard beats, shot logic, scene shape." },
  { key: "music", label: "Music Lab", blurb: "Music direction, cues, voice ideas, soundtrack notes." },
  { key: "render", label: "Render Lab", blurb: "Render handoff, queue, imports, and watch flow." },
  { key: "ops", label: "Producer Ops", blurb: "Runbooks, release prep, publish packaging." },
];

const PROJECT_TYPES: StudioProjectType[] = [
  "song",
  "book",
  "cartoon",
  "video",
  "music video",
  "other",
];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function titleFromPrompt(prompt: string, fallback = "Untitled Studio Project") {
  const text = String(prompt || "").trim();
  if (!text) return fallback;
  return text
    .split(/\s+/)
    .slice(0, 8)
    .join(" ")
    .replace(/[.,:;!?]+$/g, "");
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

function latestAsset(assets: ProjectAsset[], kinds: string[]) {
  return newestFirst(assets).find((a) => kinds.includes(a.kind));
}

function roomAssets(assets: ProjectAsset[], room: StudioRoomKey) {
  return newestFirst(assets).filter((asset) => roomKinds(room).includes(asset.kind));
}

function buildPacket(project: StudioProject) {
  const byRoom = {
    home: roomAssets(project.studioAssets, "home"),
    writing: roomAssets(project.studioAssets, "writing"),
    director: roomAssets(project.studioAssets, "director"),
    music: roomAssets(project.studioAssets, "music"),
    render: roomAssets(project.studioAssets, "render"),
    ops: roomAssets(project.studioAssets, "ops"),
  };

  return {
    title: project.title,
    subtitle: project.publishSubtitle || project.subtitle || "",
    summary: project.publishSummary || project.logline || project.masterPrompt,
    projectType: project.projectType,
    productionType: project.productionType,
    visualStyle: project.visualStyle,
    releaseTarget: project.releaseTarget,
    budgetBand: project.budgetBand,
    scopeLevel: project.scopeLevel,
    stage: project.reviewBoard.stage,
    readyToShip: project.reviewBoard.readyToShip,
    reviewByRoom: project.reviewBoard.reviewByRoom,
    notesByRoom: project.reviewBoard.notesByRoom,
    rooms: byRoom,
    snapshots: project.snapshots,
  };
}

function packetMarkdown(project: StudioProject) {
  const packet = buildPacket(project);
  const sections = (Object.keys(packet.rooms) as StudioRoomKey[]).map((room) => {
    const assets = packet.rooms[room];
    const latest = assets[0];
    return [
      `## ${ROOM_LABELS[room]}`,
      `Review: ${packet.reviewByRoom[room]}`,
      packet.notesByRoom[room] ? `Notes: ${packet.notesByRoom[room]}` : "",
      latest ? `Latest: ${latest.title}` : "Latest: None yet",
      "",
      latest ? latest.content : "No content yet.",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    `# ${packet.title}`,
    packet.subtitle ? packet.subtitle : "",
    "",
    `**Stage:** ${packet.stage}`,
    `**Ready to ship:** ${packet.readyToShip ? "Yes" : "No"}`,
    `**Release target:** ${packet.releaseTarget}`,
    `**Summary:** ${packet.summary}`,
    "",
    ...sections,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function copyText(text: string) {
  return navigator.clipboard.writeText(text);
}

function downloadTextFile(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = filename;
  el.click();
  URL.revokeObjectURL(url);
}

function createBlankProject(seed?: Partial<StudioProject>): StudioProject {
  const projectType = seed?.projectType || "video";
  const reviewBoard = seed?.reviewBoard || createDefaultReviewBoardState();
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
    renderProvider: seed?.renderProvider || "local-worker",
    renderFormat: seed?.renderFormat || "mp4",
    renderFps: seed?.renderFps || "24 fps",
    renderResolution: seed?.renderResolution || "1080p",
    renderBaseUrl: seed?.renderBaseUrl || "http://127.0.0.1:8899",
    studioAssets: seed?.studioAssets || [],
    reviewBoard,
    intakeSnapshot: seed?.intakeSnapshot || createIntakeSnapshot(INTAKE_PRESETS.blank.intake),
    snapshots: seed?.snapshots || [],
    publishTitle: seed?.publishTitle || seed?.title || "Untitled Studio Project",
    publishSubtitle: seed?.publishSubtitle || "",
    publishSummary: seed?.publishSummary || "",
  };
}

function coerceProject(raw: any): StudioProject {
  const inferred = (raw?.projectType ||
    inferStudioProjectType(raw?.writerMode || "story")) as StudioProjectType;
  const reviewBoard = {
    ...createDefaultReviewBoardState(),
    ...(raw?.reviewBoard || {}),
    reviewByRoom: {
      ...createDefaultReviewBoardState().reviewByRoom,
      ...(raw?.reviewBoard?.reviewByRoom || {}),
    },
    notesByRoom: {
      ...createDefaultReviewBoardState().notesByRoom,
      ...(raw?.reviewBoard?.notesByRoom || {}),
    },
  };
  reviewBoard.stage = inferStageFromProject(raw?.studioAssets || [], reviewBoard.reviewByRoom, reviewBoard.readyToShip);

  return createBlankProject({
    id: String(raw?.id || uid()),
    title: String(raw?.title || titleFromPrompt(raw?.masterPrompt || raw?.logline || "")),
    subtitle: String(raw?.subtitle || ""),
    status: raw?.status || "Idea",
    logline: String(raw?.logline || ""),
    notes: String(raw?.notes || ""),
    chapters: Array.isArray(raw?.chapters) ? raw.chapters : [],
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
    renderBaseUrl: String(raw?.renderBaseUrl || "http://127.0.0.1:8899"),
    studioAssets: Array.isArray(raw?.studioAssets) ? raw.studioAssets : [],
    reviewBoard,
    intakeSnapshot: raw?.intakeSnapshot
      ? createIntakeSnapshot(
          raw.intakeSnapshot.intake || INTAKE_PRESETS.blank.intake,
          raw.intakeSnapshot.brief || {},
          raw.intakeSnapshot.scope || {},
          (raw.intakeSnapshot.approvalState || "pending brief") as BriefApprovalState
        )
      : createIntakeSnapshot(INTAKE_PRESETS.blank.intake),
    snapshots: Array.isArray(raw?.snapshots) ? raw.snapshots : [],
    publishTitle: String(raw?.publishTitle || raw?.title || "Untitled Studio Project"),
    publishSubtitle: String(raw?.publishSubtitle || ""),
    publishSummary: String(raw?.publishSummary || raw?.masterPrompt || ""),
  });
}

export default function Books() {
  const [projects, setProjects] = useState<StudioProject[]>(() => {
    const raw = loadJSON<any[]>(KEY, []);
    if (Array.isArray(raw) && raw.length) {
      return raw.map((item) => coerceProject(item));
    }
    return [createBlankProject()];
  });

  const [activeId, setActiveId] = useState<string>(() => loadJSON<string>(KEY_ACTIVE, ""));
  const [studioRoom, setStudioRoom] = useState<StudioRoomKey>(() =>
    loadJSON<StudioRoomKey>(KEY_STUDIO_ROOM, "home")
  );

  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineError, setPipelineError] = useState("");
  const [packetCopiedState, setPacketCopiedState] = useState<"" | "json" | "md">("");
  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [activeRenderJobId, setActiveRenderJobId] = useState<string>("");
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [lastRenderSyncAt, setLastRenderSyncAt] = useState<number>(0);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeId) || projects[0] || null,
    [projects, activeId]
  );

  const activeRoomAssets = useMemo(
    () => (activeProject ? roomAssets(activeProject.studioAssets, studioRoom) : []),
    [activeProject, studioRoom]
  );

  const activeRenderJob = useMemo(
    () => renderJobs.find((job) => job.id === activeRenderJobId) || renderJobs[0] || null,
    [renderJobs, activeRenderJobId]
  );

  const studioSetup = useMemo(() => buildPanelConnectionStatus("Books"), []);

  const readiness = useMemo(() => {
    if (!activeProject) return null;
    return buildReadinessSnapshot({
      stage: activeProject.reviewBoard.stage,
      assets: activeProject.studioAssets,
      reviewByRoom: activeProject.reviewBoard.reviewByRoom,
      readyToShip: activeProject.reviewBoard.readyToShip,
    });
  }, [activeProject]);

  useEffect(() => {
    if (!activeId && projects[0]?.id) setActiveId(projects[0].id);
  }, [activeId, projects]);

  useEffect(() => {
    saveJSON(KEY, projects);
  }, [projects]);

  useEffect(() => {
    if (!activeProject) return;
    saveJSON(KEY_ACTIVE, activeProject.id);
  }, [activeProject]);

  useEffect(() => {
    saveJSON(KEY_STUDIO_ROOM, studioRoom);
  }, [studioRoom]);

  const updateActiveProject = (patch: Partial<StudioProject>) => {
    if (!activeProject) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProject.id
          ? { ...project, ...patch, updatedAt: Date.now() }
          : project
      )
    );
  };

  const updateReviewBoard = (patch: Partial<ReviewBoardState>) => {
    if (!activeProject) return;
    updateActiveProject({
      reviewBoard: {
        ...activeProject.reviewBoard,
        ...patch,
        reviewByRoom: {
          ...activeProject.reviewBoard.reviewByRoom,
          ...(patch.reviewByRoom || {}),
        },
        notesByRoom: {
          ...activeProject.reviewBoard.notesByRoom,
          ...(patch.notesByRoom || {}),
        },
      },
    });
  };



  const updateIntakeSnapshot = (patch: Partial<IntakeSnapshot>) => {
    if (!activeProject) return;
    updateActiveProject({
      intakeSnapshot: {
        ...activeProject.intakeSnapshot,
        ...patch,
        intake: {
          ...activeProject.intakeSnapshot.intake,
          ...(patch.intake || {}),
        },
        brief: {
          ...activeProject.intakeSnapshot.brief,
          ...(patch.brief || {}),
        },
        scope: {
          ...activeProject.intakeSnapshot.scope,
          ...(patch.scope || {}),
        },
        createdAt: Date.now(),
      },
    });
  };

  const rebuildBriefFromIntake = () => {
    if (!activeProject) return;
    const intake = activeProject.intakeSnapshot.intake;
    updateActiveProject({
      intakeSnapshot: createIntakeSnapshot(
        intake,
        activeProject.intakeSnapshot.brief,
        activeProject.intakeSnapshot.scope,
        activeProject.intakeSnapshot.approvalState
      ),
    });
  };

  const createProjectFromIntake = () => {
    if (!activeProject) return;
    const intake = activeProject.intakeSnapshot.intake;
    const snapshot = createIntakeSnapshot(
      intake,
      activeProject.intakeSnapshot.brief,
      activeProject.intakeSnapshot.scope,
      activeProject.intakeSnapshot.approvalState
    );
    const projectName = intake.projectName || activeProject.title;
    const prompt = [
      intake.goal,
      snapshot.brief.oneLineObjective,
      intake.references,
      intake.audience ? `Audience: ${intake.audience}` : "",
    ]
      .filter(Boolean)
      .join(" • ");
    updateActiveProject({
      intakeSnapshot: snapshot,
      title: projectName,
      publishTitle: projectName,
      masterPrompt: prompt || activeProject.masterPrompt,
      logline: snapshot.brief.oneLineObjective,
      publishSummary: snapshot.brief.oneLineObjective,
      notes: [
        `Client / owner: ${intake.clientOwner || "—"}`,
        `Contact: ${intake.contact || "—"}`,
        `Deadline: ${intake.deadline || "—"}`,
        `Budget: ${intake.budget || "—"}`,
        `Included: ${snapshot.scope.included.join(", ") || "—"}`,
        `Excluded: ${snapshot.scope.excluded.join(", ") || "—"}`,
      ].join("\n"),
      reviewBoard: {
        ...activeProject.reviewBoard,
        stage: "Idea",
      },
    });
  };
  const prependAssetsToActiveProject = (assets: ProjectAsset[]) => {
    if (!activeProject || !assets.length) return;
    updateActiveProject({
      studioAssets: [...assets, ...activeProject.studioAssets],
      title: titleFromPrompt(activeProject.masterPrompt, activeProject.title),
      reviewBoard: {
        ...activeProject.reviewBoard,
        stage: inferStageFromProject(
          [...assets, ...activeProject.studioAssets],
          activeProject.reviewBoard.reviewByRoom,
          activeProject.reviewBoard.readyToShip
        ),
      },
    });
  };

  const addProject = () => {
    const next = createBlankProject();
    setProjects((prev) => [next, ...prev]);
    setActiveId(next.id);
  };

  const duplicateProject = () => {
    if (!activeProject) return;
    const next = createBlankProject({
      ...activeProject,
      id: uid(),
      title: `${activeProject.title} Copy`,
      studioAssets: [...activeProject.studioAssets],
      snapshots: [...activeProject.snapshots],
    });
    setProjects((prev) => [next, ...prev]);
    setActiveId(next.id);
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
      const input = buildAutomationInput();
      const packet = generateFullStudioPipeline(input as any);
      const generated = [
        ...packet.home,
        ...packet.writing,
        ...packet.director,
        ...packet.music,
        ...packet.render,
        ...packet.ops,
      ] as ProjectAsset[];

      prependAssetsToActiveProject(generated);
      updateActiveProject({
        title: titleFromPrompt(activeProject.masterPrompt, activeProject.title),
        productionType: mapProjectTypeToProductionType(activeProject.projectType) as ProductionType,
        writerMode: projectTypeToWriterMode(activeProject.projectType),
        logline: activeProject.masterPrompt,
        publishTitle: titleFromPrompt(activeProject.masterPrompt, activeProject.title),
        publishSummary: activeProject.masterPrompt,
      });
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
      const input = buildAutomationInput();
      const generated = generateStudioRoomAssets(input as any, studioRoom as StudioRoomKey) as ProjectAsset[];
      prependAssetsToActiveProject(generated);
    } catch (error: any) {
      setPipelineError(error?.message || String(error));
    } finally {
      setPipelineBusy(false);
    }
  };

  const autoStageProject = () => {
    if (!activeProject) return;
    updateReviewBoard({
      stage: inferStageFromProject(
        activeProject.studioAssets,
        activeProject.reviewBoard.reviewByRoom,
        activeProject.reviewBoard.readyToShip
      ),
    });
  };

  const saveSnapshot = (label: string) => {
    if (!activeProject) return;
    const packet = buildPacket(activeProject);
    const snapshot: StudioSnapshot = {
      id: uid(),
      label,
      createdAt: Date.now(),
      stage: activeProject.reviewBoard.stage,
      title: activeProject.title,
      packetJson: JSON.stringify(packet, null, 2),
    };
    updateActiveProject({
      snapshots: [snapshot, ...activeProject.snapshots],
    });
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
        payload:
          parsedPayload ||
          {
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

      prependAssetsToActiveProject([
        {
          id: uid(),
          kind: "renderJob",
          title: `Render Job • ${title}`,
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
      if (previewUrl) {
        window.open(previewUrl, "_blank", "noopener,noreferrer");
      }
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
    const timer = window.setInterval(() => {
      void pollActiveRenderJob();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeProject?.renderBaseUrl, activeRenderJobId, studioRoom]);

  if (!activeProject) {
    return <div className="card softCard">Studio is loading…</div>;
  }

  const packet = buildPacket(activeProject);
  const latestCompletedRender = newestFirst(activeProject.studioAssets.filter((asset) => asset.kind === "renderJob"))[0] || null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card softCard">
        <div className="small shellEyebrow">FAIRLYODD OS / STUDIO</div>
        <div className="h mt-2">Review + release board for idea-to-product work.</div>
        <div className="sub mt-2">
          Studio is now a working delivery hub: build the project, review each room, package it, and prep it for release.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,

      <div className="card softCard mt-4">
        <div className="small shellEyebrow">STUDIO SETUP</div>
        <div className="small mt-2"><b>Status:</b> {studioSetup.ready ? "Ready" : "Needs setup"}</div>
        <div className="small mt-2"><b>Completion:</b> {studioSetup.completionPercent}%</div>
        <div className="small mt-2"><b>Missing:</b> {buildMissingInputsLabel(studioSetup)}</div>
        <div className="note mt-3">Configure render base URL and provider inputs in Preferences → Connections & Secrets Center.</div>
      </div>
          gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div className="card softCard">
            <div className="cluster wrap spread">
              <div>
                <div className="small shellEyebrow">STUDIO PROJECTS</div>
                <div className="sub mt-2">Keep multiple products moving in one Studio lane.</div>
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

            <div className="row wrap mt-4" style={{ gap: 10 }}>
              <button className="tabBtn" onClick={duplicateProject}>Duplicate</button>
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">IDEA → PRODUCT WORKFLOW</div>
            <div className="sub mt-2">{readiness?.nextRecommendedAction || "Start building the project."}</div>
            <div className="small mt-3"><b>Readiness score:</b> {readiness?.readinessScore ?? 0}</div>
            <div className="small mt-2"><b>Current stage:</b> {activeProject.reviewBoard.stage}</div>
            <div className="small mt-2"><b>Ready to ship:</b> {activeProject.reviewBoard.readyToShip ? "Yes" : "No"}</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div className="card softCard">
            <div className="small shellEyebrow">STAGE TRACKER</div>
            <div className="row wrap mt-3" style={{ gap: 8 }}>
              {WORKFLOW_STAGES.map((stage) => (
                <button
                  key={stage}
                  className={`tabBtn ${activeProject.reviewBoard.stage === stage ? "active" : ""}`}
                  onClick={() => updateReviewBoard({ stage })}
                >
                  {stage}
                </button>
              ))}
            </div>

            <div className="row wrap mt-4" style={{ gap: 10 }}>
              <button className="tabBtn" onClick={() => updateReviewBoard({ stage: previousStage(activeProject.reviewBoard.stage) })}>
                Back Stage
              </button>
              <button className="tabBtn active" onClick={() => updateReviewBoard({ stage: nextStage(activeProject.reviewBoard.stage) })}>
                Advance Stage
              </button>
              <button className="tabBtn" onClick={autoStageProject}>
                Auto-stage
              </button>
            </div>
          </div>

          <div className="card softCard">
            <div className="row wrap" style={{ gap: 8 }}>
              {ROOM_META.map((room) => (
                <button
                  key={room.key}
                  className={`tabBtn ${studioRoom === room.key ? "active" : ""}`}
                  onClick={() => setStudioRoom(room.key)}
                >
                  {room.label}
                </button>
              ))}
            </div>

            <div
              className="mt-4"
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                alignItems: "start",
              }}
            >
              <div className="card softCard">
                <div className="small shellEyebrow">MASTER PROMPT</div>
                <textarea
                  className="input mt-2"
                  rows={8}
                  value={activeProject.masterPrompt}
                  onChange={(e) =>
                    updateActiveProject({
                      masterPrompt: e.target.value,
                      title: titleFromPrompt(e.target.value, activeProject.title),
                      logline: e.target.value,
                      publishTitle: titleFromPrompt(e.target.value, activeProject.publishTitle || activeProject.title),
                      publishSummary: e.target.value,
                    })
                  }
                  placeholder="Describe the product you want Studio to build and ship."
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
                      {PROJECT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button className="tabBtn active" disabled={pipelineBusy} onClick={() => void runGenerateFullPipeline()}>
                    {pipelineBusy ? "Generating…" : "Generate full pipeline"}
                  </button>
                  <button className="tabBtn" disabled={pipelineBusy} onClick={() => void regenerateCurrentRoom()}>
                    {pipelineBusy ? "Working…" : `Regenerate ${ROOM_LABELS[studioRoom]}`}
                  </button>
                  {pipelineError ? <div className="note">{pipelineError}</div> : null}
                </div>
              </div>
            </div>

            <div
              className="mt-4"
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                alignItems: "start",
              }}
            >

              <div className="card softCard">
                <div className="small shellEyebrow">IDEA / CLIENT INTAKE</div>
                <div className="sub mt-2">
                  Capture the ask, turn it into a brief, and launch a Studio-ready project without re-explaining the idea later.
                </div>
                <div className="mt-3" style={{ display: "grid", gap: 10 }}>
                  <label className="small">
                    Project name
                    <input
                      className="input mt-2"
                      value={activeProject.intakeSnapshot.intake.projectName}
                      onChange={(e) => updateIntakeSnapshot({ intake: { projectName: e.target.value } as Partial<StudioIntake> })}
                    />
                  </label>
                  <label className="small">
                    Client / owner
                    <input
                      className="input mt-2"
                      value={activeProject.intakeSnapshot.intake.clientOwner}
                      onChange={(e) => updateIntakeSnapshot({ intake: { clientOwner: e.target.value } as Partial<StudioIntake> })}
                    />
                  </label>
                  <label className="small">
                    Contact
                    <input
                      className="input mt-2"
                      value={activeProject.intakeSnapshot.intake.contact}
                      onChange={(e) => updateIntakeSnapshot({ intake: { contact: e.target.value } as Partial<StudioIntake> })}
                    />
                  </label>
                  <label className="small">
                    Goal
                    <textarea
                      className="input mt-2"
                      rows={3}
                      value={activeProject.intakeSnapshot.intake.goal}
                      onChange={(e) => updateIntakeSnapshot({ intake: { goal: e.target.value } as Partial<StudioIntake> })}
                    />
                  </label>
                  <label className="small">
                    Audience
                    <input
                      className="input mt-2"
                      value={activeProject.intakeSnapshot.intake.audience}
                      onChange={(e) => updateIntakeSnapshot({ intake: { audience: e.target.value } as Partial<StudioIntake> })}
                    />
                  </label>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                    <label className="small">
                      Deadline
                      <input
                        className="input mt-2"
                        value={activeProject.intakeSnapshot.intake.deadline}
                        onChange={(e) => updateIntakeSnapshot({ intake: { deadline: e.target.value } as Partial<StudioIntake> })}
                      />
                    </label>
                    <label className="small">
                      Budget
                      <input
                        className="input mt-2"
                        value={activeProject.intakeSnapshot.intake.budget}
                        onChange={(e) => updateIntakeSnapshot({ intake: { budget: e.target.value } as Partial<StudioIntake> })}
                      />
                    </label>
                  </div>
                  <label className="small">
                    References / inspiration
                    <textarea
                      className="input mt-2"
                      rows={3}
                      value={activeProject.intakeSnapshot.intake.references}
                      onChange={(e) => updateIntakeSnapshot({ intake: { references: e.target.value } as Partial<StudioIntake> })}
                    />
                  </label>
                </div>
                <div className="row wrap mt-3" style={{ gap: 8 }}>
                  <button className="tabBtn active" onClick={rebuildBriefFromIntake}>Build brief from intake</button>
                  <button className="tabBtn" onClick={createProjectFromIntake}>Create project from intake</button>
                  <button
                    className="tabBtn"
                    onClick={async () => {
                      await copyText(intakeSnapshotToMarkdown(activeProject.intakeSnapshot));
                      setPacketCopiedState("md");
                    }}
                  >
                    Copy brief markdown
                  </button>
                  <button
                    className="tabBtn"
                    onClick={() =>
                      downloadTextFile(
                        `${titleFromPrompt(activeProject.intakeSnapshot.intake.projectName || activeProject.title)}-brief.json`,
                        JSON.stringify(activeProject.intakeSnapshot, null, 2),
                        "application/json"
                      )
                    }
                  >
                    Export brief JSON
                  </button>
                </div>
              </div>

              <div className="card softCard">
                <div className="small shellEyebrow">CREATIVE BRIEF</div>
                <div className="small mt-2"><b>Approval:</b> {activeProject.intakeSnapshot.approvalState}</div>
                <div className="row wrap mt-3" style={{ gap: 8 }}>
                  {(["pending brief", "approved brief", "revision requested"] as BriefApprovalState[]).map((status) => (
                    <button
                      key={status}
                      className={`tabBtn ${activeProject.intakeSnapshot.approvalState === status ? "active" : ""}`}
                      onClick={() => updateIntakeSnapshot({ approvalState: status })}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                <label className="small mt-3" style={{ display: "block" }}>
                  One-line objective
                  <textarea
                    className="input mt-2"
                    rows={2}
                    value={activeProject.intakeSnapshot.brief.oneLineObjective}
                    onChange={(e) => updateIntakeSnapshot({ brief: { oneLineObjective: e.target.value } as Partial<CreativeBrief> })}
                  />
                </label>
                <label className="small mt-3" style={{ display: "block" }}>
                  Deliverables (one per line)
                  <textarea
                    className="input mt-2"
                    rows={4}
                    value={activeProject.intakeSnapshot.brief.deliverables.join("\\n")}
                    onChange={(e) => updateIntakeSnapshot({ brief: { deliverables: toLineItems(e.target.value) } as Partial<CreativeBrief> })}
                  />
                </label>
                <label className="small mt-3" style={{ display: "block" }}>
                  Tone / style
                  <input
                    className="input mt-2"
                    value={activeProject.intakeSnapshot.brief.toneStyle}
                    onChange={(e) => updateIntakeSnapshot({ brief: { toneStyle: e.target.value } as Partial<CreativeBrief> })}
                  />
                </label>
                <label className="small mt-3" style={{ display: "block" }}>
                  Success criteria (one per line)
                  <textarea
                    className="input mt-2"
                    rows={4}
                    value={activeProject.intakeSnapshot.brief.successCriteria.join("\\n")}
                    onChange={(e) => updateIntakeSnapshot({ brief: { successCriteria: toLineItems(e.target.value) } as Partial<CreativeBrief> })}
                  />
                </label>
                <label className="small mt-3" style={{ display: "block" }}>
                  Included scope (one per line)
                  <textarea
                    className="input mt-2"
                    rows={3}
                    value={activeProject.intakeSnapshot.scope.included.join("\\n")}
                    onChange={(e) => updateIntakeSnapshot({ scope: { included: toLineItems(e.target.value) } as Partial<ScopeDefinition> })}
                  />
                </label>
                <label className="small mt-3" style={{ display: "block" }}>
                  Not included (one per line)
                  <textarea
                    className="input mt-2"
                    rows={3}
                    value={activeProject.intakeSnapshot.scope.excluded.join("\\n")}
                    onChange={(e) => updateIntakeSnapshot({ scope: { excluded: toLineItems(e.target.value) } as Partial<ScopeDefinition> })}
                  />
                </label>
                <label className="small mt-3" style={{ display: "block" }}>
                  Dependencies / blockers (one per line)
                  <textarea
                    className="input mt-2"
                    rows={3}
                    value={[...activeProject.intakeSnapshot.scope.dependencies, ...activeProject.intakeSnapshot.scope.blockers].join("\\n")}
                    onChange={(e) => {
                      const lines = toLineItems(e.target.value);
                      updateIntakeSnapshot({ scope: { dependencies: lines, blockers: [] } as Partial<ScopeDefinition> });
                    }}
                  />
                </label>
              </div>
              <div className="card softCard">
                <div className="small shellEyebrow">REVIEW BOARD</div>
                <div className="small mt-2"><b>Current room:</b> {ROOM_LABELS[studioRoom]}</div>
                <div className="small mt-2"><b>Status:</b> {activeProject.reviewBoard.reviewByRoom[studioRoom]}</div>
                <div className="row wrap mt-3" style={{ gap: 8 }}>
                  {(["Not started", "In review", "Approved", "Needs changes"] as RoomReviewStatus[]).map((status) => (
                    <button
                      key={status}
                      className={`tabBtn ${activeProject.reviewBoard.reviewByRoom[studioRoom] === status ? "active" : ""}`}
                      onClick={() =>
                        updateReviewBoard({
                          reviewByRoom: { [studioRoom]: status },
                        })
                      }
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <textarea
                  className="input mt-3"
                  rows={5}
                  value={activeProject.reviewBoard.notesByRoom[studioRoom]}
                  onChange={(e) =>
                    updateReviewBoard({
                      notesByRoom: { [studioRoom]: e.target.value },
                    })
                  }
                  placeholder={`Review notes for ${ROOM_LABELS[studioRoom]}`}
                />
              </div>

              <div className="card softCard">
                <div className="small shellEyebrow">RELEASE BOARD</div>
                <label className="small mt-2" style={{ display: "block" }}>
                  Publish title
                  <input
                    className="input mt-2"
                    value={activeProject.publishTitle}
                    onChange={(e) => updateActiveProject({ publishTitle: e.target.value })}
                  />
                </label>
                <label className="small mt-3" style={{ display: "block" }}>
                  Publish subtitle
                  <input
                    className="input mt-2"
                    value={activeProject.publishSubtitle}
                    onChange={(e) => updateActiveProject({ publishSubtitle: e.target.value })}
                  />
                </label>
                <label className="small mt-3" style={{ display: "block" }}>
                  Release summary
                  <textarea
                    className="input mt-2"
                    rows={5}
                    value={activeProject.publishSummary}
                    onChange={(e) => updateActiveProject({ publishSummary: e.target.value })}
                  />
                </label>
                <div className="row wrap mt-3" style={{ gap: 8 }}>
                  <button
                    className={`tabBtn ${activeProject.reviewBoard.readyToShip ? "active" : ""}`}
                    onClick={() =>
                      updateReviewBoard({ readyToShip: !activeProject.reviewBoard.readyToShip })
                    }
                  >
                    {activeProject.reviewBoard.readyToShip ? "Ready to ship ✓" : "Mark ready to ship"}
                  </button>
                  <button className="tabBtn" onClick={() => saveSnapshot("Release Candidate")}>
                    Freeze snapshot
                  </button>
                </div>
              </div>
            </div>

            <div
              className="mt-4"
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                alignItems: "start",
              }}
            >
              <div className="card softCard">
                <div className="small shellEyebrow">READINESS + BLOCKERS</div>
                <div className="small mt-2"><b>Score:</b> {readiness?.readinessScore ?? 0}</div>
                <div className="small mt-2"><b>Next action:</b> {readiness?.nextRecommendedAction || "None"}</div>
                <div className="small mt-3"><b>Missing pieces:</b></div>
                <div className="small mt-2">
                  {readiness?.missingPieces.length ? readiness.missingPieces.join(" • ") : "None"}
                </div>
                <div className="small mt-3"><b>Ship blockers:</b></div>
                <div className="small mt-2">
                  {readiness?.blockers.length ? readiness.blockers.join(" • ") : "None"}
                </div>
              </div>

              <div className="card softCard">
                <div className="small shellEyebrow">SNAPSHOTS</div>
                <div className="row wrap mt-3" style={{ gap: 8 }}>
                  <button className="tabBtn" onClick={() => saveSnapshot("First Draft")}>First Draft</button>
                  <button className="tabBtn" onClick={() => saveSnapshot("Review Cut")}>Review Cut</button>
                  <button className="tabBtn" onClick={() => saveSnapshot("Final Candidate")}>Final Candidate</button>
                </div>
                <div className="mt-3" style={{ display: "grid", gap: 10 }}>
                  {(activeProject.snapshots || []).slice(0, 5).map((snapshot) => (
                    <div key={snapshot.id} className="card softCard">
                      <div className="small shellEyebrow">{snapshot.label}</div>
                      <div className="small mt-2"><b>{snapshot.stage}</b></div>
                      <div className="small mt-2">{new Date(snapshot.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                  {!activeProject.snapshots.length ? <div className="small mt-2">No snapshots yet.</div> : null}
                </div>
              </div>
            </div>

            {studioRoom === "render" ? (
              <div className="card softCard mt-4">
                <div className="small shellEyebrow">RENDER LAB</div>
                <div className="sub mt-2">
                  Existing local render backend target stays at {activeProject.renderBaseUrl || "http://127.0.0.1:8899"}.
                </div>

                <div className="card softCard mt-3">
                  <div className="small shellEyebrow">LATEST RENDER STATUS</div>
                  <div className="small mt-2">
                    {activeRenderJob
                      ? `${activeRenderJob.status || "unknown"} • ${activeRenderJob.title || activeRenderJob.projectTitle || activeRenderJob.id}`
                      : "No render job yet."}
                  </div>
                </div>

                <div className="mt-3" style={{ display: "grid", gap: 10 }}>
                  <input
                    className="input"
                    value={activeProject.renderBaseUrl}
                    onChange={(e) => updateActiveProject({ renderBaseUrl: e.target.value })}
                    placeholder="http://127.0.0.1:8899"
                  />

                  <div className="row wrap" style={{ gap: 10 }}>
                    <button className="tabBtn active" disabled={renderBusy} onClick={() => void submitRenderJob()}>
                      {renderBusy ? "Submitting…" : "Create render job"}
                    </button>
                    <button className="tabBtn" onClick={() => void refreshRenderJobs()}>Refresh queue</button>
                    <button className="tabBtn" onClick={() => void pollActiveRenderJob()} disabled={!activeRenderJobId}>Poll active</button>
                    <button className="tabBtn" onClick={() => void runImportCompletedRender()} disabled={!activeRenderJobId}>Import completed</button>
                    <button className="tabBtn" onClick={() => void runWatchCompletedRender()} disabled={!activeRenderJobId}>Watch completed</button>
                  </div>

                  {renderError ? <div className="note">{renderError}</div> : null}
                  <div className="small"><b>Last sync:</b> {lastRenderSyncAt ? new Date(lastRenderSyncAt).toLocaleString() : "No sync yet"}</div>

                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      alignItems: "start",
                    }}
                  >
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
                          {activeRenderJob.workerMessage ? (
                            <div className="small mt-2">{activeRenderJob.workerMessage}</div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="card softCard mt-4">
              <div className="small shellEyebrow">{ROOM_LABELS[studioRoom].toUpperCase()} OUTPUTS</div>
              <div className="small mt-2">{ROOM_META.find((room) => room.key === studioRoom)?.blurb}</div>
              {!activeRoomAssets.length ? (
                <div className="small mt-3">No assets yet for this room.</div>
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

            <div
              className="mt-4"
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                alignItems: "start",
              }}
            >
              <div className="card softCard">
                <div className="small shellEyebrow">OUTPUT VAULT</div>
                <div className="small mt-2"><b>Latest render output:</b> {latestCompletedRender?.title || "None yet"}</div>
                <div className="small mt-2"><b>Snapshots:</b> {activeProject.snapshots.length}</div>
                <div className="small mt-2"><b>Assets:</b> {activeProject.studioAssets.length}</div>
              </div>

              <div className="card softCard">
                <div className="small shellEyebrow">FINAL PROJECT PACKET</div>
                <div className="row wrap mt-3" style={{ gap: 8 }}>
                  <button
                    className="tabBtn"
                    onClick={async () => {
                      await copyText(JSON.stringify(packet, null, 2));
                      setPacketCopiedState("json");
                    }}
                  >
                    Copy JSON
                  </button>
                  <button
                    className="tabBtn"
                    onClick={async () => {
                      await copyText(packetMarkdown(activeProject));
                      setPacketCopiedState("md");
                    }}
                  >
                    Copy Markdown
                  </button>
                  <button
                    className="tabBtn"
                    onClick={() =>
                      downloadTextFile(`${titleFromPrompt(activeProject.title)}.json`, JSON.stringify(packet, null, 2), "application/json")
                    }
                  >
                    Download .json
                  </button>
                  <button
                    className="tabBtn"
                    onClick={() =>
                      downloadTextFile(`${titleFromPrompt(activeProject.title)}.md`, packetMarkdown(activeProject), "text/markdown")
                    }
                  >
                    Download .md
                  </button>
                </div>
                <div className="small mt-3">
                  <b>Status:</b> {packetCopiedState ? `Copied ${packetCopiedState}` : "Ready"}
                </div>
              </div>
            </div>

            <div className="card softCard mt-4">
              <div className="small shellEyebrow">PUBLISH PREP</div>
              <div className="small mt-2"><b>Title lock:</b> {activeProject.publishTitle || activeProject.title}</div>
              <div className="small mt-2"><b>Subtitle:</b> {activeProject.publishSubtitle || "None yet"}</div>
              <div className="small mt-2"><b>Summary:</b> {activeProject.publishSummary || activeProject.masterPrompt || "None yet"}</div>
              <div className="small mt-3">
                <b>Deliverables:</b> brief • writing • director • music • render • publish packet
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

