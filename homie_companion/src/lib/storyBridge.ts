export type StoryBridgeProjectType =
  | "song"
  | "book"
  | "cartoon"
  | "video"
  | "music video"
  | "other";

export type StoryBridgeRoomKey =
  | "home"
  | "writing"
  | "director"
  | "music"
  | "render"
  | "ops";

export const STORY_BRIDGE_STORAGE_KEY = "oddengine:story-bridge:v1";
export const STORY_BRIDGE_EVENT = "oddengine:story-bridge-updated";

export type StoryBridgeSnapshot = {
  version: string;
  projectId: string;
  projectTitle: string;
  projectType: StoryBridgeProjectType;
  activeRoom: StoryBridgeRoomKey;
  activeTab: string;
  nextRoom: StoryBridgeRoomKey;
  resumeFrom: string;
  summary: string;
  masterPrompt: string;
  visualStyle: string;
  productionType: string;
  releaseTarget: string;
  budgetBand: string;
  scopeLevel: string;
  roomPreviewTitle?: string;
  roomPreviewSnippet?: string;
  roomCounts?: Partial<Record<StoryBridgeRoomKey, number>>;
  homieCue?: string;
  lastActionSummary?: string;
  renderReady?: boolean;
  latestRenderJobId?: string;
  latestRenderStatus?: string;
  renderQueueCount?: number;
  renderCompletedCount?: number;
  latestOutputTitle?: string;
  latestOutputImported?: boolean;
  latestOutputWatched?: boolean;
  latestOutputDecision?: "pending" | "approved" | "revise" | "rerender";
  latestOutputReviewNote?: string;
  latestOutputReviewedAt?: number;
  latestNextPassDecision?: "pending" | "approved" | "revise" | "rerender";
  latestNextPassSummary?: string;
  latestNextPassReady?: boolean;
  latestNextPassPacketTitle?: string;
  latestNextPassChecklistCount?: number;
  latestPublishPacketTitle?: string;
  latestPublishSummary?: string;
  latestPublishReady?: boolean;
  latestFinalAnswerSummary?: string;
  latestExportTargetCount?: number;
  latestLaunchChecklistCount?: number;
  latestReleaseBoardTitle?: string;
  latestReleaseBoardSummary?: string;
  latestReleasePlatformCount?: number;
  latestTeaserAssetCount?: number;
  latestFinalOutputCount?: number;
  latestProviderRouteTitle?: string;
  latestProviderLabel?: string;
  latestProviderRouteStatus?: string;
  latestFinalDeliverableCount?: number;
  latestExportReady?: boolean;
  latestFinalExportSummary?: string;
  latestLaunchPhase?: string;
  updatedAt: number;
};

export const STORY_ROOM_LABELS: Record<StoryBridgeRoomKey, string> = {
  home: "Studio Home",
  writing: "Writing Room",
  director: "Director Room",
  music: "Music Lab",
  render: "Render Lab",
  ops: "Producer Ops"
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function readStoryBridgeSnapshot(): StoryBridgeSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORY_BRIDGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) return null;
    if (typeof parsed.projectId !== "string" || typeof parsed.projectTitle !== "string") return null;
    return parsed as StoryBridgeSnapshot;
  } catch {
    return null;
  }
}

export function saveStoryBridgeSnapshot(snapshot: StoryBridgeSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORY_BRIDGE_STORAGE_KEY, JSON.stringify(snapshot));
    window.dispatchEvent(new CustomEvent(STORY_BRIDGE_EVENT, { detail: snapshot }));
  } catch {
    // ignore local-only storage issues
  }
}

