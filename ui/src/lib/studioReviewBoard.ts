export type StudioRoomKey =
  | "home"
  | "writing"
  | "director"
  | "music"
  | "render"
  | "ops";

export type WorkflowStage =
  | "Idea"
  | "Draft"
  | "Build"
  | "Render"
  | "Review"
  | "Package"
  | "Publish";

export type RoomReviewStatus =
  | "Not started"
  | "In review"
  | "Approved"
  | "Needs changes";

export type ReviewBoardState = {
  stage: WorkflowStage;
  reviewByRoom: Record<StudioRoomKey, RoomReviewStatus>;
  notesByRoom: Record<StudioRoomKey, string>;
  readyToShip: boolean;
};

export type ReadinessSnapshot = {
  readinessScore: number;
  blockers: string[];
  missingPieces: string[];
  nextRecommendedAction: string;
  stage: WorkflowStage;
};

export const WORKFLOW_STAGES: WorkflowStage[] = [
  "Idea",
  "Draft",
  "Build",
  "Render",
  "Review",
  "Package",
  "Publish",
];

export const ROOM_LABELS: Record<StudioRoomKey, string> = {
  home: "Studio Home",
  writing: "Writing Room",
  director: "Director Room",
  music: "Music Lab",
  render: "Render Lab",
  ops: "Producer Ops",
};

export function createDefaultReviewBoardState(): ReviewBoardState {
  return {
    stage: "Idea",
    reviewByRoom: {
      home: "Not started",
      writing: "Not started",
      director: "Not started",
      music: "Not started",
      render: "Not started",
      ops: "Not started",
    },
    notesByRoom: {
      home: "",
      writing: "",
      director: "",
      music: "",
      render: "",
      ops: "",
    },
    readyToShip: false,
  };
}

export function nextStage(stage: WorkflowStage): WorkflowStage {
  const idx = WORKFLOW_STAGES.indexOf(stage);
  return WORKFLOW_STAGES[Math.min(WORKFLOW_STAGES.length - 1, idx + 1)];
}

export function previousStage(stage: WorkflowStage): WorkflowStage {
  const idx = WORKFLOW_STAGES.indexOf(stage);
  return WORKFLOW_STAGES[Math.max(0, idx - 1)];
}

export function roomKinds(room: StudioRoomKey): string[] {
  switch (room) {
    case "home":
      return ["oneSheet"];
    case "writing":
      return ["story", "song"];
    case "director":
      return ["storyboard", "shotList", "videoTreatment", "featureOutline"];
    case "music":
      return ["productionPack", "song"];
    case "render":
      return ["renderHandoff", "renderJob"];
    case "ops":
      return ["productionRunbook", "screeningPacket", "oneSheet"];
    default:
      return [];
  }
}

export function latestAssetForRoom(assets: Array<{ kind: string; ts?: number }>, room: StudioRoomKey) {
  const kinds = roomKinds(room);
  return [...assets]
    .filter((asset) => kinds.includes(asset.kind))
    .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))[0] || null;
}

export function inferStageFromProject(
  assets: Array<{ kind: string; ts?: number }>,
  reviewByRoom?: Record<StudioRoomKey, RoomReviewStatus>,
  readyToShip?: boolean,
): WorkflowStage {
  const home = latestAssetForRoom(assets, "home");
  const writing = latestAssetForRoom(assets, "writing");
  const director = latestAssetForRoom(assets, "director");
  const music = latestAssetForRoom(assets, "music");
  const render = latestAssetForRoom(assets, "render");
  const ops = latestAssetForRoom(assets, "ops");

  const approvals = reviewByRoom
    ? Object.values(reviewByRoom).filter((value) => value === "Approved").length
    : 0;

  if (readyToShip) return "Publish";
  if (ops && approvals >= 4) return "Package";
  if (approvals >= 3) return "Review";
  if (render) return "Render";
  if (director || music) return "Build";
  if (writing) return "Draft";
  if (home) return "Idea";
  return "Idea";
}

export function buildReadinessSnapshot(args: {
  stage: WorkflowStage;
  assets: Array<{ kind: string; ts?: number }>;
  reviewByRoom: Record<StudioRoomKey, RoomReviewStatus>;
  readyToShip?: boolean;
}): ReadinessSnapshot {
  const { stage, assets, reviewByRoom, readyToShip } = args;
  const missingPieces: string[] = [];
  const blockers: string[] = [];

  const requiredByRoom: Record<StudioRoomKey, string> = {
    home: "Studio brief / one-sheet",
    writing: "Core draft or lyrics/story output",
    director: "Storyboard or shot list",
    music: "Music direction or cue pack",
    render: "Render handoff / render job",
    ops: "Publish prep / runbook",
  };

  (Object.keys(requiredByRoom) as StudioRoomKey[]).forEach((room) => {
    if (!latestAssetForRoom(assets, room)) {
      missingPieces.push(requiredByRoom[room]);
    }
  });

  (Object.keys(reviewByRoom) as StudioRoomKey[]).forEach((room) => {
    const status = reviewByRoom[room];
    if (status === "Needs changes") {
      blockers.push(`${ROOM_LABELS[room]} needs changes`);
    }
  });

  if (!readyToShip && stage === "Publish") {
    blockers.push("Ready to ship flag is not enabled");
  }

  const approvedCount = (Object.values(reviewByRoom) || []).filter((s) => s === "Approved").length;
  const assetCoverage = Math.max(0, 6 - missingPieces.length);
  let readinessScore = Math.round((assetCoverage / 6) * 55 + (approvedCount / 6) * 35 + (readyToShip ? 10 : 0));

  if (blockers.length) readinessScore = Math.max(0, readinessScore - blockers.length * 8);

  let nextRecommendedAction = "Add a strong master prompt and generate the first project packet.";
  if (missingPieces.length) {
    nextRecommendedAction = `Generate or complete: ${missingPieces[0]}.`;
  } else if (blockers.length) {
    nextRecommendedAction = `Resolve blocker: ${blockers[0]}.`;
  } else if (stage !== "Publish" && !readyToShip) {
    nextRecommendedAction = `Advance the project from ${stage} to ${nextStage(stage)}.`;
  } else if (readyToShip) {
    nextRecommendedAction = "Project is ready to ship. Package exports and publish.";
  }

  return {
    readinessScore,
    blockers,
    missingPieces,
    nextRecommendedAction,
    stage,
  };
}
