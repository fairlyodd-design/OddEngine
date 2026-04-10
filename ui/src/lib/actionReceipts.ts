import { loadJSON, saveJSON } from "./storage";

export type ActionReceipt = {
  id: string;
  ts: number;
  action: string;
  scope: string;
  status: "queued" | "running" | "completed" | "failed";
  message: string;
  runId?: string;
  panelId?: string;
};

const KEY = "oddengine:systemTruth:receipts:v1";
const EVENT = "oddengine:system-truth:receipts";

function uid() {
  return `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function save(items: ActionReceipt[]) {
  saveJSON(KEY, items.slice(0, 300));
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch {}
}

export function listActionReceipts(): ActionReceipt[] {
  return loadJSON<ActionReceipt[]>(KEY, []).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

export function recordActionReceipt(input: Omit<ActionReceipt, "id" | "ts"> & { ts?: number }) {
  const receipt: ActionReceipt = { id: uid(), ts: input.ts || Date.now(), action: input.action, scope: input.scope, status: input.status, message: input.message, runId: input.runId, panelId: input.panelId };
  save([receipt, ...listActionReceipts()]);
  return receipt;
}

export const ACTION_RECEIPTS_EVENT = EVENT;
