import { filterDeals } from './base.mjs';
import { loadSeedDeals } from './seedProvider.mjs';

function enrich(rows = []) {
  return rows.map((row, idx) => ({
    ...row,
    id: row.id || `sams_${idx + 1}`,
    source: row.source || "Sam's Club",
    store: "Sam's Club",
    summary: row.summary || "Bulk-buy + pickup/delivery starter lane for Sam's Club.",
    score: Number(row.score || 70) + (/bulk|club|pickup|delivery|protein|paper/i.test(`${row.title} ${row.summary || ''}`) ? 12 : 0),
  }));
}

export const samsClubStarterProvider = {
  id: 'sams-club-starter',
  label: "Sam's Club starter",
  kind: 'store-starter',
  stores: ["Sam's Club"],
  description: 'Bulk-value + curbside/delivery starter lane for Sam's Club.',
  async getDeals({ query = '', stores = [] } = {}) {
    const seed = loadSeedDeals();
    const rows = seed.slice(-8).map((row, idx) => ({
      ...row,
      title: idx % 2 === 0 ? `Club pack value • ${row.title}` : row.title,
      store: "Sam's Club",
      source: "Sam's Club",
    }));
    const mergedStores = stores?.length ? stores : ["Sam's Club"];
    return {
      provider: 'sams-club-starter',
      updatedAt: new Date().toISOString(),
      stores: mergedStores,
      query,
      deals: filterDeals(enrich(rows), query, mergedStores),
    };
  },
};
