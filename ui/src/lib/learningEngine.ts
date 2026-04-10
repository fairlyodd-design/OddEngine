
import { listOutcomes } from "./outcomeTracker";

export function buildLearningSummary() {
  const items = listOutcomes();
  const byPlatform = new Map<string, { revenue: number; views: number; count: number }>();
  const byType = new Map<string, { revenue: number; count: number }>();
  for (const item of items) {
    const p = byPlatform.get(item.platform) || { revenue: 0, views: 0, count: 0 };
    p.revenue += Number(item.revenue || 0); p.views += Number(item.views || 0); p.count += 1; byPlatform.set(item.platform, p);
    const t = byType.get(item.contentType || 'unknown') || { revenue: 0, count: 0 };
    t.revenue += Number(item.revenue || 0); t.count += 1; byType.set(item.contentType || 'unknown', t);
  }
  const topPlatforms = [...byPlatform.entries()].sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,5).map(([platform, stats])=>({ platform, ...stats }));
  const topTypes = [...byType.entries()].sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,5).map(([contentType, stats])=>({ contentType, ...stats }));
  const bestPlatform = topPlatforms[0]?.platform || 'local';
  const bestType = topTypes[0]?.contentType || 'social';
  const recommendation = `Best next move: make another ${bestType} pack and ship it to ${bestPlatform}.`;
  return { count: items.length, topPlatforms, topTypes, recommendation };
}
