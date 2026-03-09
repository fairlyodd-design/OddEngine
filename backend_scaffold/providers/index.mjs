import { seedProvider } from './seedProvider.mjs';
import { mockCouponProvider } from './mockCouponProvider.mjs';

export const PROVIDERS = [seedProvider, mockCouponProvider];

export function listProviders() {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    kind: p.kind,
  }));
}

export function getProvider(providerId = '') {
  const wanted = String(providerId || process.env.GROCERY_PROXY_PROVIDER || 'seed').trim();
  return PROVIDERS.find((p) => p.id === wanted) || seedProvider;
}
