
export type MoneyOutcomeRecord = {
  id: string;
  queueItemId: string;
  title: string;
  outcomeType: "earned" | "saved" | "learned" | "failed";
  amount?: number;
  notes?: string;
  createdAt: string;
};

const KEY = "fairlyodd.moneyOutcomeLoop.v10.26.17z";

export function loadOutcomeRecords(): MoneyOutcomeRecord[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOutcomeRecords(records: MoneyOutcomeRecord[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(records));
  } catch {}
}

export function createOutcomeRecord(queueItemId: string, title: string, outcomeType: MoneyOutcomeRecord["outcomeType"], amount?: number, notes?: string): MoneyOutcomeRecord {
  return {
    id: `${queueItemId}-${Date.now()}`,
    queueItemId,
    title,
    outcomeType,
    amount,
    notes,
    createdAt: new Date().toISOString(),
  };
}

export function summarizeOutcomes(records: MoneyOutcomeRecord[]) {
  return records.reduce((acc, r) => {
    if (r.outcomeType === "earned" || r.outcomeType === "saved") {
      acc.money += Number(r.amount || 0);
    }
    acc.count += 1;
    acc[r.outcomeType] = (acc[r.outcomeType] || 0) + 1;
    return acc;
  }, { money: 0, count: 0, earned: 0, saved: 0, learned: 0, failed: 0 } as any);
}
