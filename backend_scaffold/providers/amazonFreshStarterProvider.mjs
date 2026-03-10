import { filterDeals } from './base.mjs';
import { loadSeedDeals } from './seedProvider.mjs';

function enrich(rows = []) {
  return rows.map((row, idx) => ({
    ...row,
    id: row.id || `amazonfresh_${idx + 1}`,
    source: row.source || 'Amazon Fresh',
    store: 'Amazon Fresh',
    summary: row.summary || 'Delivery-first starter lane for Amazon Fresh / Whole Foods style basket checks.',
    score: Number(row.score || 68) + (/delivery|subscribe|fresh|produce|meal prep/i.test(`${row.title} ${row.summary || ''}`) ? 11 : 0),
  }));
}

export const amazonFreshStarterProvider = {
  id: 'amazon-fresh-starter',
  label: 'Amazon Fresh starter',
  kind: 'store-starter',
  stores: ['Amazon Fresh'],
  description: 'Delivery-first starter lane for Amazon Fresh-style grocery checks.',
  async getDeals({ query = '', stores = [] } = {}) {
    const rows = loadSeedDeals().slice(0, 8).map((row, idx) => ({
      ...row,
      title: idx % 2 === 0 ? `Amazon Fresh style deal • ${row.title}` : row.title,
      store: 'Amazon Fresh',
      source: 'Amazon Fresh',
    }));
    const mergedStores = stores?.length ? stores : ['Amazon Fresh'];
    return {
      provider: 'amazon-fresh-starter',
      updatedAt: new Date().toISOString(),
      stores: mergedStores,
      query,
      deals: filterDeals(enrich(rows), query, mergedStores),
    };
  },
};
