
export type StudioOutputType =
  | "book"
  | "video"
  | "song"
  | "cartoon"
  | "script";

export type StudioJobStatus =
  | "idle"
  | "writing"
  | "editing"
  | "storyboarding"
  | "rendering"
  | "mastering"
  | "bridged"
  | "complete";

export type StudioJob = {
  id: string;
  prompt: string;
  type: StudioOutputType;
  title: string;
  status: StudioJobStatus;
  progress: number;
  notes: string[];
  result?: string;
  backendJobId?: string;
};

function inferTitle(prompt: string, type: StudioOutputType) {
  const trimmed = prompt.trim();
  if (!trimmed) return `Untitled ${type}`;
  return trimmed.slice(0, 48);
}

export function createStudioJob(prompt: string, type: StudioOutputType): StudioJob {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    prompt,
    type,
    title: inferTitle(prompt, type),
    status: "idle",
    progress: 0,
    notes: ["Job created"],
  };
}

const FLOW: StudioJobStatus[] = ["idle", "writing", "editing", "storyboarding", "rendering", "mastering", "complete"];

export function advanceStudioJob(job: StudioJob): StudioJob {
  const idx = FLOW.indexOf(job.status as any);
  const next = FLOW[Math.min(idx + 1, FLOW.length - 1)];
  const progress = Math.min(100, Math.round(((FLOW.indexOf(next as any)) / (FLOW.length - 1)) * 100));
  return {
    ...job,
    status: next as StudioJobStatus,
    progress,
    notes: [...job.notes, `Advanced to ${next}`],
    result: next === "complete" ? buildFinalArtifactSummary(job) : job.result,
  };
}

export function autoAdvanceStudioJob(job: StudioJob): StudioJob {
  let current = { ...job };
  while (current.status !== "complete") {
    current = advanceStudioJob(current);
  }
  return current;
}

export function markStudioJobBridged(job: StudioJob, backendJobId: string) {
  return {
    ...job,
    backendJobId,
    status: "bridged" as StudioJobStatus,
    progress: Math.max(job.progress, 72),
    notes: [...job.notes, `Submitted to live creative backend (${backendJobId})`],
  };
}

export function buildFinalArtifactSummary(job: StudioJob): string {
  const base = [
    `Title: ${job.title}`,
    `Type: ${job.type}`,
    `Prompt: ${job.prompt}`,
    "",
    "Auto-generated production pack:",
    "- concept locked",
    "- writing pass complete",
    "- edit pass complete",
    "- storyboard/render prep complete",
    "- final mastering complete",
  ];
  if (job.backendJobId) {
    base.push(`- backend job id: ${job.backendJobId}`);
  }
  return base.join("\n");
}

export function stageLabel(status: StudioJobStatus) {
  switch (status) {
    case "idle": return "Queued";
    case "writing": return "Writing";
    case "editing": return "Editing";
    case "storyboarding": return "Storyboarding";
    case "rendering": return "Rendering";
    case "mastering": return "Mastering";
    case "bridged": return "Bridged";
    case "complete": return "Complete";
    default: return status;
  }
}
