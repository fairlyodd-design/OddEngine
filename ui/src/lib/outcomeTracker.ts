
export type MoneyOutcome = {
  id: string;
  ts: number;
  sourceId?: string;
  sourceType?: string;
  title: string;
  platform: string;
  contentType?: string;
  views: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cost?: number;
  roi: number;
  notes?: string;
};

const KEY = "oddengine:money:outcomes:v1";

function load<T>(fallback: T): T {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function save(value: any) { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {} }
export function listOutcomes(): MoneyOutcome[] {
  return load<MoneyOutcome[]>([]).sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
}
export function addOutcome(input: Partial<MoneyOutcome>): MoneyOutcome {
  const item: MoneyOutcome = {
    id: String(input.id || Math.random().toString(16).slice(2) + Date.now().toString(16)),
    ts: Number(input.ts || Date.now()),
    sourceId: String(input.sourceId || ''),
    sourceType: String(input.sourceType || ''),
    title: String(input.title || 'Untitled outcome'),
    platform: String(input.platform || 'local'),
    contentType: String(input.contentType || ''),
    views: Number(input.views || 0),
    clicks: Number(input.clicks || 0),
    conversions: Number(input.conversions || 0),
    revenue: Number(input.revenue || 0),
    cost: Number(input.cost || 0),
    roi: Number(input.roi ?? ((Number(input.cost || 0) > 0) ? ((Number(input.revenue || 0)-Number(input.cost || 0))/Number(input.cost || 0))*100 : Number(input.revenue || 0) > 0 ? 100 : 0)),
    notes: String(input.notes || ''),
  };
  const next = [item, ...load<MoneyOutcome[]>([])].slice(0, 500);
  save(next);
  return item;
}
export function summarizeOutcomes() {
  const items = listOutcomes();
  const totals = items.reduce((acc, item) => {
    acc.views += Number(item.views || 0);
    acc.clicks += Number(item.clicks || 0);
    acc.conversions += Number(item.conversions || 0);
    acc.revenue += Number(item.revenue || 0);
    acc.cost += Number(item.cost || 0);
    return acc;
  }, { views: 0, clicks: 0, conversions: 0, revenue: 0, cost: 0 });
  const roi = totals.cost > 0 ? ((totals.revenue - totals.cost) / totals.cost) * 100 : totals.revenue > 0 ? 100 : 0;
  return { count: items.length, ...totals, roi };
}
