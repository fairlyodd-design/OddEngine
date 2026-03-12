export type GroceryFeedItem = {
  title: string;
  summary?: string;
  link?: string;
  source?: string;
  publishedAt?: string;
  score?: number;
};

export type GroceryProxyDeal = {
  title: string;
  summary?: string;
  link?: string;
  source?: string;
  publishedAt?: string;
  score?: number;
};

export type FulfillmentMode = "pickup" | "delivery" | "either";

export type GroceryCompletionInput = {
  groceryList: string[];
  preferredStores: string[];
  couponFeed: GroceryFeedItem[];
  proxyDeals?: GroceryProxyDeal[];
  zipCode?: string;
  fulfillmentMode?: FulfillmentMode;
  basketGoal?: string;
  pantry?: string;
};

export type GroceryMatchRow = {
  item: string;
  matchedTitle: string;
  matchedStore: string;
  score: number;
  link?: string;
  source?: string;
  savingsHint: string;
};

export type GroceryCompletionOutput = {
  matchedDeals: GroceryMatchRow[];
  couponMatches: string[];
  dealHunterNote: string;
  missingItems: string[];
  storePlan: string[];
};

const STORE_OPTIONS = ["Walmart", "Smith's/Kroger", "Albertsons/Vons", "Costco", "Target", "Sam's Club", "Amazon Fresh"];

function normalize(text: string) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function inferStore(hay: string, preferredStores: string[]) {
  const known = Array.from(new Set([...(preferredStores || []), ...STORE_OPTIONS]));
  for (const store of known) {
    const low = normalize(store);
    if (hay.includes(low)) return store;
    if ((low.includes("smith") || low.includes("kroger")) && (hay.includes("smith") || hay.includes("kroger"))) return "Smith's/Kroger";
    if ((low.includes("albertsons") || low.includes("vons")) && (hay.includes("albertsons") || hay.includes("vons"))) return "Albertsons/Vons";
  }
  return preferredStores[0] || STORE_OPTIONS[0];
}

function scoreDealForItem(item: string, feedItem: GroceryFeedItem | GroceryProxyDeal, preferredStores: string[]) {
  const hay = normalize(`${feedItem.title} ${feedItem.summary || ""} ${feedItem.source || ""}`);
  const needle = normalize(item);
  let score = 20;
  const words = needle.split(" ").filter(Boolean);
  const wordHits = words.filter((w) => hay.includes(w));
  score += wordHits.length * 18;
  if (hay.includes(needle)) score += 20;
  if (preferredStores.some((store) => hay.includes(normalize(store)))) score += 8;
  if (["coupon", "digital", "bogo", "cash back", "save", "clearance", "weekly ad", "deal"].some((t) => hay.includes(t))) score += 10;
  if (["chips", "candy", "soda"].some((t) => hay.includes(t)) && !hay.includes(needle)) score -= 6;
  return Math.max(0, Math.min(99, score));
}

function savingsHint(feedItem: GroceryFeedItem | GroceryProxyDeal) {
  const hay = normalize(`${feedItem.title} ${feedItem.summary || ""}`);
  if (hay.includes("bogo")) return "BOGO / stock-up lane";
  if (hay.includes("cash back")) return "cash-back angle";
  if (hay.includes("digital")) return "digital coupon lane";
  if (hay.includes("clearance")) return "clearance lane";
  if (hay.includes("weekly ad")) return "weekly ad lane";
  return "coupon/deal angle";
}

export function buildShoppingListDealMatches(input: GroceryCompletionInput): GroceryCompletionOutput {
  const feed = [...(input.proxyDeals || []), ...(input.couponFeed || [])];
  const preferredStores = input.preferredStores?.length ? input.preferredStores : ["Walmart", "Smith's/Kroger"];
  const groceryList = (input.groceryList || []).filter(Boolean);

  const matchedDeals: GroceryMatchRow[] = groceryList.map((item) => {
    const ranked = feed
      .map((deal) => ({
        deal,
        score: scoreDealForItem(item, deal, preferredStores),
      }))
      .filter((row) => row.score >= 42)
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best) {
      return {
        item,
        matchedTitle: "No strong deal hit yet",
        matchedStore: preferredStores[0] || "Walmart",
        score: 0,
        source: "",
        savingsHint: "refresh proxy + coupon lane",
      };
    }

    const hay = normalize(`${best.deal.title} ${best.deal.summary || ""} ${best.deal.source || ""}`);
    return {
      item,
      matchedTitle: best.deal.title,
      matchedStore: inferStore(hay, preferredStores),
      score: best.score,
      link: best.deal.link,
      source: best.deal.source,
      savingsHint: savingsHint(best.deal),
    };
  });

  const strongMatches = matchedDeals.filter((row) => row.score >= 42);
  const missingItems = matchedDeals.filter((row) => row.score < 42).map((row) => row.item);

  const couponMatches = strongMatches.map(
    (row) => `${row.item} → ${row.matchedStore} • ${row.matchedTitle} (${row.savingsHint})`
  );

  const storePlanMap = new Map<string, string[]>();
  for (const row of strongMatches) {
    if (!storePlanMap.has(row.matchedStore)) storePlanMap.set(row.matchedStore, []);
    storePlanMap.get(row.matchedStore)!.push(row.item);
  }

  const storePlan = Array.from(storePlanMap.entries()).map(
    ([store, items]) => `${store}: hit ${items.slice(0, 6).join(", ")}`
  );

  const dealHunterNote = [
    `ZIP ${input.zipCode || "00000"} • ${input.fulfillmentMode || "either"} mode • basket target ${input.basketGoal || "not set"}.`,
    strongMatches.length
      ? `Found ${strongMatches.length} shopping-list-linked deal hits. Prioritize ${strongMatches[0].matchedStore} first.`
      : "No strong shopping-list-linked deals yet. Refresh the local proxy lane and coupon feed.",
    missingItems.length
      ? `Still missing strong matches for: ${missingItems.slice(0, 6).join(", ")}.`
      : "Every current list item has at least one viable deal/coupon angle.",
  ].join(" ");

  return {
    matchedDeals,
    couponMatches,
    dealHunterNote,
    missingItems,
    storePlan: storePlan.length ? storePlan : [`${preferredStores[0] || "Walmart"}: run core staples first`],
  };
}
