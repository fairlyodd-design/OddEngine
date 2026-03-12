export type StudioTimelineStage =
  | "Idea"
  | "Draft"
  | "Build"
  | "Render"
  | "Review"
  | "Package"
  | "Publish";

export type StudioMilestone = {
  id: string;
  label: string;
  stage: StudioTimelineStage;
  status: "completed" | "upcoming";
  createdAt?: number;
  detail: string;
};

export type StudioTimelineSummary = {
  readinessBand: "early" | "moving" | "late" | "ship-ready";
  completedCount: number;
  totalCount: number;
  nextMilestone: StudioMilestone | null;
  milestones: StudioMilestone[];
};

function uid(prefix = "milestone") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function hasKind(assets: Array<{ kind?: string }>, kinds: string[]) {
  return assets.some((asset) => kinds.includes(String(asset.kind || "")));
}

function newestSnapshotForStage(
  snapshots: Array<{ id?: string; label?: string; stage?: string; createdAt?: number }> = [],
  stage: StudioTimelineStage,
) {
  return [...snapshots]
    .filter((snapshot) => String(snapshot.stage || "") === stage)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || null;
}

export function buildStudioTimelineSummary(input: {
  stage: StudioTimelineStage;
  assets: Array<{ kind?: string; title?: string; ts?: number }>;
  snapshots?: Array<{ id?: string; label?: string; stage?: string; createdAt?: number }>;
  readyToShip?: boolean;
}) : StudioTimelineSummary {
  const assets = input.assets || [];
  const snapshots = input.snapshots || [];

  const gates: Array<{
    stage: StudioTimelineStage;
    label: string;
    completed: boolean;
    detail: string;
    createdAt?: number;
  }> = [
    {
      stage: "Idea",
      label: "Idea captured",
      completed: Boolean(assets.length),
      detail: assets.length ? "The project has assets and a working concept." : "Capture the concept and generate the first packet.",
    },
    {
      stage: "Draft",
      label: "Draft package built",
      completed: hasKind(assets, ["story", "song", "oneSheet"]),
      detail: hasKind(assets, ["story", "song", "oneSheet"]) ? "Writing layer exists." : "Generate Writing Room and Studio Home assets.",
    },
    {
      stage: "Build",
      label: "Build assets assembled",
      completed: hasKind(assets, ["storyboard", "shotList", "productionPack"]),
      detail: hasKind(assets, ["storyboard", "shotList", "productionPack"]) ? "Director and Music lanes are present." : "Generate Director Room and Music Lab outputs.",
    },
    {
      stage: "Render",
      label: "Render handoff ready",
      completed: hasKind(assets, ["renderHandoff", "renderJob"]),
      detail: hasKind(assets, ["renderHandoff", "renderJob"]) ? "Render Lab handoff or job exists." : "Generate Render Lab assets and create a render job.",
    },
    {
      stage: "Review",
      label: "Review cut captured",
      completed: Boolean(newestSnapshotForStage(snapshots, "Review")) || Boolean(newestSnapshotForStage(snapshots, "Render")),
      detail: Boolean(newestSnapshotForStage(snapshots, "Review")) || Boolean(newestSnapshotForStage(snapshots, "Render"))
        ? "A review-oriented snapshot exists."
        : "Freeze a Review Cut or Final Candidate snapshot.",
      createdAt: newestSnapshotForStage(snapshots, "Review")?.createdAt || newestSnapshotForStage(snapshots, "Render")?.createdAt,
    },
    {
      stage: "Package",
      label: "Package assembled",
      completed: hasKind(assets, ["productionRunbook", "screeningPacket"]) || Boolean(newestSnapshotForStage(snapshots, "Package")),
      detail: hasKind(assets, ["productionRunbook", "screeningPacket"]) || Boolean(newestSnapshotForStage(snapshots, "Package"))
        ? "Packet and publish-prep assets exist."
        : "Generate Producer Ops assets and freeze a release candidate.",
      createdAt: newestSnapshotForStage(snapshots, "Package")?.createdAt,
    },
    {
      stage: "Publish",
      label: "Ready to publish",
      completed: Boolean(input.readyToShip),
      detail: input.readyToShip ? "Project is marked ready to ship." : "Resolve blockers and mark the project ready to ship.",
    },
  ];

  const milestones: StudioMilestone[] = gates.map((gate) => ({
    id: uid(gate.stage.toLowerCase()),
    label: gate.label,
    stage: gate.stage,
    status: gate.completed ? "completed" : "upcoming",
    detail: gate.detail,
    createdAt: gate.createdAt,
  }));

  const completedCount = milestones.filter((m) => m.status === "completed").length;
  const nextMilestone = milestones.find((m) => m.status === "upcoming") || null;

  let readinessBand: StudioTimelineSummary["readinessBand"] = "early";
  if (input.readyToShip) readinessBand = "ship-ready";
  else if (completedCount >= 5) readinessBand = "late";
  else if (completedCount >= 3) readinessBand = "moving";

  return {
    readinessBand,
    completedCount,
    totalCount: milestones.length,
    nextMilestone,
    milestones,
  };
}
