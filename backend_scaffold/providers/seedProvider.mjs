import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterDeals } from './base.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedPath = path.join(__dirname, '..', 'data', 'groceryDeals.seed.json');

function fallbackDeals() {
  return [
    {
      id: 'smiths-chicken-001',
      title: 'Digital coupon on family-pack chicken thighs',
      link: 'https://example.local/smiths/chicken-thighs',
      source: "Smith's/Kroger",
      store: "Smith's/Kroger",
      publishedAt: new Date().toISOString().slice(0, 10),
      summary: 'Save $2.00 and stack with meal-prep family pack week.',
      score: 82,
    },
    {
      id: 'walmart-rice-001',
      title: 'Rollback on 10 lb jasmine rice',
      link: 'https://example.local/walmart/rice',
      source: 'Walmart',
      store: 'Walmart',
      publishedAt: new Date().toISOString().slice(0, 10),
      summary: 'Cheap-week saver item with pantry coverage upside.',
      score: 76,
    }
  ];
}

function loadSeedDeals() {
  try {
    if (fs.existsSync(seedPath)) {
      const raw = fs.readFileSync(seedPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.deals)) return parsed.deals;
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('[grocery-proxy] Failed reading seed file:', err);
  }
  return fallbackDeals();
}

export const seedProvider = {
  id: 'seed',
  label: 'Seed data',
  kind: 'seed',
  async getDeals({ query = '', stores = [] } = {}) {
    const rows = filterDeals(loadSeedDeals(), query, stores);
    return {
      provider: 'seed',
      updatedAt: new Date().toISOString(),
      stores,
      query,
      deals: rows,
    };
  },
};
