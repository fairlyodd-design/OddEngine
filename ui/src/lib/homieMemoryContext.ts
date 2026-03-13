export type HomieMemoryEntry = {
  id: string;
  ts: number;
  category: "note" | "preference" | "goal" | "project" | "context";
  title: string;
  summary: string;
  tags?: string[];
};

export type HomieContextSnapshot = {
  activePanel: string;
  recentPanels: string[];
  memoryCount: number;
  pinnedGoals: string[];
  recentProjects: string[];
  topNeeds: string[];
  nextSuggestedAction: string;
};

const MEMORY_KEY = "oddengine:homie:memory:v1";
const GOALS_KEY = "oddengine:homie:pinnedGoals:v1";

function uid() {
  return `homie_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadHomieMemory(): HomieMemoryEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse<HomieMemoryEntry[]>(window.localStorage.getItem(MEMORY_KEY), []);
}

export function saveHomieMemory(entries: HomieMemoryEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MEMORY_KEY, JSON.stringify(entries));
}

export function addHomieMemoryEntry(input: Omit<HomieMemoryEntry, "id" | "ts">) {
  const next: HomieMemoryEntry = {
    id: uid(),
    ts: Date.now(),
    ...input,
  };
  const current = loadHomieMemory();
  const updated = [next, ...current].slice(0, 100);
  saveHomieMemory(updated);
  return next;
}

export function deleteHomieMemoryEntry(id: string) {
  const current = loadHomieMemory();
  const updated = current.filter((entry) => entry.id !== id);
  saveHomieMemory(updated);
  return updated;
}

export function loadPinnedGoals(): string[] {
  if (typeof window === "undefined") return [];
  return safeParse<string[]>(window.localStorage.getItem(GOALS_KEY), []);
}

export function savePinnedGoals(goals: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GOALS_KEY, JSON.stringify(goals.slice(0, 12)));
}

export function buildHomieContextSnapshot(args: {
  activePanel: string;
  recentPanels: string[];
  memory: HomieMemoryEntry[];
  pinnedGoals?: string[];
}): HomieContextSnapshot {
  const pinnedGoals = args.pinnedGoals || [];
  const recentProjects = args.memory
    .filter((entry) => entry.category === "project")
    .slice(0, 4)
    .map((entry) => entry.title);

  const topNeeds = [
    pinnedGoals[0] ? `Stay on track with: ${pinnedGoals[0]}` : "Add a pinned goal",
    args.activePanel ? `Support current panel: ${args.activePanel}` : "Pick a panel focus",
    recentProjects[0] ? `Keep project moving: ${recentProjects[0]}` : "Start or pin a project",
  ].filter(Boolean);

  const nextSuggestedAction =
    args.activePanel === "Preferences"
      ? "Review connections and fill any missing setup fields."
      : args.activePanel === "Books"
        ? "Move Studio from idea to next concrete output."
        : args.activePanel === "GroceryMeals"
          ? "Review deals, budget, and build the next trip plan."
          : args.activePanel === "FamilyBudget"
            ? "Check runway, recurring bills, and grocery pressure together."
            : "Pick the next highest-value action and save it as a note or goal.";

  return {
    activePanel: args.activePanel,
    recentPanels: args.recentPanels.slice(0, 6),
    memoryCount: args.memory.length,
    pinnedGoals: pinnedGoals.slice(0, 5),
    recentProjects,
    topNeeds,
    nextSuggestedAction,
  };
}

export function buildHomieMemoryMarkdown(snapshot: HomieContextSnapshot, memory: HomieMemoryEntry[]) {
  const lines = [
    "# Homie Memory + Context",
    "",
    `- Active panel: ${snapshot.activePanel || "Unknown"}`,
    `- Memory items: ${snapshot.memoryCount}`,
    `- Next suggested action: ${snapshot.nextSuggestedAction}`,
    "",
    "## Pinned goals",
    ...(snapshot.pinnedGoals.length ? snapshot.pinnedGoals.map((goal) => `- ${goal}`) : ["- None yet"]),
    "",
    "## Recent projects",
    ...(snapshot.recentProjects.length ? snapshot.recentProjects.map((project) => `- ${project}`) : ["- None yet"]),
    "",
    "## Top needs",
    ...(snapshot.topNeeds.length ? snapshot.topNeeds.map((need) => `- ${need}`) : ["- None yet"]),
    "",
    "## Memory entries",
    ...(memory.length
      ? memory.slice(0, 20).map((entry) => `- [${entry.category}] ${entry.title}: ${entry.summary}`)
      : ["- No memory entries yet"]),
  ];
  return lines.join("\n");
}
