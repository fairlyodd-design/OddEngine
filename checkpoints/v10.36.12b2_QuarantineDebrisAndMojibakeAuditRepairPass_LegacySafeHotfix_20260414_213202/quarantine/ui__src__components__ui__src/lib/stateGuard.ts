import { loadJSON } from "./storage";

type AnyRecord = Record<string, any>;

export type StateEnvelope<T> = {
  version: string;
  savedAt: number;
  data: T;
};

export type GuardConfig<T> = {
  key: string;
  version: string;
  defaultState: T;
  sanitize: (raw: unknown, fallback: T) => T;
  legacyKeys?: string[];
};

function isObject(value: unknown): value is AnyRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function toRecord(value: unknown): AnyRecord {
  return isObject(value) ? value : {};
}

export function labelFromUnknown(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!isObject(value)) return "";
  const candidates = [value.item, value.title, value.name, value.label, value.retailerName, value.store, value.text];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const label = labelFromUnknown(entry);
    if (!label) continue;
    const clean = label.trim();
    const dedupeKey = clean.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(clean);
  }
  return out;
}

export function normalizeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(v)) return true;
    if (["false", "0", "no", "off"].includes(v)) return false;
  }
  return fallback;
}

export function normalizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readFirstAvailable(keys: string[], fallback: unknown) {
  for (const key of keys) {
    const value = loadJSON<unknown>(key, fallback);
    if (value !== fallback) return value;
  }
  return fallback;
}

export function unwrapStateEnvelope<T>(raw: unknown): unknown {
  if (isObject(raw) && "data" in raw && typeof (raw as AnyRecord).version === "string") {
    return (raw as AnyRecord).data as T;
  }
  return raw;
}

export function loadGuardedState<T>(config: GuardConfig<T>): T {
  const keys = [config.key, ...(config.legacyKeys || [])];
  const raw = readFirstAvailable(keys, config.defaultState);
  const unwrapped = unwrapStateEnvelope<T>(raw);
  return config.sanitize(unwrapped, config.defaultState);
}

export function saveGuardedState<T>(key: string, version: string, value: T) {
  try {
    const envelope: StateEnvelope<T> = { version, savedAt: Date.now(), data: value };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // ignore write failures
  }
}

export function needsRewrite<T>(value: T, sanitize: (raw: unknown, fallback: T) => T): boolean {
  try {
    const sanitized = sanitize(value, value);
    return JSON.stringify(sanitized) !== JSON.stringify(value);
  } catch {
    return false;
  }
}
