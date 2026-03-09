import { seedProvider } from './seedProvider.mjs';
import { mockCouponProvider } from './mockCouponProvider.mjs';
import { walmartStarterProvider } from './walmartStarterProvider.mjs';
import { smithsStarterProvider } from './smithsStarterProvider.mjs';
import { albertsonsStarterProvider } from './albertsonsStarterProvider.mjs';
import { costcoStarterProvider } from './costcoStarterProvider.mjs';
import { targetStarterProvider } from './targetStarterProvider.mjs';

export const PROVIDERS = [
  seedProvider,
  mockCouponProvider,
  walmartStarterProvider,
  smithsStarterProvider,
  albertsonsStarterProvider,
  costcoStarterProvider,
  targetStarterProvider,
];

export function listProviders() {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    kind: p.kind,
    stores: p.stores || [],
    description: p.description || '',
  }));
}

export function getProvider(providerId = '') {
  const wanted = String(providerId || process.env.GROCERY_PROXY_PROVIDER || 'seed').trim();
  return PROVIDERS.find((p) => p.id === wanted) || seedProvider;
}
