import { filterDeals } from './base.mjs';
import { loadSeedDeals } from './seedProvider.mjs';

function enrich(rows = []) {
  return rows.map((row) => ({
    ...row,
    source: row.source || 'Walmart',
    store: 'Walmart',
    summary: row.summary || 'Rollback + digital coupon starter lane.',
    score: Number(row.score || 68) + (/coupon|rollback|clearance|digital/i.test(`${row.title} ${row.summary || ''}`) ? 8 : 0),
  }));
}

export const walmartStarterProvider = {
  id: 'walmart-starter',
  label: 'Walmart starter',
  kind: 'store-starter',
  stores: ['Walmart'],
  description: 'Rollback / digital-coupon starter lane for Walmart-style runs.',
  async getDeals({ query = '', stores = [] } = {}) {
    const rows = loadSeedDeals().filter((row) => /walmart/i.test(`${row.store || ''} ${row.source || ''}`));
    const mergedStores = stores?.length ? stores : ['Walmart'];
    return {
      provider: 'walmart-starter',
      updatedAt: new Date().toISOString(),
      stores: mergedStores,
      query,
      deals: filterDeals(enrich(rows), query, mergedStores),
    };
  },
};
