import { filterDeals } from './base.mjs';
import { loadSeedDeals } from './seedProvider.mjs';

function enrich(rows = []) {
  return rows.map((row) => ({
    ...row,
    source: row.source || 'Costco',
    store: 'Costco',
    summary: row.summary || 'Bulk-stack starter lane for Costco pantry and freezer runs.',
    score: Number(row.score || 66) + (/bulk|family|pantry|freezer/i.test(`${row.title} ${row.summary || ''}`) ? 10 : 0),
  }));
}

export const costcoStarterProvider = {
  id: 'costco-starter',
  label: 'Costco starter',
  kind: 'store-starter',
  stores: ['Costco'],
  description: 'Bulk-stack starter lane for pantry, freezer, and family-pack runs.',
  async getDeals({ query = '', stores = [] } = {}) {
    const rows = loadSeedDeals().filter((row) => /costco/i.test(`${row.store || ''} ${row.source || ''}`));
    const mergedStores = stores?.length ? stores : ['Costco'];
    return {
      provider: 'costco-starter',
      updatedAt: new Date().toISOString(),
      stores: mergedStores,
      query,
      deals: filterDeals(enrich(rows), query, mergedStores),
    };
  },
};
