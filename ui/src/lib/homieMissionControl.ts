export type HomieMissionStatus = "idle" | "focus" | "watch" | "alert" | "celebrate";

export type HomieMissionArea =
  | "home"
  | "studio"
  | "grocery"
  | "familybudget"
  | "calendar"
  | "preferences"
  | "health";

export type HomieMissionItem = {
  id: string;
  title: string;
  detail: string;
  area: HomieMissionArea;
  priority: 1 | 2 | 3;
  done: boolean;
};

export type HomieMissionControlState = {
  operatorName: string;
  missionTitle: string;
  missionStatus: HomieMissionStatus;
  dailyFocus: string;
  nextBestAction: string;
  notes: string;
  recentPanel: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
  items: HomieMissionItem[];
  updatedAt: number;
};

export type HomieMissionSummary = {
  total: number;
  done: number;
  open: number;
  completionPercent: number;
  topPriorityOpen: HomieMissionItem | null;
  readinessLabel: string;
};

const STORAGE_KEY = "oddengine:homie:missionControl:v1";

function now() {
  return Date.now();
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${now().toString(36)}`;
}

export function createDefaultMissionItems(): HomieMissionItem[] {
  return [
    {
      id: makeId("mission"),
      title: "Check today’s household priorities",
      detail: "Review Home, Calendar, Grocery, and Budget so Homie can guide the day cleanly.",
      area: "home",
      priority: 1,
      done: false,
    },
    {
      id: makeId("mission"),
      title: "Review Studio production lane",
      detail: "Open Studio and check next-best action, render readiness, and release blockers.",
      area: "studio",
      priority: 2,
      done: false,
    },
    {
      id: makeId("mission"),
      title: "Check grocery + household budget link",
      detail: "Make sure Grocery Meals and Family Budget are tracking the same weekly plan.",
      area: "grocery",
      priority: 2,
      done: false,
    },
  ];
}

export function createDefaultMissionControlState(): HomieMissionControlState {
  return {
    operatorName: "Homie",
    missionTitle: "Mission Control",
    missionStatus: "focus",
    dailyFocus: "Keep the household + creator OS moving with one clear next action at a time.",
    nextBestAction: "Review today’s priorities, then open the most urgent panel.",
    notes: "Homie is here to guide the OS, highlight blockers, and keep momentum up.",
    recentPanel: "Home",
    micEnabled: false,
    cameraEnabled: false,
    items: createDefaultMissionItems(),
    updatedAt: now(),
  };
}

function hasWindow() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadHomieMissionControl(): HomieMissionControlState {
  if (!hasWindow()) return createDefaultMissionControlState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultMissionControlState();
    const parsed = JSON.parse(raw) as Partial<HomieMissionControlState>;
    const fallback = createDefaultMissionControlState();
    return {
      ...fallback,
      ...parsed,
      items: Array.isArray(parsed.items) && parsed.items.length ? parsed.items : fallback.items,
      updatedAt: Number(parsed.updatedAt || fallback.updatedAt),
    };
  } catch {
    return createDefaultMissionControlState();
  }
}

export function saveHomieMissionControl(state: HomieMissionControlState) {
  if (!hasWindow()) return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...state,
      updatedAt: now(),
    }),
  );
}

export function buildHomieMissionSummary(state: HomieMissionControlState): HomieMissionSummary {
  const total = state.items.length;
  const done = state.items.filter((item) => item.done).length;
  const openItems = state.items.filter((item) => !item.done);
  const open = openItems.length;
  const completionPercent = total > 0 ? Math.round((done / total) * 100) : 100;
  const topPriorityOpen = [...openItems].sort((a, b) => a.priority - b.priority)[0] || null;
  const readinessLabel =
    completionPercent >= 80 ? "Ready" : completionPercent >= 50 ? "Moving" : "Needs focus";

  return {
    total,
    done,
    open,
    completionPercent,
    topPriorityOpen,
    readinessLabel,
  };
}

export function toggleMissionItem(
  state: HomieMissionControlState,
  itemId: string,
): HomieMissionControlState {
  return {
    ...state,
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item,
    ),
    updatedAt: now(),
  };
}

export function addMissionItem(
  state: HomieMissionControlState,
  input: Pick<HomieMissionItem, "title" | "detail" | "area" | "priority">,
): HomieMissionControlState {
  return {
    ...state,
    items: [
      {
        id: makeId("mission"),
        done: false,
        ...input,
      },
      ...state.items,
    ],
    updatedAt: now(),
  };
}

export function removeMissionItem(
  state: HomieMissionControlState,
  itemId: string,
): HomieMissionControlState {
  return {
    ...state,
    items: state.items.filter((item) => item.id !== itemId),
    updatedAt: now(),
  };
}

export function getMissionPanelActions() {
  return [
    { label: "Open Home", panelId: "Home" },
    { label: "Open Studio", panelId: "Books" },
    { label: "Open Grocery", panelId: "GroceryMeals" },
    { label: "Open Family Budget", panelId: "FamilyBudget" },
    { label: "Open Calendar", panelId: "Calendar" },
    { label: "Open Preferences", panelId: "Preferences" },
  ];
}
