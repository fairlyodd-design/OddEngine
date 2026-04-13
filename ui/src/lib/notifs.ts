import { loadJSON, saveJSON } from "./storage";

export type Notif = {
  id: string;
  ts: number;
  title: string;
  body?: string;
  tags: string[];
  level: "info" | "warn" | "error" | "success";
};

type LegacyNotifInput =
  | string
  | {
      title?: string;
      body?: string;
      detail?: string;
      tags?: string[];
      level?: Notif["level"] | "good" | "bad" | "muted" | string;
      kind?: string;
    };

const KEY = "oddengine:notifs";

export function getNotifs(): Notif[] {
  return loadJSON<Notif[]>(KEY, []);
}

function normalizeLevel(input?: string, kind?: string): Notif["level"] {
  const value = String(input || "").toLowerCase().trim();
  if (value === "success" || value === "good") return "success";
  if (value === "warn" || value === "warning") return "warn";
  if (value === "error" || value === "bad") return "error";
  if (value === "info" || value === "muted") return "info";

  const kindValue = String(kind || "").toLowerCase().trim();
  if (kindValue.includes("error")) return "error";
  if (kindValue.includes("warn")) return "warn";
  if (kindValue.includes("success") || kindValue.includes("good")) return "success";
  return "info";
}

function normalizeInput(input: LegacyNotifInput): Omit<Notif, "id" | "ts"> {
  if (typeof input === "string") {
    return {
      title: "OddEngine",
      body: input,
      tags: ["OddEngine"],
      level: "info",
    };
  }

  return {
    title: String(input.title || input.kind || "OddEngine"),
    body: String(input.body || input.detail || ""),
    tags: Array.isArray(input.tags) ? input.tags.map((x) => String(x)) : ["OddEngine"],
    level: normalizeLevel(input.level, input.kind),
  };
}

export function pushNotif(input: LegacyNotifInput) {
  const list = getNotifs();
  const notif: Notif = {
    id: crypto.randomUUID(),
    ts: Date.now(),
    ...normalizeInput(input),
  };
  list.unshift(notif);
  saveJSON(KEY, list.slice(0, 500));
  return notif;
}

export function clearNotifs() {
  saveJSON(KEY, []);
}
