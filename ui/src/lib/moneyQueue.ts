
export type MoneyQueueItemStatus = "queued" | "executing" | "completed" | "skipped" | "snoozed";

export type MoneyQueueItem = {
  id: string;
  title: string;
  actionType: "scale" | "fix" | "stop" | "test";
  reason: string;
  score: number;
  status: MoneyQueueItemStatus;
  createdAt: string;
};

const KEY = "fairlyodd.moneyAutopilotQueue.v10.26.17y";

export function loadMoneyQueue(): MoneyQueueItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMoneyQueue(items: MoneyQueueItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
}

export function buildQueueFromSuggestions(suggestions: any[]): MoneyQueueItem[] {
  const now = new Date().toISOString();
  return suggestions.map((s, idx) => ({
    id: `${s.id || idx}-${idx}`,
    title: s.message,
    actionType: s.type,
    reason: s.message,
    score: s.score,
    status: "queued",
    createdAt: now,
  }));
}

export function updateQueueStatus(items: MoneyQueueItem[], id: string, status: MoneyQueueItemStatus): MoneyQueueItem[] {
  return items.map(item => item.id === id ? { ...item, status } : item);
}
