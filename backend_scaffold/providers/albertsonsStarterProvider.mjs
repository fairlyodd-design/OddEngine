import { filterDeals } from './base.mjs';
import { loadSeedDeals } from './seedProvider.mjs';

function enrich(rows = []) {
  return rows.map((row) => ({
    ...row,
    source: row.source || 'Albertsons/Vons',
    store: 'Albertsons/Vons',
    summary: row.summary || 'BOGO + app-reward starter lane for Albertsons/Vons.',
    score: Number(row.score || 67) + (/bogo|reward|app|coupon/i.test(`${row.title} ${row.summary || ''}`) ? 10 : 0),
  }));
}

export const albertsonsStarterProvider = {
  id: 'albertsons-starter',
  label: 'Albertsons / Vons starter',
  kind: 'store-starter',
  stores: ['Albertsons/Vons'],
  description: 'BOGO + app-reward starter lane for Albertsons-family stores.',
  async getDeals({ query = '', stores = [] } = {}) {
    const rows = loadSeedDeals().filter((row) => /albertsons|vons/i.test(`${row.store || ''} ${row.source || ''}`));
    const mergedStores = stores?.length ? stores : ['Albertsons/Vons'];
    return {
      provider: 'albertsons-starter',
      updatedAt: new Date().toISOString(),
      stores: mergedStores,
      query,
      deals: filterDeals(enrich(rows), query, mergedStores),
    };
  },
};
