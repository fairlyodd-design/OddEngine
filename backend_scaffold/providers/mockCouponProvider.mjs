import { filterDeals } from './base.mjs';

const mockRows = [
  {
    id: 'mock-prep-001',
    title: 'Meal prep protein sale + digital coupon',
    link: 'https://example.local/mock/protein',
    source: 'Mock Weekly Ad',
    store: 'Walmart',
    publishedAt: new Date().toISOString().slice(0, 10),
    summary: 'Chicken, rice, and frozen veg stack for cheap-week baskets.',
    score: 84,
  },
  {
    id: 'mock-produce-001',
    title: 'Produce power week: onions, peppers, potatoes',
    link: 'https://example.local/mock/produce',
    source: 'Mock Weekly Ad',
    store: "Smith's/Kroger",
    publishedAt: new Date().toISOString().slice(0, 10),
    summary: 'High-flexibility produce for meal prep and dinner stretch.',
    score: 79,
  },
  {
    id: 'mock-bogo-001',
    title: 'BOGO yogurt multipack + app reward',
    link: 'https://example.local/mock/yogurt',
    source: 'Mock Rewards',
    store: 'Albertsons',
    publishedAt: new Date().toISOString().slice(0, 10),
    summary: 'Good snack lane if basket is already under goal.',
    score: 71,
  },
  {
    id: 'mock-bulk-001',
    title: 'Bulk pantry saver: pasta + sauce + beans',
    link: 'https://example.local/mock/bulk',
    source: 'Mock Pantry Lane',
    store: 'Costco',
    publishedAt: new Date().toISOString().slice(0, 10),
    summary: 'Staple restock lane with strong pantry coverage upside.',
    score: 77,
  }
];

export const mockCouponProvider = {
  id: 'mock-coupons',
  label: 'Mock coupon engine',
  kind: 'mock',
  async getDeals({ query = '', stores = [] } = {}) {
    return {
      provider: 'mock-coupons',
      updatedAt: new Date().toISOString(),
      stores,
      query,
      deals: filterDeals(mockRows, query, stores),
    };
  },
};
