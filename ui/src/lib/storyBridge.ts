import type { StudioProjectType, StudioRoomKey } from "./studioAutomation";

export type StoryBridgeRoomKey = StudioRoomKey;

export const STORY_BRIDGE_STORAGE_KEY = "oddengine:story-bridge:v1";
export const STORY_BRIDGE_EVENT = "oddengine:story-bridge-updated";

export type StoryBridgeSnapshot = {
  version: string;
  projectId: string;
  projectTitle: string;
  projectType: StudioProjectType;
  activeRoom: StudioRoomKey;
  activeTab: string;
  nextRoom: StudioRoomKey;
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
  roomCounts?: Partial<Record<StudioRoomKey, number>>;
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

export const STORY_ROOM_LABELS: Record<StudioRoomKey, string> = {
  home: "Studio Home",
  writing: "Writing Room",
  director: "Director Room",
  music: "Music Lab",
  render: "Render Lab",
  ops: "Producer Ops"
};

export function saveStoryBridgeSnapshot(snapshot: StoryBridgeSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORY_BRIDGE_STORAGE_KEY, JSON.stringify(snapshot));
    window.dispatchEvent(new CustomEvent(STORY_BRIDGE_EVENT, { detail: snapshot }));
  } catch {
    // ignore local-only storage issues
  }
}


export function summarizeStoryBridge(snapshot: StoryBridgeSnapshot | null) {
  if (!snapshot) return "Story Forge bridge is idle.";
  const renderPart = snapshot.renderReady
    ? snapshot.latestRenderJobId
      ? ` • render job ${snapshot.latestRenderJobId} ${snapshot.latestRenderStatus || "staged"}`
      : " • render lane staged"
    : "";
  const publishPart = snapshot.latestPublishReady ? ` • publish packet ${snapshot.latestPublishPacketTitle || "ready"}` : "";
  return `${snapshot.projectTitle} • ${STORY_ROOM_LABELS[snapshot.activeRoom]} now • ${STORY_ROOM_LABELS[snapshot.nextRoom]} next${renderPart}${publishPart}`;
}
