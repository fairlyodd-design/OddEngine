import { filterDeals } from './base.mjs';
import { loadSeedDeals } from './seedProvider.mjs';

function fallbackTarget() {
  return [
    {
      id: 'target-snack-001',
      title: 'Circle week snack + pantry combo',
      link: 'https://example.local/target/snack-combo',
      source: 'Target',
      store: 'Target',
      publishedAt: new Date().toISOString().slice(0, 10),
      summary: 'Target Circle style starter for pantry, snacks, and household add-ons.',
      score: 70,
    }
  ];
}

function enrich(rows = []) {
  return rows.map((row) => ({
    ...row,
    source: row.source || 'Target',
    store: 'Target',
    summary: row.summary || 'Circle-style starter lane for pantry + household overlap runs.',
    score: Number(row.score || 65) + (/target|circle|household|pantry|coupon/i.test(`${row.title} ${row.summary || ''}`) ? 9 : 0),
  }));
}

export const targetStarterProvider = {
  id: 'target-starter',
  label: 'Target starter',
  kind: 'store-starter',
  stores: ['Target'],
  description: 'Target Circle style starter lane for pantry + household overlap runs.',
  async getDeals({ query = '', stores = [] } = {}) {
    const rows = loadSeedDeals().filter((row) => /target/i.test(`${row.store || ''} ${row.source || ''}`));
    const merged = rows.length ? rows : fallbackTarget();
    const mergedStores = stores?.length ? stores : ['Target'];
    return {
      provider: 'target-starter',
      updatedAt: new Date().toISOString(),
      stores: mergedStores,
      query,
      deals: filterDeals(enrich(merged), query, mergedStores),
    };
  },
};
