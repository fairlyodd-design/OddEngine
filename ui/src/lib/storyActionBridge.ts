import type { StoryBridgeRoomKey } from "./storyBridge";

export type StoryActionType =
  | "add-room-note"
  | "generate-room-packet"
  | "regenerate-pipeline"
  | "prep-render-packet"
  | "create-render-job"
  | "refresh-render-queue"
  | "import-render-output"
  | "watch-render-output"
  | "save-output-review-note"
  | "approve-render-output"
  | "revise-render-output"
  | "rerender-render-output"
  | "prep-revision-loop"
  | "prep-rerender-packet"
  | "prep-publish-packet"
  | "prep-release-board"
  | "prep-provider-route"
  | "final-export-deliverables";

export type StoryActionRequest = {
  id: string;
  type: StoryActionType;
  projectId: string;
  projectTitle: string;
  room: StoryBridgeRoomKey;
  noteText?: string;
  decision?: "approved" | "revise" | "rerender";
  cue?: string;
  requestedBy: "homie" | "books";
  status: "pending" | "running" | "done" | "error";
  createdAt: number;
  updatedAt: number;
  resultSummary?: string;
  resultDetail?: string;
  resultData?: Record<string, unknown>;
};

export const STORY_ACTION_BRIDGE_STORAGE_KEY = "oddengine:story-action-bridge:v1";
export const STORY_ACTION_BRIDGE_EVENT = "oddengine:story-action-bridge-updated";

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function uid() {
  return `story_action_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readStoryActions(): StoryActionRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORY_ACTION_BRIDGE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => isObject(item) && typeof item.id === "string") as StoryActionRequest[];
  } catch {
    return [];
  }
}

export function writeStoryActions(actions: StoryActionRequest[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORY_ACTION_BRIDGE_STORAGE_KEY, JSON.stringify(actions));
    window.dispatchEvent(new CustomEvent(STORY_ACTION_BRIDGE_EVENT, { detail: actions }));
  } catch {
    // ignore local-only storage issues
  }
}

export function queueStoryAction(
  input: Omit<StoryActionRequest, "id" | "createdAt" | "updatedAt" | "status"> & { status?: StoryActionRequest["status"] },
) {
  const next: StoryActionRequest = {
    ...input,
    id: uid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: input.status || "pending",
  };
  const actions = [next, ...readStoryActions()].slice(0, 50);
  writeStoryActions(actions);
  return next;
}

export function updateStoryAction(id: string, patch: Partial<StoryActionRequest>) {
  const actions = readStoryActions().map((action) => (
    action.id === id
      ? {
          ...action,
          ...patch,
          updatedAt: Date.now(),
        }
      : action
  ));
  writeStoryActions(actions);
  return actions.find((action) => action.id === id) || null;
}

export function subscribeStoryActions(listener: (actions: StoryActionRequest[]) => void) {
  if (typeof window === "undefined") return () => undefined;

  const customHandler = (event: Event) => {
    const detail = (event as CustomEvent<StoryActionRequest[]>).detail;
    listener(Array.isArray(detail) ? detail : readStoryActions());
  };

  const storageHandler = (event: StorageEvent) => {
    if (event.key && event.key !== STORY_ACTION_BRIDGE_STORAGE_KEY) return;
    listener(readStoryActions());
  };

  window.addEventListener(STORY_ACTION_BRIDGE_EVENT, customHandler as EventListener);
  window.addEventListener("storage", storageHandler);

  return () => {
    window.removeEventListener(STORY_ACTION_BRIDGE_EVENT, customHandler as EventListener);
    window.removeEventListener("storage", storageHandler);
  };
}

export function getProjectStoryActions(projectId?: string | null) {
  const actions = readStoryActions();
  if (!projectId) return actions;
  return actions.filter((action) => action.projectId === projectId);
}

export function latestStoryActionForProject(projectId?: string | null) {
  return getProjectStoryActions(projectId)[0] || null;
}

export function storyActionLabel(type: StoryActionType) {
  switch (type) {
    case "add-room-note":
      return "Save room note";
    case "generate-room-packet":
      return "Build room packet";
    case "regenerate-pipeline":
      return "Rebuild pipeline";
    case "prep-render-packet":
      return "Prep render packet";
    case "create-render-job":
      return "Queue render job";
    case "refresh-render-queue":
      return "Refresh render queue";
    case "import-render-output":
      return "Import latest output";
    case "watch-render-output":
      return "Mark output watched";
    case "save-output-review-note":
      return "Save output note";
    case "approve-render-output":
      return "Approve output";
    case "revise-render-output":
      return "Revise output";
    case "rerender-render-output":
      return "Request re-render";
    case "prep-revision-loop":
      return "Prep revision loop";
    case "prep-rerender-packet":
      return "Prep re-render packet";
    case "prep-publish-packet":
      return "Prep publish packet";
    case "prep-release-board":
      return "Prep release board";
    case "prep-provider-route":
      return "Prep provider route";
    case "final-export-deliverables":
      return "Final export deliverables";
    default:
      return "Story action";
  }
}