export function subscribeStoryBridge(listener: (snapshot: StoryBridgeSnapshot | null) => void) {
  if (typeof window === "undefined") return () => undefined;

  const customHandler = (event: Event) => {
    const detail = (event as CustomEvent<StoryBridgeSnapshot | null>).detail ?? readStoryBridgeSnapshot();
    listener(detail);
  };

  const storageHandler = (event: StorageEvent) => {
    if (event.key && event.key !== STORY_BRIDGE_STORAGE_KEY) return;
    listener(readStoryBridgeSnapshot());
  };

  window.addEventListener(STORY_BRIDGE_EVENT, customHandler as EventListener);
  window.addEventListener("storage", storageHandler);

  return () => {
    window.removeEventListener(STORY_BRIDGE_EVENT, customHandler as EventListener);
    window.removeEventListener("storage", storageHandler);
  };
}

export function storyBridgeSignature(snapshot: StoryBridgeSnapshot | null) {
  if (!snapshot) return "none";
  return [
    snapshot.projectId,
    snapshot.activeRoom,
    snapshot.nextRoom,
    snapshot.homieCue || "",
    snapshot.lastActionSummary || "",
    snapshot.renderReady ? "render-ready" : "render-idle",
    snapshot.latestRenderJobId || "",
    snapshot.latestRenderStatus || "",
    snapshot.latestOutputTitle || "",
    snapshot.latestOutputImported ? "imported" : "not-imported",
    snapshot.latestOutputWatched ? "watched" : "not-watched",
    snapshot.latestOutputDecision || "no-decision",
    snapshot.latestOutputReviewNote || "",
    String(snapshot.latestOutputReviewedAt || 0),
    snapshot.latestNextPassDecision || "no-next-pass",
    snapshot.latestNextPassSummary || "",
    snapshot.latestNextPassReady ? "next-pass-ready" : "next-pass-pending",
    snapshot.latestNextPassPacketTitle || "",
    String(snapshot.latestNextPassChecklistCount || 0),
    snapshot.latestPublishPacketTitle || "",
    snapshot.latestPublishSummary || "",
    snapshot.latestPublishReady ? "publish-ready" : "publish-idle",
    snapshot.latestFinalAnswerSummary || "",
    String(snapshot.latestExportTargetCount || 0),
    String(snapshot.latestLaunchChecklistCount || 0),
    snapshot.latestReleaseBoardTitle || "",
    snapshot.latestReleaseBoardSummary || "",
    String(snapshot.latestReleasePlatformCount || 0),
    String(snapshot.latestTeaserAssetCount || 0),
    String(snapshot.latestFinalOutputCount || 0),
    snapshot.latestProviderRouteTitle || "",
    snapshot.latestProviderLabel || "",
    snapshot.latestProviderRouteStatus || "",
    String(snapshot.latestFinalDeliverableCount || 0),
    snapshot.latestExportReady ? "export-ready" : "export-pending",
    snapshot.latestFinalExportSummary || "",
    snapshot.latestLaunchPhase || "",
    String(snapshot.updatedAt || 0),
  ].join("|");
}

export function summarizeStoryBridge(snapshot: StoryBridgeSnapshot | null) {
  if (!snapshot) return "Story Forge bridge is idle.";
  const renderPart = snapshot.renderReady
    ? snapshot.latestRenderJobId
      ? ` • render job ${snapshot.latestRenderJobId} ${snapshot.latestRenderStatus || "staged"}`
      : " • render lane staged"
    : "";
  const publishPart = snapshot.latestPublishReady ? ` • publish packet ${snapshot.latestPublishPacketTitle || "ready"}` : "";
  const releasePart = snapshot.latestReleaseBoardTitle ? ` • release board ${snapshot.latestReleaseBoardTitle}` : "";
  const providerPart = snapshot.latestProviderRouteTitle ? ` • provider ${snapshot.latestProviderRouteTitle}` : "";
  return `${snapshot.projectTitle} • ${STORY_ROOM_LABELS[snapshot.activeRoom]} now • ${STORY_ROOM_LABELS[snapshot.nextRoom]} next${renderPart}${publishPart}${releasePart}${providerPart}`;
}
