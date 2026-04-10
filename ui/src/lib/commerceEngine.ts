import { loadJSON, saveJSON } from "./storage";
import { listOutcomes } from "./outcomeTracker";
import { listPublisherJobs } from "./publisherEngine";
import { hasSecret } from "./secretsVault";

export type CommerceProductType = "bundle" | "course" | "printable" | "download" | "subscription" | "affiliate";
export type CommercePlatform = "gumroad" | "stripe" | "etsy" | "local";
export type CommerceListingStatus = "draft" | "queued" | "published" | "failed";

export type CommerceListing = {
  id: string;
  sourceId?: string;
  title: string;
  productType: CommerceProductType;
  platform: CommercePlatform;
  status: CommerceListingStatus;
  createdAt: number;
  updatedAt: number;
  price: number;
  url?: string;
  notes?: string;
  payload?: any;
  logs: string[];
};

const KEY = "oddengine:commerce:listings:v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function slug(v: string) {
  return String(v || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

export function listCommerceListings(): CommerceListing[] {
  return loadJSON<CommerceListing[]>(KEY, []).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

export function saveCommerceListing(listing: CommerceListing) {
  const next = [listing, ...listCommerceListings().filter((x) => x.id !== listing.id)].slice(0, 500);
  saveJSON(KEY, next);
  return listing;
}

export function createCommerceListing(input: Partial<CommerceListing> & { title: string; platform?: CommercePlatform; productType?: CommerceProductType }) {
  const platform = (input.platform || "gumroad") as CommercePlatform;
  const listing: CommerceListing = {
    id: uid(),
    sourceId: String(input.sourceId || ""),
    title: String(input.title || "Untitled product"),
    productType: (input.productType || "download") as CommerceProductType,
    platform,
    status: platform === "local" || hasSecret(platform) ? "queued" : "draft",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    price: Number(input.price || 9),
    url: String(input.url || ""),
    notes: String(input.notes || ""),
    payload: input.payload || null,
    logs: ["listing drafted from winner"],
  };
  return saveCommerceListing(listing);
}

export function publishCommerceListing(id: string) {
  const listing = listCommerceListings().find((x) => x.id === id);
  if (!listing) return null;
  const ok = listing.platform === "local" || hasSecret(listing.platform) || ["gumroad", "stripe", "etsy"].includes(listing.platform);
  return saveCommerceListing({
    ...listing,
    status: ok ? "published" : "draft",
    updatedAt: Date.now(),
    url: ok ? `oddengine://${listing.platform}/listing/${slug(listing.title)}-${listing.id.slice(0, 6)}` : "",
    logs: [`${new Date().toISOString()} ${ok ? "listing published" : "missing platform secret"}`, ...(listing.logs || [])].slice(0, 100),
  });
}

function topOutcome() {
  return listOutcomes().sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0) || Number(b.roi || 0) - Number(a.roi || 0))[0] || null;
}

export function autoDraftListingsFromWinners() {
  const drafted: CommerceListing[] = [];
  const existing = listCommerceListings();
  const winner = topOutcome();
  const latestPublished = listPublisherJobs().find((job) => (job.targets || []).some((t) => t.status === "published"));
  const sourceTitle = winner?.title || latestPublished?.sourceTitle || "Revenue pack";
  const sourceId = winner?.id || latestPublished?.id || "";

  const plans: Array<{ productType: CommerceProductType; platform: CommercePlatform; price: number; notes: string }> = [
    { productType: "bundle", platform: "gumroad", price: 19, notes: "Bundle pack auto-generated from current winner." },
    { productType: "download", platform: "gumroad", price: 9, notes: "Quick digital download version for fast cashflow." },
    { productType: "subscription", platform: "stripe", price: 12, notes: "Recurring membership cadence generated from current winner." },
    { productType: "printable", platform: "etsy", price: 7, notes: "Printable version for marketplace listing." },
  ];

  for (const plan of plans) {
    const title = `${sourceTitle} ${plan.productType === "subscription" ? "Club" : plan.productType === "bundle" ? "Bundle" : plan.productType === "printable" ? "Printable" : "Pack"}`;
    if (existing.find((x) => x.sourceId === sourceId && x.productType === plan.productType && x.platform === plan.platform)) continue;
    drafted.push(createCommerceListing({
      sourceId,
      title,
      productType: plan.productType,
      platform: plan.platform,
      price: plan.price,
      notes: plan.notes,
      payload: { winner, latestPublished },
    }));
  }
  return drafted;
}
