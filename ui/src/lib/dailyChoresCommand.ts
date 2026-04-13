import { loadJSON } from "./storage";

export type DailyChoreItem = { id: string; text: string; done: boolean };
export type DailyChoreBucket = { title: string; items: DailyChoreItem[] };
export type DailyChoreState = {
  household: DailyChoreBucket;
  outdoor: DailyChoreBucket;
  animals: DailyChoreBucket;
  todayNote: string;
};

export type LaneName = "household" | "outdoor" | "animals";

export type DailyLaneSnapshot = {
  name: LaneName;
  title: string;
  open: number;
  done: number;
  total: number;
  pct: number;
  next: DailyChoreItem | null;
};

export type DailyChoresSnapshot = {
  total: number;
  done: number;
  open: number;
  pct: number;
  lanes: DailyLaneSnapshot[];
  hotLane: DailyLaneSnapshot | null;
  mustDoToday: Array<{ lane: LaneName; laneTitle: string; text: string; taskId: string }>;
  summary: string;
  familyDirection: string;
  todayNote: string;
};

export const DAILY_CHORES_KEY = "oddengine:dailyChores:v1";
export const DAILY_CHORES_EVENT = "oddengine:daily-chores-changed";

export function createDailyChoresSeed(): DailyChoreState {
  return {
    household: {
      title: "Household",
      items: [
        { id: "h1", text: "Dishes / kitchen reset", done: false },
        { id: "h2", text: "Laundry sweep", done: false },
        { id: "h3", text: "Trash + quick tidy", done: false },
      ],
    },
    outdoor: {
      title: "Outdoor",
      items: [
        { id: "o1", text: "Check yard / porch", done: false },
        { id: "o2", text: "Water plants or beds", done: false },
        { id: "o3", text: "Tools / bins / gates check", done: false },
      ],
    },
    animals: {
      title: "Animals",
      items: [
        { id: "a1", text: "Feed / water refresh", done: false },
        { id: "a2", text: "Walk / play / enrichment", done: false },
        { id: "a3", text: "Clean area / litter / waste", done: false },
      ],
    },
    todayNote: "",
  };
}

export function loadDailyChoresState(): DailyChoreState {
  const seed = createDailyChoresSeed();
  const stored = loadJSON<DailyChoreState>(DAILY_CHORES_KEY, seed);
  return {
    ...seed,
    ...stored,
    household: stored?.household || seed.household,
    outdoor: stored?.outdoor || seed.outdoor,
    animals: stored?.animals || seed.animals,
    todayNote: String(stored?.todayNote || ""),
  };
}

export function lanePriority(openCount: number) {
  if (openCount >= 4) return "High";
  if (openCount >= 2) return "Medium";
  return "Low";
}

export function laneTone(openCount: number) {
  if (openCount >= 4) return "bad";
  if (openCount >= 2) return "warn";
  return "good";
}

export function computeDailyChoresSnapshot(state: DailyChoreState): DailyChoresSnapshot {
  const laneOrder: LaneName[] = ["household", "outdoor", "animals"];
  const lanes: DailyLaneSnapshot[] = laneOrder.map((name) => {
    const bucket = state[name];
    const done = bucket.items.filter((item) => item.done).length;
    const open = Math.max(0, bucket.items.length - done);
    return {
      name,
      title: bucket.title,
      open,
      done,
      total: bucket.items.length,
      pct: bucket.items.length ? Math.round((done / bucket.items.length) * 100) : 0,
      next: bucket.items.find((item) => !item.done) || null,
    };
  });

  const total = lanes.reduce((sum, lane) => sum + lane.total, 0);
  const done = lanes.reduce((sum, lane) => sum + lane.done, 0);
  const open = Math.max(0, total - done);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const hotLane = [...lanes].sort((a, b) => (b.open - a.open) || a.title.localeCompare(b.title))[0] || null;

  const preferred = hotLane
    ? [hotLane, ...lanes.filter((lane) => lane.name !== hotLane.name)]
    : lanes;

  const mustDoToday = preferred
    .map((lane) => lane.next ? { lane: lane.name, laneTitle: lane.title, text: lane.next.text, taskId: lane.next.id } : null)
    .filter(Boolean) as Array<{ lane: LaneName; laneTitle: string; text: string; taskId: string }>;

  const summary = open
    ? `${open} task${open === 1 ? "" : "s"} still open. Start with ${hotLane?.title || "the next lane"}${hotLane?.next ? `: ${hotLane.next.text}.` : "."}`
    : "The chore board is clear. Use today note or recurring buttons to stage the next reset.";

  const otherLanes = lanes.filter((lane) => lane.open > 0 && lane.name !== hotLane?.name);
  const familyDirection = open
    ? `Do ${hotLane?.title.toLowerCase() || "the next lane"} first, then ${otherLanes.length ? otherLanes.map((lane) => lane.title.toLowerCase()).join(" + ") : "close the board out"} so the house settles down faster.`
    : "Everything is caught up right now. Keep the note field ready for anything special that pops up today.";

  return {
    total,
    done,
    open,
    pct,
    lanes,
    hotLane,
    mustDoToday,
    summary,
    familyDirection,
    todayNote: String(state.todayNote || ""),
  };
}

export function buildDailyChoresContext(snapshot: DailyChoresSnapshot) {
  const lines = [
    `Open chores: ${snapshot.open}`,
    `Done chores: ${snapshot.done}`,
    `Hot lane: ${snapshot.hotLane?.title || "Clear"}`,
    `Summary: ${snapshot.summary}`,
  ];
  if (snapshot.todayNote) lines.push(`Today note: ${snapshot.todayNote}`);
  snapshot.mustDoToday.slice(0, 3).forEach((item, idx) => {
    lines.push(`Must-do ${idx + 1}: ${item.laneTitle} — ${item.text}`);
  });
  return lines.join("\n");
}
