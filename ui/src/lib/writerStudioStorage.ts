import { loadJSON, saveJSON } from "./storage";
import { normalizeAnimationRenderJob } from "./writerEngine";

export const WRITER_STORAGE_VERSION = "10.33.4";
export const WRITER_STORAGE_KEYS = {
  renderJobs: "oddengine:writers31_2:animation:renderJobs",
  renderActive: "oddengine:writers31_2:animation:renderActive",
  episodes: "oddengine:writers31_2:animation:episodes",
  imported: "oddengine:writers31_6:animation:imported",
  studioPipeline: "oddengine:writers32_0:studio:pipeline",
  autoOpenRenderLab: "oddengine:writers32_0:studio:autoOpenRenderLab",
  migrationStamp: "oddengine:writers33_4:storage:migrationStamp",
  migrationReport: "oddengine:writers33_4:storage:migrationReport",
  backupPrefix: "oddengine:writers33_4:storage:backup:",
};

type MigrationReport = {
  version: string;
  ranAt: number;
  jobsBefore: number;
  jobsAfter: number;
  clearedKeys: string[];
  normalizedJobs: boolean;
  reason: string;
};

function safeParse(raw: string | null) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function looksLikeRenderableJob(job: any) {
  if (!job || typeof job !== "object") return false;
  if (typeof job.id !== "string" && typeof job.projectTitle !== "string") return false;
  if (job.scenes == null) return true;
  return Array.isArray(job.scenes) || typeof job.scenes === "object";
}

function snapshotKey() {
  return `${WRITER_STORAGE_KEYS.backupPrefix}${Date.now()}`;
}

function backupValues(keys: string[]) {
  try {
    const snapshot: Record<string, string> = {};
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (typeof raw === "string") snapshot[key] = raw;
    }
    if (Object.keys(snapshot).length) {
      localStorage.setItem(snapshotKey(), JSON.stringify(snapshot));
    }
  } catch {}
}

function clearKeys(keys: string[]) {
  for (const key of keys) {
    try { localStorage.removeItem(key); } catch {}
  }
}

export function getWriterStudioMigrationReport(): MigrationReport | null {
  return loadJSON<MigrationReport | null>(WRITER_STORAGE_KEYS.migrationReport, null);
}

export function runWriterStudioStorageMigration(force = false): MigrationReport | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  const stamp = loadJSON<{ version?: string } | null>(WRITER_STORAGE_KEYS.migrationStamp, null);
  if (!force && stamp?.version === WRITER_STORAGE_VERSION) return getWriterStudioMigrationReport();

  const keysToProtect = [
    WRITER_STORAGE_KEYS.renderJobs,
    WRITER_STORAGE_KEYS.renderActive,
    WRITER_STORAGE_KEYS.episodes,
    WRITER_STORAGE_KEYS.imported,
    WRITER_STORAGE_KEYS.studioPipeline,
  ];

  const rawJobs = safeParse(localStorage.getItem(WRITER_STORAGE_KEYS.renderJobs));
  const jobsBefore = Array.isArray(rawJobs) ? rawJobs.length : 0;
  let normalizedJobs = false;
  let reason = "storage already healthy";
  let clearedKeys: string[] = [];

  if (rawJobs != null && !Array.isArray(rawJobs)) {
    backupValues(keysToProtect);
    clearedKeys = [...keysToProtect];
    clearKeys(keysToProtect);
    reason = "render jobs payload was not an array";
  } else if (Array.isArray(rawJobs)) {
    const invalid = rawJobs.some((job) => !looksLikeRenderableJob(job));
    if (invalid) {
      backupValues(keysToProtect);
      clearedKeys = [...keysToProtect];
      clearKeys(keysToProtect);
      reason = "detected incompatible legacy render job records";
    } else {
      const normalized = rawJobs.map((job) => normalizeAnimationRenderJob(job));
      const normalizedActive = String(localStorage.getItem(WRITER_STORAGE_KEYS.renderActive) || "").replace(/^"|"$/g, "");
      const activeStillExists = normalized.some((job) => job.id === normalizedActive);
      saveJSON(WRITER_STORAGE_KEYS.renderJobs, normalized);
      if (normalizedActive && !activeStillExists) {
        saveJSON(WRITER_STORAGE_KEYS.renderActive, normalized[0]?.id || "");
      }
      normalizedJobs = true;
      reason = "normalized render jobs and repaired active selection";
    }
  }

  const report: MigrationReport = {
    version: WRITER_STORAGE_VERSION,
    ranAt: Date.now(),
    jobsBefore,
    jobsAfter: Array.isArray(loadJSON<any[]>(WRITER_STORAGE_KEYS.renderJobs, [])) ? loadJSON<any[]>(WRITER_STORAGE_KEYS.renderJobs, []).length : 0,
    clearedKeys,
    normalizedJobs,
    reason,
  };
  saveJSON(WRITER_STORAGE_KEYS.migrationStamp, { version: WRITER_STORAGE_VERSION, ts: Date.now() });
  saveJSON(WRITER_STORAGE_KEYS.migrationReport, report);
  return report;
}
