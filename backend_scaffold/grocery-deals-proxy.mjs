import http from 'node:http';
import { getProvider, listProviders } from './providers/index.mjs';

const PORT = Number(process.env.GROCERY_PROXY_PORT || process.env.PORT || 8787);
const HOST = process.env.GROCERY_PROXY_HOST || '127.0.0.1';
const CORS_ORIGIN = process.env.GROCERY_PROXY_CORS_ORIGIN || '*';

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

const server = http.createServer(async (req, res) => {
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
      defaultProvider: process.env.GROCERY_PROXY_PROVIDER || 'seed',
      providers: listProviders(),
      updatedAt: new Date().toISOString(),
      endpoints: [
        '/health',
        '/providers',
        '/grocery/deals?q=chicken&stores=Walmart,Smith\'s/Kroger&provider=seed'
      ],
    });
    return;
  }

  if (url.pathname === '/providers') {
    send(res, 200, {
      ok: true,
      providers: listProviders(),
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  if (url.pathname === '/grocery/deals') {
    const query = url.searchParams.get('q') || '';
    const stores = (url.searchParams.get('stores') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const providerId = url.searchParams.get('provider') || '';
    const provider = getProvider(providerId);
    try {
      const payload = await provider.getDeals({ query, stores, providerId });
      send(res, 200, {
        ...payload,
        provider: provider.id,
        providerLabel: provider.label,
      });
      return;
    } catch (err) {
      console.error('[grocery-proxy] provider failure:', err);
      send(res, 500, {
        error: 'Provider failed',
        provider: provider.id,
        message: err?.message || String(err),
      });
      return;
    }
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[grocery-proxy] listening on http://${HOST}:${PORT}`);
  console.log(`[grocery-proxy] default provider: ${process.env.GROCERY_PROXY_PROVIDER || 'seed'}`);
});
