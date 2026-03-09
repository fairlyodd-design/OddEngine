import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.GROCERY_PROXY_PORT || process.env.PORT || 8787);
const HOST = process.env.GROCERY_PROXY_HOST || '127.0.0.1';
const CORS_ORIGIN = process.env.GROCERY_PROXY_CORS_ORIGIN || '*';
const seedPath = path.join(__dirname, 'data', 'groceryDeals.seed.json');

function send(res, code, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function normalize(text = '') {
  return String(text).toLowerCase().trim();
}

function scoreDeal(row, query, stores) {
  const q = normalize(query);
  const hay = normalize(`${row.title} ${row.summary} ${row.source} ${row.store}`);
  let score = Number(row.score || 50);
  if (q && hay.includes(q)) score += 20;
  for (const store of stores) {
    if (normalize(row.store || row.source).includes(normalize(store))) score += 12;
  }
  if (/coupon|digital|bogo|save|off/.test(hay)) score += 8;
  if (/freezer|prep|meal|family|bulk/.test(hay)) score += 5;
  return Math.max(1, Math.min(100, score));
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
    },
    {
      id: 'albertsons-soda-001',
      title: 'BOGO zero-sugar soda with app coupon',
      link: 'https://example.local/albertsons/soda',
      source: 'Albertsons',
      store: 'Albertsons',
      publishedAt: new Date().toISOString().slice(0, 10),
      summary: 'Good filler for event prep if you were buying anyway.',
      score: 67,
    },
    {
      id: 'costco-protein-001',
      title: 'Warehouse markdown on protein multipack',
      link: 'https://example.local/costco/protein',
      source: 'Costco',
      store: 'Costco',
      publishedAt: new Date().toISOString().slice(0, 10),
      summary: 'High-value bulk pickup for prep-heavy weeks.',
      score: 74,
    },
    {
      id: 'target-freezer-001',
      title: 'Circle deal on frozen vegetables',
      link: 'https://example.local/target/frozen-veg',
      source: 'Target',
      store: 'Target',
      publishedAt: new Date().toISOString().slice(0, 10),
      summary: 'Pairs well with meal prep and cheap week baskets.',
      score: 71,
    }
  ];
}

function filterDeals(rows, query, stores) {
  const q = normalize(query);
  const wantedStores = stores.map(normalize).filter(Boolean);
  const filtered = rows.filter((row) => {
    const hay = normalize(`${row.title} ${row.summary} ${row.source} ${row.store}`);
    const storeHay = normalize(`${row.source} ${row.store}`);
    const qOk = !q || hay.includes(q);
    const sOk = !wantedStores.length || wantedStores.some((s) => storeHay.includes(s));
    return qOk && sOk;
  }).map((row) => ({ ...row, score: scoreDeal(row, query, stores) }));

  const finalRows = (filtered.length ? filtered : rows.map((row) => ({ ...row, score: scoreDeal(row, query, stores) })))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 24);

  return finalRows;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    send(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (url.pathname === '/' || url.pathname === '/health') {
    send(res, 200, {
      ok: true,
      service: 'grocery-deals-proxy',
      host: HOST,
      port: PORT,
      updatedAt: new Date().toISOString(),
      endpoints: ['/health', '/grocery/deals?q=chicken&stores=Walmart,Smith\'s/Kroger'],
    });
    return;
  }

  if (url.pathname === '/grocery/deals') {
    const query = url.searchParams.get('q') || '';
    const stores = (url.searchParams.get('stores') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const deals = filterDeals(loadSeedDeals(), query, stores);
    send(res, 200, {
      updatedAt: new Date().toISOString(),
      stores,
      query,
      deals,
    });
    return;
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[grocery-proxy] listening on http://${HOST}:${PORT}`);
});
