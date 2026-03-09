import { filterDeals } from './base.mjs';
import { loadSeedDeals } from './seedProvider.mjs';

function enrich(rows = []) {
  return rows.map((row) => ({
    ...row,
    source: row.source || "Smith's/Kroger",
    store: "Smith's/Kroger",
    summary: row.summary || 'Digital coupon + rewards starter lane for Smith's/Kroger.',
    score: Number(row.score || 70) + (/coupon|digital|reward|mix and match/i.test(`${row.title} ${row.summary || ''}`) ? 10 : 0),
  }));
}

export const smithsStarterProvider = {
  id: 'smiths-kroger-starter',
  label: "Smith's / Kroger starter",
  kind: 'store-starter',
  stores: ["Smith's/Kroger"],
  description: 'Digital coupon + rewards starter lane for Kroger-family stores.',
  async getDeals({ query = '', stores = [] } = {}) {
    const rows = loadSeedDeals().filter((row) => /smith|kroger/i.test(`${row.store || ''} ${row.source || ''}`));
    const mergedStores = stores?.length ? stores : ["Smith's/Kroger"];
    return {
      provider: 'smiths-kroger-starter',
      updatedAt: new Date().toISOString(),
      stores: mergedStores,
      query,
      deals: filterDeals(enrich(rows), query, mergedStores),
    };
  },
};
