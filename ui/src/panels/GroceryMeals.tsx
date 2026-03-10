import React, { useEffect, useMemo, useState } from "react";
import { acknowledgePanelAction, getPanelActions, PANEL_ACTION_EVENT } from "../lib/brain";
import { loadJSON, saveJSON } from "../lib/storage";
import { pushNotif } from "../lib/notifs";
import { DEFAULT_COUPON_LINKS, FeedItem, fetchNewsFeed, openExternalLink } from "../lib/webData";
import { GroceryProxyProvider, fetchGroceryProxyDeals, fetchGroceryProxyProviders } from "../lib/groceryDealsProxy";
import PluginMiniWidgets from "../components/PluginMiniWidgets";
import { UPGRADE_PACKS_EVENT, isUpgradePackInstalled } from "../lib/plugins";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import { addQuickEvent, fmtDate } from "../lib/calendarStore";

type MealPlan = { day: string; breakfast: string; lunch: string; dinner: string; snacks: string };
type FulfillmentMode = "pickup" | "delivery" | "either";

type GroceryState = {
  pantry: string;
  dietaryTags: string;
  meals: MealPlan[];
  groceryList: string[];
  couponFeed: FeedItem[];
  cheapWeekMode: boolean;
  preferredStores: string[];
  couponMatches: string[];
  priceBook: Record<string, number>;
  storePlan: string[];
  basketGoal: string;
  prepPlan: string;
  aiDealNote: string;
  dealSourceMode: "rss" | "local-proxy";
  proxyBaseUrl: string;
  proxyQuery: string;
  proxyStatus: string;
  proxyProviderId: string;
  proxyProviders: GroceryProxyProvider[];
  zipCode: string;
  fulfillmentMode: FulfillmentMode;
  lastUpdated?: number;
  lastError?: string;
};

const KEY = "oddengine:groceryMeals:v1";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STORE_OPTIONS = ["Walmart", "Smith's/Kroger", "Albertsons/Vons", "Costco", "Target", "Sam's Club", "Amazon Fresh"];
const defaultState: GroceryState = {
  pantry: `rice
eggs
frozen vegetables`,
  dietaryTags: "",
  meals: DAYS.map((day) => ({ day, breakfast: "", lunch: "", dinner: "", snacks: "" })),
  groceryList: [],
  couponFeed: [],
  cheapWeekMode: false,
  preferredStores: ["Walmart", "Smith's/Kroger"],
  couponMatches: [],
  priceBook: {},
  storePlan: [],
  basketGoal: "$125 family week",
  prepPlan: "Batch protein, wash fruit, chop veg, portion snacks, and cook one flexible carb for the week.",
  aiDealNote: "",
  dealSourceMode: "rss",
  proxyBaseUrl: "http://127.0.0.1:8787",
  proxyQuery: "grocery coupons weekly ad produce protein pantry",
  proxyStatus: "Proxy idle",
  proxyProviderId: "seed",
  proxyProviders: [],
  zipCode: "89121",
  fulfillmentMode: "either",
};

function normalizeItems(text: string) {
  return text.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

const CHEAP_WEEK_TEMPLATE = [
  { breakfast: "oatmeal, bananas", lunch: "bean burritos, salsa", dinner: "rice, eggs, frozen vegetables", snacks: "apples, peanut butter" },
  { breakfast: "toast, eggs", lunch: "tuna sandwiches", dinner: "pasta, marinara, frozen broccoli", snacks: "yogurt, carrots" },
  { breakfast: "overnight oats", lunch: "leftover pasta", dinner: "chicken thighs, rice, mixed veg", snacks: "popcorn" },
  { breakfast: "scrambled eggs, toast", lunch: "quesadillas", dinner: "potatoes, beans, salad", snacks: "apples" },
  { breakfast: "oatmeal, raisins", lunch: "turkey wraps", dinner: "slow-cooker chili", snacks: "crackers, cheese" },
  { breakfast: "pancakes", lunch: "leftover chili", dinner: "sheet-pan sausage, potatoes, onions", snacks: "fruit cups" },
  { breakfast: "eggs, toast", lunch: "grilled cheese, soup", dinner: "fried rice using leftovers", snacks: "banana, yogurt" },
];

function estimateItemPrice(item: string) {
  const text = item.toLowerCase();
  if (["chicken", "beef", "sausage", "turkey", "fish"].some((t) => text.includes(t))) return 6.5;
  if (["eggs", "milk", "yogurt", "cheese"].some((t) => text.includes(t))) return 4.2;
  if (["rice", "beans", "oatmeal", "bread", "pasta", "potatoes"].some((t) => text.includes(t))) return 2.5;
  if (["berries", "banana", "apple", "fruit", "vegetable", "broccoli", "carrots", "salad"].some((t) => text.includes(t))) return 3.1;
  if (["snack", "chips", "crackers", "juice"].some((t) => text.includes(t))) return 3.9;
  return 4.0;
}

function sumPriceBook(items: string[], priceBook: Record<string, number>) {
  return items.reduce((sum, item) => sum + Number(priceBook[item] || estimateItemPrice(item) || 0), 0);
}

function buildStorePlanText(preferredStores: string[], cheapWeekMode: boolean, couponMatches: string[]) {
  const stores = preferredStores.length ? preferredStores : ["Walmart", "Smith's/Kroger"];
  const primary = stores[0];
  const notes = [`Primary run: ${primary} for staple items and pantry refills.`];
  if (stores[1]) notes.push(`Second stop: ${stores[1]} only if ad-match, produce, or meat pricing beats the primary lane.`);
  if (cheapWeekMode) notes.push("Cheap-week mode is on, so push staples, frozen veg, eggs, beans, rice, oats, and overlap ingredients.");
  if (couponMatches.length) notes.push(`Coupon lane found ${couponMatches.length} likely matches. Check them before checkout.`);
  if (!couponMatches.length) notes.push("Refresh the coupon lane before shopping so the route can pivot to live deals.");
  return notes;
}

function buildCouponGodMode(base: GroceryState) {
  const best = base.couponMatches[0] || base.couponFeed[0]?.title || "Refresh the coupon lane";
  const target = base.basketGoal || "$125 family week";
  const stores = (base.preferredStores || []).slice(0, 2).join(" → ") || "Walmart → Smith's/Kroger";
  const listHot = (base.groceryList || []).slice(0, 5).join(", ") || "rice, eggs, frozen vegetables";
  return [
    "# Coupon GodMode",
    "",
    `Basket goal: ${target}`,
    `Store route: ${stores}`,
    `Best current deal: ${best}`,
    `High-priority items: ${listHot}`,
    "",
    "## Attack plan",
    "1. Lock staple items first and skip impulse add-ons until the basket is under goal.",
    "2. Route produce/meat only through the second store if the deal lane beats the primary stop.",
    "3. Batch prep proteins + snacks the same day so deals turn into real savings instead of spoilage.",
    "4. Use pantry overlap and one flex carb to stretch the whole run.",
  ].join("\n");
}

function scoreDeal(item: FeedItem, groceryList: string[], preferredStores: string[]) {
  const hay = `${item.title} ${item.summary || ""}`.toLowerCase();
  let score = 30;
  const hits = groceryList.filter((entry) => hay.includes(entry.toLowerCase()));
  score += hits.length * 18;
  if (preferredStores.some((store) => hay.includes(store.toLowerCase().replace(/[^a-z]/g, "")) || hay.includes(store.toLowerCase()))) score += 8;
  if (["coupon", "cash back", "bogo", "free", "clearance", "digital"].some((tag) => hay.includes(tag))) score += 10;
  if (["snack", "chips", "candy", "soda"].some((tag) => hay.includes(tag))) score -= 6;
  return Math.max(0, Math.min(99, score));
}

function inferDealStore(item: FeedItem, preferredStores: string[]) {
  const hay = `${item.title} ${item.summary || ""} ${item.source || ""}`.toLowerCase();
  const known = Array.from(new Set([...(preferredStores || []), ...STORE_OPTIONS]));
  for (const store of known) {
    const low = store.toLowerCase();
    const flat = low.replace(/[^a-z0-9]+/g, "");
    if (hay.includes(low) || (flat && hay.includes(flat))) return store;
    if (low.includes("smith") && (hay.includes("smith") || hay.includes("kroger"))) return "Smith's/Kroger";
    if ((low.includes("albertsons") || low.includes("vons")) && (hay.includes("albertsons") || hay.includes("vons"))) return "Albertsons/Vons";
  }
  return preferredStores[0] || STORE_OPTIONS[0];
}



type BasketCompareRow = {
  store: string;
  lane: string;
  basketScore: number;
  estimatedTotal: number;
  savingsAngle: string;
  orderNote: string;
  posture: "good" | "warn" | "bad" | "";
};

function estimateFulfillmentFee(store: string, mode: FulfillmentMode) {
  const low = store.toLowerCase();
  if (mode === "pickup") return 0;
  if (low.includes("sam")) return 0;
  if (low.includes("amazon")) return 6.99;
  if (low.includes("walmart")) return 6.97;
  if (low.includes("smith") || low.includes("kroger")) return 4.95;
  if (low.includes("albertsons") || low.includes("vons")) return 5.95;
  if (low.includes("costco")) return 0;
  return mode === "delivery" ? 5.99 : 0;
}

function buildBasketCompareRows(base: GroceryState, stackRows: StoreStackRow[], targetNumber: number, estimatedListCost: number): BasketCompareRow[] {
  const stores = stackRows.length ? stackRows.map((row) => row.store) : (base.preferredStores.length ? base.preferredStores : ["Smith's/Kroger", "Walmart", "Sam's Club"]);
  return stores.slice(0, 6).map((store, idx) => {
    const lane = base.fulfillmentMode === "either" ? (idx % 2 === 0 ? "pickup" : "delivery") : base.fulfillmentMode;
    const fee = estimateFulfillmentFee(store, lane as FulfillmentMode);
    const stack = stackRows.find((row) => row.store === store);
    const discount = Math.max(4, Math.min(28, ((stack?.score || 36) * 0.16) + (base.couponMatches.length * 0.9) - fee));
    const total = Math.max(12, estimatedListCost - discount + fee);
    const basketScore = Math.max(0, Math.min(99, Math.round((stack?.score || 32) + (targetNumber && total <= targetNumber ? 10 : 0) - (fee > 0 ? 4 : 0))));
    const savingsAngle = total <= estimatedListCost ? `Save about $${Math.max(1, Math.round(estimatedListCost - total))}` : `Convenience tax about $${Math.max(1, Math.round(total - estimatedListCost))}`;
    const orderNote = lane === "pickup" ? `Best if you want lower fees and a tighter basket shield at ${store}.` : `Use delivery only if the time saved beats the extra cost from ${store}.`;
    const posture = total <= estimatedListCost * 0.92 ? "good" : total <= estimatedListCost * 1.03 ? "warn" : "bad";
    return { store, lane, basketScore, estimatedTotal: Number(total.toFixed(2)), savingsAngle, orderNote, posture };
  }).sort((a,b) => a.estimatedTotal - b.estimatedTotal || b.basketScore - a.basketScore);
}
type StoreStackRow = {
  store: string;
  score: number;
  hits: number;
  bestTitle: string;
  stopValue: string;
};

function buildStoreStackRows(feed: FeedItem[], groceryList: string[], preferredStores: string[]): StoreStackRow[] {
  const stores = Array.from(new Set([...(preferredStores || []), ...STORE_OPTIONS]));
  const rows = stores.map((store) => {
    const ranked = feed
      .map((item) => ({ item, score: scoreDeal(item, groceryList, preferredStores) }))
      .filter(({ item }) => inferDealStore(item, preferredStores) === store)
      .sort((a, b) => b.score - a.score);
    const top = ranked[0];
    const score = ranked.slice(0, 3).reduce((sum, row) => sum + row.score, 0);
    const hits = ranked.length;
    const stopValue = hits >= 3 ? "Heavy stop" : hits >= 1 ? "Quick hit" : "Skip unless needed";
    return {
      store,
      score,
      hits,
      bestTitle: top?.item.title || "No strong hit yet",
      stopValue,
    };
  });
  return rows
    .sort((a, b) => b.score - a.score)
    .filter((row) => row.hits > 0 || preferredStores.includes(row.store))
    .slice(0, 5);
}


function buildPantryIntelligence(items: string[], list: string[], preferredStores: string[], zipCode: string, fulfillmentMode: FulfillmentMode) {
  const pantry = items.map((i) => i.toLowerCase());
  const protein = pantry.filter((i) => /chicken|beef|turkey|eggs|beans|fish|sausage/.test(i)).length;
  const produce = pantry.filter((i) => /fruit|banana|apple|berries|carrot|broccoli|vegetable|salad/.test(i)).length;
  const staples = pantry.filter((i) => /rice|beans|oat|bread|pasta|potato/.test(i)).length;
  const weakLane = list[0] || 'protein + produce';
  const route = preferredStores.slice(0, 2).join(' → ') || "Smith's/Kroger → Walmart";
  return [
    `ZIP ${zipCode} • ${fulfillmentMode === 'either' ? 'pickup or delivery' : fulfillmentMode} mode`,
    `Staple base: ${staples} pantry anchors • protein lane ${protein} • produce lane ${produce}.`,
    `Weakest lane to refill next: ${weakLane}.`,
    `Best current route: ${route}.`,
  ];
}

function buildPriceMemoryRows(groceryList: string[], priceBook: Record<string, number>) {
  return groceryList.slice(0, 8).map((item) => ({
    item,
    remembered: Number((priceBook[item] || estimateItemPrice(item)).toFixed(2)),
    posture: (priceBook[item] || estimateItemPrice(item)) <= 3.5 ? 'green' : (priceBook[item] || estimateItemPrice(item)) <= 5.5 ? 'watch' : 'expensive',
  }));
}

function buildVegasDealCommand(zipCode: string, fulfillmentMode: FulfillmentMode, preferredStores: string[]) {
  const lane = fulfillmentMode === 'delivery' ? 'delivery' : fulfillmentMode === 'pickup' ? 'pickup' : 'pickup + delivery';
  const stores = preferredStores.slice(0, 3).join(' • ');
  return `Las Vegas ${zipCode} ${lane} lane armed. Hunt ${stores || "Smith's/Kroger • Sam's Club • Amazon Fresh"} first, then only expand if the second stop beats the main basket shield.`;
}

function buildVegasLiveHunterRows(base: GroceryState, stackRows: StoreStackRow[]) {
  const stores = new Map<string, { status: string; note: string; tone: 'good' | 'warn' | 'bad' | '' }>();
  const zip = base.zipCode || '89121';
  const lane = base.fulfillmentMode === 'delivery' ? 'Delivery' : base.fulfillmentMode === 'pickup' ? 'Pickup' : 'Pickup + delivery';
  stores.set("Smith's/Kroger", {
    status: 'Weekly ad + digital coupons',
    note: `Best for ad-matching in ${zip}. Prioritize digital deals and pickup timing first.`,
    tone: 'good',
  });
  stores.set('Walmart', {
    status: lane.includes('Pickup') ? 'Strong pickup anchor' : 'Delivery-friendly anchor',
    note: `Use as the main basket shield when the run needs one-store simplicity in ${zip}.`,
    tone: 'good',
  });
  stores.set("Sam's Club", {
    status: 'Bulk + curbside angle',
    note: 'Use when proteins, pantry staples, paper goods, or drinks justify the membership-size stop.',
    tone: 'warn',
  });
  stores.set('Amazon Fresh', {
    status: base.fulfillmentMode === 'pickup' ? 'Delivery-leaning lane' : 'Digital convenience lane',
    note: 'Treat as a convenience/value check, especially when you need same-day style flexibility.',
    tone: '',
  });
  stores.set('Albertsons/Vons', {
    status: 'Coupon swing lane',
    note: 'Best as a second-stop lane when meat/produce or app deals beat the primary route.',
    tone: '',
  });
  return stackRows.slice(0, 5).map((row, idx) => {
    const preset = stores.get(row.store) || { status: 'Watch lane', note: 'Use only if the board score justifies the stop.', tone: '' as const };
    return {
      store: row.store,
      rank: idx + 1,
      status: preset.status,
      note: preset.note,
      tone: preset.tone,
      score: row.score,
      bestTitle: row.bestTitle,
      stopValue: row.stopValue,
    };
  });
}

function buildVegasLiveHunterBrief(base: GroceryState, route: string, stackRows: StoreStackRow[]) {
  const zip = base.zipCode || '89121';
  const lane = base.fulfillmentMode === 'delivery' ? 'delivery only' : base.fulfillmentMode === 'pickup' ? 'pickup only' : 'pickup + delivery';
  const first = stackRows[0]?.store || base.preferredStores[0] || "Smith's/Kroger";
  const second = stackRows[1]?.store || base.preferredStores[1] || 'Walmart';
  return [
    `Las Vegas ${zip} live-deal hunter armed for ${lane}.`,
    `First hit: ${first}.`,
    `Second look: ${second} only if it beats the basket shield.`,
    `Current route: ${route}.`,
  ];
}

function buildTripOptimizer(rows: StoreStackRow[], basketDelta: number, couponMatches: string[], prepFocus: string[]) {
  const steps: string[] = [];
  const first = rows[0];
  const second = rows[1];
  const third = rows[2];
  if (first) steps.push(`Hit ${first.store} first for the strongest stack: ${first.bestTitle}.`);
  if (second) steps.push(`Only do ${second.store} as stop two if it protects the basket better than the primary lane.`);
  if (third) steps.push(`Treat ${third.store} as optional cleanup only if one missing item still beats your main route.`);
  steps.push(couponMatches.length ? `Checkout shield: lock ${couponMatches[0]} before any fun extras hit the basket.` : "Checkout shield: verify one high-value coupon before adding bonus items.");
  steps.push(prepFocus.length ? `Prep shield: ${prepFocus[0]} + ${prepFocus[1] || "portion snacks"} the same day so deals turn into real meals.` : "Prep shield: batch one protein and one carb base right away.");
  steps.push(basketDelta > 0 ? `Budget warning: trim about $${Math.round(Math.abs(basketDelta))} unless the second stop adds a real savings edge.` : "Budget posture: under goal, so bonus buys only happen after the core list is locked.");
  return steps;
}

export default function GroceryMeals({ onNavigate, onOpenHowTo }: { onNavigate?: (id: string) => void; onOpenHowTo?: () => void } = {}) {
  const [state, setState] = useState<GroceryState>(() => ({ ...defaultState, ...loadJSON<GroceryState>(KEY, defaultState) }));
  const [busy, setBusy] = useState(false);
  const [pluginTick, setPluginTick] = useState(0);
  const hasSaverPack = isUpgradePackInstalled("grocery-saver-pack");

  function persist(next: GroceryState) {
    setState(next);
    saveJSON(KEY, next);
  }

  function patchMeal(idx: number, field: keyof MealPlan, value: string) {
    const meals = state.meals.map((meal, i) => i === idx ? { ...meal, [field]: value } : meal);
    persist({ ...state, meals, lastUpdated: Date.now() });
  }

  function buildList(base = state) {
    const pantry = new Set(normalizeItems(base.pantry).map((i) => i.toLowerCase()));
    const raw = base.meals.flatMap((meal) => [meal.breakfast, meal.lunch, meal.dinner, meal.snacks]).flatMap((entry) => normalizeItems(entry));
    const deduped = Array.from(new Set(raw.map((item) => item.trim()).filter(Boolean)));
    const groceryList = deduped.filter((item) => !pantry.has(item.toLowerCase()));
    const priceBook = { ...base.priceBook };
    groceryList.forEach((item) => {
      if (!(item in priceBook)) priceBook[item] = Number(estimateItemPrice(item).toFixed(2));
    });
    const storePlan = buildStorePlanText(base.preferredStores, base.cheapWeekMode, base.couponMatches);
    const next = { ...base, groceryList, priceBook, storePlan, lastUpdated: Date.now() };
    persist(next);
    matchCoupons(next, false);
  }

  async function refreshCoupons() {
    setBusy(true);
    try {
      const couponFeed = await fetchNewsFeed("https://slickdeals.net/newsearch.php?q=grocery&searcharea=deals&searchin=first&rss=1", "Slickdeals Grocery");
      const next = { ...state, couponFeed, proxyStatus: `RSS loaded ${couponFeed.length} deals`, lastUpdated: Date.now(), lastError: "" };
      persist(next);
      matchCoupons(next, false);
    } catch (e: any) {
      persist({ ...state, lastError: e?.message || String(e), proxyStatus: "RSS refresh failed", lastUpdated: Date.now() });
    } finally {
      setBusy(false);
    }
  }

  async function refreshProxyDeals() {
    setBusy(true);
    try {
      const couponFeed = await fetchGroceryProxyDeals(state.proxyBaseUrl, state.proxyQuery, state.preferredStores, state.proxyProviderId);
      const next = { ...state, couponFeed, dealSourceMode: "local-proxy" as const, proxyStatus: `Proxy loaded ${couponFeed.length} deals via ${state.proxyProviderId}`, lastUpdated: Date.now(), lastError: "" };
      persist(next);
      matchCoupons(next, false);
    } catch (e: any) {
      persist({ ...state, lastError: e?.message || String(e), proxyStatus: "Proxy offline / bad response", lastUpdated: Date.now() });
    } finally {
      setBusy(false);
    }
  }

  async function testProxy() {
    setBusy(true);
    try {
      const providers = await fetchGroceryProxyProviders(state.proxyBaseUrl);
      const probe = await fetchGroceryProxyDeals(state.proxyBaseUrl, state.proxyQuery, state.preferredStores, state.proxyProviderId);
      persist({ ...state, proxyProviders: providers, proxyStatus: `Proxy OK • ${probe.length} deals visible`, lastError: "", lastUpdated: Date.now() });
    } catch (e: any) {
      persist({ ...state, proxyStatus: "Proxy offline / bad response", lastError: e?.message || String(e), lastUpdated: Date.now() });
    } finally {
      setBusy(false);
    }
  }

  async function refreshProxyProviders() {
    try {
      const providers = await fetchGroceryProxyProviders(state.proxyBaseUrl);
      if (!providers.length) return;
      const providerStillValid = providers.some((p) => p.id === state.proxyProviderId);
      persist({ ...state, proxyProviders: providers, proxyProviderId: providerStillValid ? state.proxyProviderId : providers[0].id, proxyStatus: `Loaded ${providers.length} providers`, lastUpdated: Date.now() });
    } catch (e: any) {
      persist({ ...state, proxyStatus: "Provider list unavailable", lastError: e?.message || String(e), lastUpdated: Date.now() });
    }
  }

  function runCheapWeek() {
    const meals = DAYS.map((day, idx) => ({ day, ...CHEAP_WEEK_TEMPLATE[idx] }));
    const next = { ...state, meals, cheapWeekMode: true, lastUpdated: Date.now() };
    persist(next);
    window.setTimeout(() => buildList(next), 0);
  }

  function toggleStore(store: string) {
    const preferredStores = state.preferredStores.includes(store)
      ? state.preferredStores.filter((entry) => entry !== store)
      : [...state.preferredStores, store];
    persist({ ...state, preferredStores, storePlan: buildStorePlanText(preferredStores, state.cheapWeekMode, state.couponMatches), lastUpdated: Date.now() });
  }

  function matchCoupons(base = state, push = true) {
    const items = (base.groceryList || []).map((item) => item.toLowerCase());
    const couponMatches = (base.couponFeed || [])
      .filter((deal) => items.some((item) => `${deal.title} ${deal.summary || ""}`.toLowerCase().includes(item)))
      .slice(0, 10)
      .map((deal) => deal.title);
    const next = { ...base, couponMatches, storePlan: buildStorePlanText(base.preferredStores, base.cheapWeekMode, couponMatches), lastUpdated: Date.now() };
    if (push) persist(next); else { setState(next); saveJSON(KEY, next); }
  }

  function estimateBasket() {
    const priceBook = { ...state.priceBook };
    state.groceryList.forEach((item) => {
      if (!(item in priceBook)) priceBook[item] = Number(estimateItemPrice(item).toFixed(2));
    });
    persist({ ...state, priceBook, storePlan: buildStorePlanText(state.preferredStores, state.cheapWeekMode, state.couponMatches), lastUpdated: Date.now() });
  }

  function patchPrice(item: string, value: string) {
    const parsed = Number(value);
    const next = { ...state, priceBook: { ...state.priceBook, [item]: Number.isFinite(parsed) ? parsed : 0 }, lastUpdated: Date.now() };
    persist(next);
  }

  function buildAiDealAssist(base = state) {
    const ranked = [...(base.couponFeed || [])].sort((a, b) => scoreDeal(b, base.groceryList, base.preferredStores) - scoreDeal(a, base.groceryList, base.preferredStores));
    const topDeals = ranked.slice(0, 4).map((d) => `${d.title} (${scoreDeal(d, base.groceryList, base.preferredStores)})`);
    const target = base.basketGoal || "$125 family week";
    const strongest = base.couponMatches.length ? `Strongest direct matches: ${base.couponMatches.slice(0, 3).join(", ")}.` : "No direct matches yet, so lean into pantry overlap, staple swaps, and store timing.";
    const focus = base.groceryList.slice(0, 5).join(", ") || "rice, eggs, frozen vegetables";
    const note = [
      "# AI Deal Assistant",
      "",
      `Basket goal: ${target}.`,
      `Primary store lane: ${base.preferredStores[0] || "Walmart"}.`,
      strongest,
      `Priority items: ${focus}.`,
      topDeals.length ? `Auto deal board: ${topDeals.join(" | ")}` : "Refresh the live deal lane for fresh coupon data.",
      "",
      "## Best move",
      "1. Lock meals that reuse the same proteins + veg.",
      "2. Buy staples first, then only add bonus snacks if the basket stays within goal.",
      "3. Use the cheapest store for pantry refills and only do a second stop if coupon matches justify it.",
      "4. Prep proteins and snacks immediately so the deal stack turns into actual savings.",
    ].join("\n");
    persist({ ...base, aiDealNote: note, lastUpdated: Date.now() });
  }

  useEffect(() => { if (!state.couponFeed.length) refreshCoupons(); }, []);

  useEffect(() => { if (state.dealSourceMode === "local-proxy") refreshProxyProviders(); }, [state.dealSourceMode, state.proxyBaseUrl]);

  useEffect(() => {
    const pluginHandler = () => setPluginTick((v) => v + 1);
    window.addEventListener(UPGRADE_PACKS_EVENT, pluginHandler as EventListener);
    return () => window.removeEventListener(UPGRADE_PACKS_EVENT, pluginHandler as EventListener);
  }, []);

  useEffect(() => {
    const handler = () => {
      for (const action of getPanelActions("GroceryMeals")) {
        if (action.actionId === "grocery:build-list") buildList();
        if (action.actionId === "grocery:coupon-lane") refreshCoupons();
        if (action.actionId === "grocery:proxy-lane") refreshProxyDeals();
        if (action.actionId === "grocery:test-proxy") testProxy();
        if (action.actionId === "grocery:cheap-week") runCheapWeek();
        if (action.actionId === "grocery:match-coupons") matchCoupons();
        if (action.actionId === "grocery:estimate-basket") estimateBasket();
        if (action.actionId === "grocery:store-plan") persist({ ...state, storePlan: buildStorePlanText(state.preferredStores, state.cheapWeekMode, state.couponMatches), lastUpdated: Date.now() });
        if (action.actionId === "grocery:deal-assist") buildAiDealAssist();
        acknowledgePanelAction(action.id);
      }
    };
    handler();
    window.addEventListener(PANEL_ACTION_EVENT, handler as EventListener);
    return () => window.removeEventListener(PANEL_ACTION_EVENT, handler as EventListener);
  }, [state, hasSaverPack, pluginTick]);

  const pantryCount = useMemo(() => normalizeItems(state.pantry).length, [state.pantry]);
  const estimatedListCost = useMemo(() => sumPriceBook(state.groceryList, state.priceBook), [state.groceryList, state.priceBook]);
  const targetNumber = useMemo(() => Number(String(state.basketGoal).replace(/[^0-9.]/g, "")) || 0, [state.basketGoal]);
  const budgetDelta = targetNumber ? estimatedListCost - targetNumber : 0;
  const pantryCoverage = useMemo(() => {
    const raw = state.meals.flatMap((meal) => [meal.breakfast, meal.lunch, meal.dinner, meal.snacks]).flatMap((entry) => normalizeItems(entry));
    const deduped = Array.from(new Set(raw.map((item) => item.trim()).filter(Boolean)));
    if (!deduped.length) return 0;
    return Math.round(((deduped.length - state.groceryList.length) / deduped.length) * 100);
  }, [state.meals, state.groceryList]);

  const prepFocus = useMemo(() => normalizeItems(state.prepPlan).slice(0, 6), [state.prepPlan]);
  const primaryStore = state.preferredStores[0] || "Walmart";
  const couponPosture = state.couponMatches.length ? "Deals matched" : state.couponFeed.length ? "Deals loaded" : "Need refresh";
  const bestDealHeadline = state.couponMatches[0] || state.couponFeed[0]?.title || "Refresh the coupon lane";
  const couponStackScore = Math.min(99, state.couponMatches.length * 15 + state.couponFeed.length * 2 + (state.cheapWeekMode ? 8 : 0));
  const leakRisk = Math.max(0, Math.round((budgetDelta > 0 ? budgetDelta : 0) + (prepFocus.length ? 0 : 14)));
  const topNeed = state.groceryList[0] || "Build your list";
  const hottestLane = state.couponMatches.length ? "Coupon hunter" : state.cheapWeekMode ? "Cheap week" : "Meal prep";
  const autoDealBoard = useMemo(() => {
    return [...state.couponFeed]
      .map((item) => ({ item, score: scoreDeal(item, state.groceryList, state.preferredStores) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [state.couponFeed, state.groceryList, state.preferredStores]);

  const storeStackRows = useMemo(() => buildStoreStackRows(state.couponFeed, state.groceryList, state.preferredStores), [state.couponFeed, state.groceryList, state.preferredStores]);
  const tripOptimizerSteps = useMemo(() => buildTripOptimizer(storeStackRows, budgetDelta, state.couponMatches, prepFocus), [storeStackRows, budgetDelta, state.couponMatches, prepFocus]);
  const bestTripRoute = storeStackRows.slice(0, 3).map((row) => row.store).join(" → ") || primaryStore;
  const totalAutoDealScore = autoDealBoard.reduce((sum, row) => sum + row.score, 0);
  const pantryIntel = buildPantryIntelligence(normalizeItems(state.pantry), state.groceryList, state.preferredStores, state.zipCode, state.fulfillmentMode);
  const priceMemoryRows = buildPriceMemoryRows(state.groceryList, state.priceBook);
  const vegasDealCommand = buildVegasDealCommand(state.zipCode, state.fulfillmentMode, state.preferredStores);
  const warRoomSavings = Math.max(0, Math.round((state.couponMatches.length * 4.5) + (couponStackScore * 0.35) + (targetNumber ? Math.max(0, targetNumber - estimatedListCost) * 0.2 : 0)));
  const groceryWarMode = warRoomSavings >= 25 ? "CRUSHING IT" : warRoomSavings >= 12 ? "STACKING SAVINGS" : "BUILD MORE STACKS";
  const cheapestHit = autoDealBoard[0]?.item?.title || state.couponMatches[0] || "Scan the deal board";
  const basketShield = budgetDelta <= 0 ? "Budget shield up" : `Trim ${Math.ceil(Math.abs(budgetDelta))} more`;
  const warRoomPlaybook = [
    `Hit ${primaryStore} first for ${cheapestHit}.`,
    state.couponMatches.length ? `Prioritize ${state.couponMatches[0]} before discretionary add-ons.` : "Match core list items to active coupons first.",
    prepFocus.length ? `Prep first: ${prepFocus.slice(0, 2).join(" + ")}.` : "Prep one protein + one carb base before the week starts.",
  ];

  const vegasLiveHunterRows = useMemo(() => buildVegasLiveHunterRows(state, storeStackRows), [state, storeStackRows]);
  const vegasLiveHunterBrief = useMemo(() => buildVegasLiveHunterBrief(state, bestTripRoute, storeStackRows), [state, bestTripRoute, storeStackRows]);
  const basketCompareRows = useMemo(() => buildBasketCompareRows(state, storeStackRows, targetNumber, estimatedListCost), [state, storeStackRows, targetNumber, estimatedListCost]);
  const bestLiveLane = vegasLiveHunterRows[0]?.store || primaryStore;
  const bestBasketLane = basketCompareRows[0];

  return (
    <div className="page">
      <PanelHeader
        panelId="GroceryMeals"
        title="🛒 Grocery Meals"
        subtitle="Meal planning + food prep + coupon hunting + auto deal board."
        storagePrefix="oddengine:groceryMeals"
        storageActionsMode="menu"
        badges={[
          { label: `${state.groceryList.length} needed`, tone: state.groceryList.length ? "warn" : "good" },
          { label: `Pantry ${pantryCoverage}%`, tone: pantryCoverage >= 70 ? "good" : pantryCoverage >= 40 ? "warn" : "bad" },
          { label: `Est. $${estimatedListCost.toFixed(0)}${targetNumber ? ` vs goal $${targetNumber.toFixed(0)}` : ""}`, tone: budgetDelta > 0 ? "warn" : "good" },
          ...(hasSaverPack ? [{ label: "Saver pack active", tone: "good" as const }] : []),
        ]}
        rightSlot={
          <ActionMenu
            title="Grocery tools"
            items={[
              { label: "Open Calendar", onClick: () => onNavigate?.("Calendar") },
              { label: "Add grocery run", onClick: () => { const d = prompt("Date (YYYY-MM-DD)", fmtDate(new Date())); if(!d) return; addQuickEvent({ title: "Grocery run", panelId: "GroceryMeals", date: d, notes: `Basket goal: ${state.basketGoal || "—"}` }); pushNotif({ title: "Grocery", body: "Added grocery run to Calendar.", tags: ["GroceryMeals"], level: "good" as any }); } },
              { label: "Add meal prep session", onClick: () => { const d = prompt("Date (YYYY-MM-DD)", fmtDate(new Date())); if(!d) return; addQuickEvent({ title: "Meal prep", panelId: "GroceryMeals", date: d, notes: "Prep proteins + chop veg + portion snacks." }); pushNotif({ title: "Grocery", body: "Added meal prep to Calendar.", tags: ["GroceryMeals"], level: "good" as any }); } },
            ]}
          />
        }
      />

      <PanelScheduleCard
        panelId="GroceryMeals"
        title="Grocery schedule"
        subtitle="Quick-add planning reminders + upcoming items."
        presets={[
          { label: "+ Plan meals", title: "Plan meals", notes: "Set dinners + build list." },
          { label: "+ Grocery run", title: "Grocery run", notes: "Run the list + check deals." },
          { label: "+ Meal prep", title: "Meal prep", offsetDays: 0, notes: "Prep proteins + snacks." },
          { label: "+ Pantry audit", title: "Pantry audit", offsetDays: 7, notes: "Restock staples + update price book." },
        ]}
        onNavigate={onNavigate}
      />

      <PluginMiniWidgets panelId="GroceryMeals" onNavigate={onNavigate} onOpenHowTo={onOpenHowTo} />

      <div className="groceryHeroBar card softCard">
        <div>
          <div className="small shellEyebrow">COUPON HUNTER COMMAND</div>
          <div className="groceryHeroTitle">Food Prep + Auto Deal Board</div>
          <div className="small groceryHeroSub">Build the meals, hunt the best deals, route the run, and prep food fast enough that the basket actually saves money.</div>
        </div>
        <div className="row wrap groceryHeroBadges" style={{ justifyContent: "flex-end" }}>
          <span className={`badge ${state.cheapWeekMode ? "warn" : "good"}`}>{state.cheapWeekMode ? "Cheap week active" : "Balanced planning"}</span>
          <span className="badge">Primary {primaryStore}</span>
          <span className={`badge ${budgetDelta > 0 ? "warn" : "good"}`}>{targetNumber ? `${estimatedListCost.toFixed(0)} / ${targetNumber.toFixed(0)}` : `$${estimatedListCost.toFixed(0)}`}</span>
          <span className={`badge ${state.couponMatches.length ? "good" : "warn"}`}>{couponPosture}</span>
        </div>
      </div>

      <div className="card softCard groceryProxyPrepCard">
        <div className="small shellEyebrow">REAL COUPON SCRAPER / LOCAL PROXY PREP</div>
        <div className="grocerySectionTitle">Proxy-ready deal ingestion lane</div>
        <div className="small groceryDenseText">Choose a connector provider now so the UI and local backend can route by store lane like a real coupon cockpit.</div>
        <div className="small groceryDenseText">Keep the stable RSS feed as fallback, but prep a local proxy for store-specific weekly ads, digital coupon lanes, and Extreme Couponing-style stack logic without CORS pain in the browser.</div>
        <div className="groceryProxyGrid" style={{ marginTop: 12 }}>
          <label className="field">ZIP code
            <input value={state.zipCode} onChange={(e) => persist({ ...state, zipCode: e.target.value, lastUpdated: Date.now() })} placeholder="89121" />
          </label>
          <label className="field">Fulfillment mode
            <select value={state.fulfillmentMode} onChange={(e) => persist({ ...state, fulfillmentMode: e.target.value as FulfillmentMode, lastUpdated: Date.now() })}>
              <option value="either">Pickup + delivery</option>
              <option value="pickup">Pickup only</option>
              <option value="delivery">Delivery only</option>
            </select>
          </label>
          <label className="field">Deal source mode
            <select value={state.dealSourceMode} onChange={(e) => persist({ ...state, dealSourceMode: e.target.value as any, lastUpdated: Date.now() })}>
              <option value="rss">RSS fallback</option>
              <option value="local-proxy">Local proxy</option>
            </select>
          </label>
          <label className="field">Proxy base URL
            <input value={state.proxyBaseUrl} onChange={(e) => persist({ ...state, proxyBaseUrl: e.target.value, lastUpdated: Date.now() })} placeholder="http://127.0.0.1:8787" />
          </label>
          <label className="field">Proxy query
            <input value={state.proxyQuery} onChange={(e) => persist({ ...state, proxyQuery: e.target.value, lastUpdated: Date.now() })} placeholder="grocery coupons weekly ad produce protein pantry" />
          </label>
          <label className="field">Connector provider
            <select value={state.proxyProviderId} onChange={(e) => persist({ ...state, proxyProviderId: e.target.value, lastUpdated: Date.now() })}>
              {(state.proxyProviders.length ? state.proxyProviders : [{ id: "seed", label: "Seed data" }, { id: "mock-coupons", label: "Mock coupon engine" }]).map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.label}{provider.kind === 'store-starter' ? ' • store starter' : ''}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="row wrap mt-4">
          <button className={`tabBtn ${state.dealSourceMode === "local-proxy" ? "active" : ""}`} onClick={refreshProxyDeals} disabled={busy}>Load proxy deals</button>
          <button className="tabBtn" onClick={refreshProxyProviders} disabled={busy}>Load providers</button>
          <button className="tabBtn" onClick={testProxy} disabled={busy}>Test proxy</button>
          <button className={`tabBtn ${state.dealSourceMode === "rss" ? "active" : ""}`} onClick={refreshCoupons} disabled={busy}>Use RSS fallback</button>
        </div>
        <div className="small groceryDenseText" style={{ marginTop: 10 }}>Starter connectors now available: Walmart, Smith's/Kroger, Albertsons/Vons, Costco, Target, Sam's Club, and Amazon Fresh. Pick one when you want the deal board to act more like an Extreme Couponing route instead of a generic feed.</div>
        <div className="small groceryDenseText" style={{ marginTop: 6 }}>{vegasDealCommand}</div>
        <div className="assistantChipWrap" style={{ marginTop: 10 }}>
          <span className={`badge ${state.dealSourceMode === "local-proxy" ? "good" : ""}`}>{state.dealSourceMode === "local-proxy" ? "Local proxy armed" : "RSS safe mode"}</span>
          <span className="badge">{state.proxyStatus || "Proxy idle"}</span>
          <span className="badge">Provider {state.proxyProviderId}</span>
          <span className="badge">ZIP {state.zipCode}</span>
          <span className="badge">{state.fulfillmentMode === "either" ? "Pickup + delivery" : state.fulfillmentMode}</span>
          <span className="badge">{(state.proxyProviders.find((p) => p.id === state.proxyProviderId)?.stores || []).join(" • ") || "Multi-store"}</span>
          <span className="badge">{state.proxyBaseUrl}</span>
        </div>
      </div>

      <div className="groceryVegasGrid mt-4">
        <div className="card softCard groceryVegasCard">
          <div className="small shellEyebrow">VEGAS LIVE DEAL HUNTER</div>
          <div className="grocerySectionTitle">89121 pickup / delivery strike board</div>
          <div className="small groceryDenseText">This board acts like a live-route command lane: which store deserves the first hit, which lane is bulk value, and which stop stays optional unless it meaningfully beats the basket shield.</div>
          <div className="assistantChipWrap" style={{ marginTop: 12 }}>
            <span className="badge good">Best live lane {bestLiveLane}</span>
            <span className="badge">{state.fulfillmentMode === "either" ? "Pickup + delivery" : state.fulfillmentMode}</span>
            <span className="badge">ZIP {state.zipCode}</span>
            <span className="badge">Route {bestTripRoute}</span>
          </div>
          <div className="assistantStack" style={{ marginTop: 12 }}>
            {vegasLiveHunterBrief.map((line, idx) => <div key={idx} className="timelineCard groceryTimelineCard">{line}</div>)}
          </div>
          <div className="row wrap mt-4">
            <button className="tabBtn active" onClick={() => { state.dealSourceMode === "local-proxy" ? refreshProxyDeals() : refreshCoupons(); }}>Refresh live hunter</button>
            <button className="tabBtn" onClick={() => { buildAiDealAssist(); }}>Rebuild Vegas brief</button>
            <button className="tabBtn" onClick={() => onNavigate?.("FamilyBudget")}>Open budget war room</button>
          </div>
        </div>

        <div className="card softCard groceryVegasCard">
          <div className="small shellEyebrow">STORE HUNT BOARD</div>
          <div className="grocerySectionTitle">Best stores to hit now</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {vegasLiveHunterRows.map((row) => (
              <div key={row.store} className="timelineCard groceryStackRow">
                <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{row.rank}. {row.store}</div>
                    <div className="small" style={{ marginTop: 4 }}>{row.status}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`badge ${row.tone}`}>Stack {row.score}</span>
                    <div className="small" style={{ marginTop: 4 }}>{row.stopValue}</div>
                  </div>
                </div>
                <div className="small" style={{ marginTop: 8 }}>{row.bestTitle}</div>
                <div className="small groceryDenseText" style={{ marginTop: 6 }}>{row.note}</div>
              </div>
            ))}
            {!vegasLiveHunterRows.length && <div className="small">Load the deal board to populate the Vegas live hunter lanes.</div>}
          </div>
        </div>
      </div>

      <div className="groceryBasketCompareGrid mt-4">
        <div className="card softCard groceryBasketCompareCard">
          <div className="small shellEyebrow">REAL VEGAS BASKET COMPARER</div>
          <div className="grocerySectionTitle">Compare the whole basket before you roll</div>
          <div className="small groceryDenseText">This board compares likely total basket outcome by store and fulfillment lane for Las Vegas {state.zipCode}. It is built to answer the real question: where should AI Homie send you for the cheapest actual cart, not just the coolest coupon.</div>
          <div className="assistantChipWrap" style={{ marginTop: 12 }}>
            <span className={`badge ${bestBasketLane?.posture || ""}`}>Best basket {bestBasketLane?.store || primaryStore}</span>
            <span className="badge">{state.fulfillmentMode === "either" ? "Pickup + delivery" : state.fulfillmentMode}</span>
            <span className="badge">Goal {targetNumber ? `$${targetNumber.toFixed(0)}` : "Set basket goal"}</span>
            <span className="badge">Est list ${estimatedListCost.toFixed(0)}</span>
          </div>
          <div className="assistantStack" style={{ marginTop: 12 }}>
            {basketCompareRows.map((row, idx) => (
              <div key={`${row.store}-${row.lane}`} className="timelineCard groceryBasketRow">
                <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{idx + 1}. {row.store}</div>
                    <div className="small" style={{ marginTop: 4 }}>{row.lane.toUpperCase()} lane • basket score {row.basketScore}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`badge ${row.posture}`}>${row.estimatedTotal.toFixed(2)}</span>
                    <div className="small" style={{ marginTop: 4 }}>{row.savingsAngle}</div>
                  </div>
                </div>
                <div className="small groceryDenseText" style={{ marginTop: 8 }}>{row.orderNote}</div>
              </div>
            ))}
          </div>
          <div className="row wrap mt-4">
            <button className="tabBtn active" onClick={() => { state.dealSourceMode === "local-proxy" ? refreshProxyDeals() : refreshCoupons(); }}>Re-compare basket</button>
            <button className="tabBtn" onClick={() => onNavigate?.("FamilyBudget")}>Open savings war room</button>
            <button className="tabBtn" onClick={() => buildAiDealAssist()}>Refresh AI compare note</button>
          </div>
        </div>

        <div className="card softCard groceryBasketCompareCard">
          <div className="small shellEyebrow">ULTIMATE DEAL FINDER MODE</div>
          <div className="grocerySectionTitle">Online + Las Vegas shopping attack plan</div>
          <div className="assistantStack" style={{ marginTop: 12 }}>
            <div className="timelineCard groceryTimelineCard">Start with <b>{bestBasketLane?.store || primaryStore}</b> because it currently projects the strongest whole-cart outcome, not just the flashiest coupon.</div>
            <div className="timelineCard groceryTimelineCard">Use <b>pickup</b> whenever possible for 89121 if you want the cleanest savings result. Delivery wins only when time saved matters more than the fee drag.</div>
            <div className="timelineCard groceryTimelineCard">Treat Amazon Fresh and Sam's Club as tactical lanes: Amazon for convenience/time, Sam's for pantry-protein-paper bulk, not random one-off fillers.</div>
            <div className="timelineCard groceryTimelineCard">Keep Smith's/Kroger and Walmart in the fight because weekly ads, digital coupons, and pickup value usually decide the real winner in Vegas.</div>
          </div>
        </div>
      </div>

      <div className="groceryMetricStrip">
        <div className="card groceryMetricCard">
          <div className="small shellEyebrow">STACK SCORE</div>
          <div className="groceryMetricValue">{couponStackScore}</div>
          <div className="small">Hottest lane: {hottestLane}</div>
        </div>
        <div className="card groceryMetricCard">
          <div className="small shellEyebrow">PANTRY COVERAGE</div>
          <div className="groceryMetricValue">{pantryCoverage}%</div>
          <div className="small">{pantryCount} staples on hand • ZIP {state.zipCode}</div>
        </div>
        <div className="card groceryMetricCard">
          <div className="small shellEyebrow">COUPON HITS</div>
          <div className="groceryMetricValue">{state.couponMatches.length}</div>
          <div className="small">Top need: {topNeed}</div>
        </div>
        <div className="card groceryMetricCard">
          <div className="small shellEyebrow">LEAK RISK</div>
          <div className="groceryMetricValue">${leakRisk}</div>
          <div className="small">{leakRisk > 0 ? "Prep or route gap detected" : "Basket shield is up"}</div>
        </div>
      </div>

      <div className="groceryHunterGrid mt-4">
        <div className="card softCard grocerySectionCard groceryHunterCard">
          <div className="small shellEyebrow">COUPON HUNTER</div>
          <div className="grocerySectionTitle">Auto-find the best deals first</div>
          <div className="small groceryDenseText">Use the live deal feed plus your current list to rank the strongest coupon/deal targets before you ever leave the house.</div>
          <div className="row wrap mt-4">
            <button className="tabBtn active" onClick={() => { refreshCoupons(); window.setTimeout(() => matchCoupons(), 200); }} disabled={busy}>{busy ? "Scanning…" : "Scan coupon lane"}</button>
            <button className="tabBtn" onClick={() => buildAiDealAssist()}>{state.aiDealNote ? "Refresh strategy" : "Build strategy"}</button>
            <button className="tabBtn" onClick={() => persist({ ...state, aiDealNote: buildCouponGodMode(state), lastUpdated: Date.now() })}>Build GodMode</button>
          </div>
          <div className="assistantChipWrap" style={{ marginTop: 12 }}>
            <span className="badge good">Best hit: {bestDealHeadline}</span>
            <span className="badge">{primaryStore}</span>
            <span className={`badge ${budgetDelta > 0 ? "warn" : "good"}`}>{targetNumber ? `${budgetDelta > 0 ? "Over" : "Within"} goal` : "Set basket goal"}</span>
          </div>
        </div>
        <div className="card softCard grocerySectionCard groceryHunterCard">
          <div className="small shellEyebrow">AUTO DEAL BOARD</div>
          <div className="grocerySectionTitle">Ranked deal board</div>
          <div className="assistantStack groceryDealBoard" style={{ marginTop: 10 }}>
            {autoDealBoard.map(({ item, score }) => (
              <div key={item.id} className="timelineCard groceryDealRow">
                <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 800 }}>{item.title}</div>
                  <span className={`badge ${score >= 70 ? "good" : score >= 50 ? "warn" : ""}`}>Score {score}</span>
                </div>
                {item.summary && <div className="small" style={{ marginTop: 6 }}>{item.summary.slice(0, 150)}{item.summary.length > 150 ? "…" : ""}</div>}
                <div className="row wrap" style={{ marginTop: 8, gap: 8 }}>
                  <span className="badge">{item.source || "Deals"}</span>
                  <button className="tabBtn" onClick={() => openExternalLink(item.link)}>Open deal</button>
                </div>
              </div>
            ))}
            {!autoDealBoard.length && <div className="small">Refresh the coupon lane to populate the auto deal board.</div>}
          </div>
        </div>
      </div>

      <div className="groceryStackGrid mt-4">
        <div className="card softCard groceryStackCard">
          <div className="small shellEyebrow">COUPON STACK ENGINE</div>
          <div className="grocerySectionTitle">Rank stores like Extreme Couponing mode</div>
          <div className="small groceryDenseText">This lane scores which store deserves the first hit, which one is worth a second stop, and which store should get skipped unless a specific item forces the route.</div>
          <div className="assistantStack" style={{ marginTop: 12 }}>
            {storeStackRows.map((row, idx) => (
              <div key={row.store} className="timelineCard groceryStackRow">
                <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{idx + 1}. {row.store}</div>
                    <div className="small" style={{ marginTop: 4 }}>{row.bestTitle}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`badge ${idx === 0 ? "good" : idx === 1 ? "warn" : ""}`}>Stack {row.score}</span>
                    <div className="small" style={{ marginTop: 4 }}>{row.hits} hits • {row.stopValue}</div>
                  </div>
                </div>
              </div>
            ))}
            {!storeStackRows.length && <div className="small">Load proxy deals or refresh RSS so the stack engine can rank your stops.</div>}
          </div>
        </div>

        <div className="card softCard groceryStackCard">
          <div className="small shellEyebrow">TRIP OPTIMIZER</div>
          <div className="grocerySectionTitle">Best route right now</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            <span className="badge good">Route {bestTripRoute}</span>
            <span className={`badge ${budgetDelta > 0 ? "warn" : "good"}`}>{budgetDelta > 0 ? `Over plan $${Math.abs(budgetDelta).toFixed(0)}` : "Under plan"}</span>
            <span className="badge">{storeStackRows.length} active stops</span>
          </div>
          <div className="assistantStack" style={{ marginTop: 12 }}>
            {tripOptimizerSteps.map((step, idx) => (
              <div key={idx} className="timelineCard">
                <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 800 }}>Move {idx + 1}</div>
                  <span className="badge">{idx === 0 ? "Route" : idx === 1 ? "Stop 2" : idx === 2 ? "Cleanup" : idx === 3 ? "Checkout" : idx === 4 ? "Prep" : "Budget"}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>{step}</div>
              </div>
            ))}
          </div>
          <div className="row wrap mt-4">
            <button className="tabBtn active" onClick={() => { refreshProxyDeals(); window.setTimeout(() => buildAiDealAssist(), 200); }}>Re-rank route</button>
            <button className="tabBtn" onClick={() => buildAiDealAssist()}>Refresh stack note</button>
          </div>
        </div>
      </div>

      <div className="groceryWarRoomGrid mt-4">
        <div className="card softCard groceryWarRoomCard">
          <div className="small shellEyebrow">SAVINGS WAR ROOM</div>
          <div className="grocerySectionTitle">Build the basket like a discount operator</div>
          <div className="small groceryDenseText">This board turns the coupon lane, list load, and prep plan into one weekly save-money attack. Stack the best board hits first, then route the run so the basket lands under goal.</div>
          <div className="groceryWarRoomMetrics">
            <div className="card groceryMiniWarCard">
              <div className="small shellEyebrow">SAVE SHOT</div>
              <div className="groceryMetricValue">${warRoomSavings}</div>
              <div className="small">{groceryWarMode}</div>
            </div>
            <div className="card groceryMiniWarCard">
              <div className="small shellEyebrow">BOARD POWER</div>
              <div className="groceryMetricValue">{totalAutoDealScore}</div>
              <div className="small">{autoDealBoard.length} ranked hits</div>
            </div>
            <div className="card groceryMiniWarCard">
              <div className="small shellEyebrow">BASKET SHIELD</div>
              <div className="groceryMetricValue">{basketShield}</div>
              <div className="small">{targetNumber ? `Goal ${targetNumber.toFixed(0)}` : "Add a basket goal"}</div>
            </div>
          </div>
          <div className="assistantStack" style={{ marginTop: 12 }}>
            {warRoomPlaybook.map((step, idx) => (
              <div key={idx} className="timelineCard">
                <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 800 }}>Step {idx + 1}</div>
                  <span className="badge">{idx === 0 ? "Attack" : idx === 1 ? "Stack" : "Prep"}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>{step}</div>
              </div>
            ))}
          </div>
          <div className="row wrap mt-4">
            <button className="tabBtn active" onClick={() => { refreshCoupons(); window.setTimeout(() => matchCoupons(), 200); }}>{busy ? "Scanning…" : "Rebuild war room"}</button>
            <button className="tabBtn" onClick={() => buildAiDealAssist()}>Refresh savings brief</button>
            <button className="tabBtn" onClick={() => persist({ ...state, aiDealNote: buildCouponGodMode(state), cheapWeekMode: true, lastUpdated: Date.now() })}>Flip cheap week saver</button>
          </div>
        </div>
        <div className="card softCard groceryWarRoomCard">
          <div className="small shellEyebrow">FAMILY BUDGET LINK</div>
          <div className="grocerySectionTitle">Translate deal wins into household runway</div>
          <div className="small groceryDenseText">Every saved dollar here should become more monthly breathing room. Use this lane to treat grocery wins like a real budget lever, not just a lucky coupon day.</div>
          <div className="assistantChipWrap" style={{ marginTop: 12 }}>
            <span className="badge good">${warRoomSavings} weekly save shot</span>
            <span className="badge">{state.groceryList.length} items on list</span>
            <span className="badge">{state.couponMatches.length} coupon hits</span>
          </div>
          <div className="small" style={{ marginTop: 12, lineHeight: 1.55 }}>
            Route the win into FamilyBudget as grocery savings, payoff fuel, or runway protection. The cleaner this board gets, the easier it is to keep the whole house under pressure without feeling broke.
          </div>
        </div>
      </div>

      <div className="spotlightGrid groceryCommandGrid">
        <div className="card spotlightCard groceryCommandCard">
          <div className="small shellEyebrow">FOOD PREP COMMAND</div>
          <div className="grocerySectionTitle">Turn groceries into ready food</div>
          <div className="small groceryDenseText">Prep is the anti-takeout shield. Batch proteins, chop veg, portion snacks, and lock one flex carb so your deals actually become meals.</div>
          <div className="small groceryDenseText" style={{ marginTop: 10 }}>Starter connectors now available: Walmart, Smith's/Kroger, Albertsons/Vons, Costco, Target, Sam's Club, and Amazon Fresh. Pick one when you want the deal board to act more like an Extreme Couponing route instead of a generic feed.</div>
        <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            {(prepFocus.length ? prepFocus : ["Batch protein", "Chop veg", "Portion snacks", "Make one sauce"]).map((item) => <span key={item} className="badge">{item}</span>)}
          </div>
        </div>
        <div className="card spotlightCard groceryCommandCard">
          <div className="small shellEyebrow">STORE PLAYBOOK</div>
          <div className="grocerySectionTitle">Route the run</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {(state.storePlan.length ? state.storePlan : buildStorePlanText(state.preferredStores, state.cheapWeekMode, state.couponMatches)).slice(0, 3).map((line, idx) => <div key={idx} className="timelineCard groceryTimelineCard">{line}</div>)}
          </div>
        </div>
        <div className="card spotlightCard groceryCommandCard">
          <div className="small shellEyebrow">AI DEAL ASSISTANT</div>
          <div className="grocerySectionTitle">Savings strategy note</div>
          <pre className="writersPlannerPreview groceryPlannerPreview">{state.aiDealNote || "No strategy note yet. Scan the coupon lane or build the AI deal assist to populate this board."}</pre>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard grocerySectionCard">
          <div className="small shellEyebrow">PANTRY INTELLIGENCE</div>
          <div className="grocerySectionTitle">Las Vegas pantry command</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {pantryIntel.map((line, idx) => <div key={idx} className="timelineCard groceryTimelineCard">{line}</div>)}
          </div>
        </div>
        <div className="card softCard grocerySectionCard">
          <div className="small shellEyebrow">PRICE MEMORY ENGINE</div>
          <div className="grocerySectionTitle">Remember your best basket prices</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {priceMemoryRows.map((row) => (
              <div key={row.item} className="row" style={{ justifyContent: 'space-between', gap: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{row.item}</div>
                  <div className="small">Remembered ${row.remembered.toFixed(2)}</div>
                </div>
                <span className={`badge ${row.posture === 'green' ? 'good' : row.posture === 'watch' ? 'warn' : 'bad'}`}>{row.posture}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard grocerySectionCard">
          <div className="small shellEyebrow">PANTRY + SETTINGS</div>
          <div className="grocerySectionTitle">Pantry, tags, and basket goal</div>
          <label className="field" style={{ marginTop: 10 }}>Pantry items
            <textarea rows={6} value={state.pantry} onChange={(e) => persist({ ...state, pantry: e.target.value, lastUpdated: Date.now() })} placeholder="List one item per line…" />
          </label>
          <label className="field">Dietary tags / notes
            <input value={state.dietaryTags} onChange={(e) => persist({ ...state, dietaryTags: e.target.value, lastUpdated: Date.now() })} placeholder="low sodium, higher protein, kid friendly…" />
          </label>
          <label className="field">Basket goal
            <input value={state.basketGoal} onChange={(e) => persist({ ...state, basketGoal: e.target.value, lastUpdated: Date.now() })} placeholder="$125 family week" />
          </label>
          <div className="assistantSectionTitle" style={{ marginTop: 14 }}>Preferred stores</div>
          <div className="small groceryDenseText" style={{ marginTop: 10 }}>Starter connectors now available: Walmart, Smith's/Kroger, Albertsons/Vons, Costco, Target, Sam's Club, and Amazon Fresh. Pick one when you want the deal board to act more like an Extreme Couponing route instead of a generic feed.</div>
        <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            {STORE_OPTIONS.map((store) => (
              <button key={store} className={`tabBtn ${state.preferredStores.includes(store) ? "active" : ""}`} onClick={() => toggleStore(store)}>{store}</button>
            ))}
          </div>
          <div className="row wrap" style={{ marginTop: 12 }}>
            <button className="tabBtn active" onClick={() => buildList()}>Build grocery list</button>
            <button className="tabBtn" onClick={estimateBasket}>Estimate basket</button>
            <button className="tabBtn" onClick={runCheapWeek}>Cheap week</button>
          </div>
          <div className="assistantSectionTitle" style={{ marginTop: 14 }}>Live coupon links</div>
          <div className="small groceryDenseText" style={{ marginTop: 10 }}>Starter connectors now available: Walmart, Smith's/Kroger, Albertsons/Vons, Costco, Target, Sam's Club, and Amazon Fresh. Pick one when you want the deal board to act more like an Extreme Couponing route instead of a generic feed.</div>
        <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            {DEFAULT_COUPON_LINKS.map((link) => <button key={link.label} className="tabBtn" onClick={() => openExternalLink(link.url)}>{link.label}</button>)}
          </div>
        </div>

        <div className="card softCard grocerySectionCard">
          <div className="small shellEyebrow">FOOD PREP + PLANNING</div>
          <div className="grocerySectionTitle">Prep game plan</div>
          <label className="field" style={{ marginTop: 10 }}>Prep plan
            <textarea rows={6} value={state.prepPlan} onChange={(e) => persist({ ...state, prepPlan: e.target.value, lastUpdated: Date.now() })} placeholder="Batch protein, chop veg, prep grab-and-go snacks…" />
          </label>
          <div className="row wrap" style={{ marginTop: 12 }}>
            <button className="tabBtn active" onClick={() => buildAiDealAssist()}>Build prep strategy</button>
            <button className="tabBtn" onClick={() => onNavigate?.("DailyChores")}>Open chores</button>
          </div>
          <div className="assistantStack" style={{ marginTop: 12 }}>
            {(prepFocus.length ? prepFocus : ["Batch protein first", "Prep fruit and snacks", "Cook one flex carb"]).map((line, idx) => <div key={idx} className="timelineCard groceryTimelineCard">{line}</div>)}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard grocerySectionCard">
          <div className="small shellEyebrow">MEAL GRID</div>
          <div className="grocerySectionTitle">Weekly meal plan</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {state.meals.map((meal, idx) => (
              <div key={meal.day} className="timelineCard">
                <div style={{ fontWeight: 800 }}>{meal.day}</div>
                <div className="grid2" style={{ marginTop: 8 }}>
                  <label className="field">Breakfast<input value={meal.breakfast} onChange={(e) => patchMeal(idx, "breakfast", e.target.value)} placeholder="oatmeal, berries" /></label>
                  <label className="field">Lunch<input value={meal.lunch} onChange={(e) => patchMeal(idx, "lunch", e.target.value)} placeholder="turkey wraps" /></label>
                  <label className="field">Dinner<input value={meal.dinner} onChange={(e) => patchMeal(idx, "dinner", e.target.value)} placeholder="chicken, rice, broccoli" /></label>
                  <label className="field">Snacks<input value={meal.snacks} onChange={(e) => patchMeal(idx, "snacks", e.target.value)} placeholder="yogurt, apples" /></label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card softCard grocerySectionCard">
          <div className="small shellEyebrow">BUILD OUTPUT</div>
          <div className="grocerySectionTitle">Generated grocery list + matched deals</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {state.groceryList.map((item) => (
              <div key={item} className="timelineCard groceryTimelineCard row" style={{ justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <span>{item}</span>
                <span className={`badge ${state.couponMatches.some((match) => match.toLowerCase().includes(item.toLowerCase())) ? "good" : ""}`}>{state.couponMatches.some((match) => match.toLowerCase().includes(item.toLowerCase())) ? "Matched" : "Watch"}</span>
              </div>
            ))}
            {!state.groceryList.length && <div className="small">Build the list from your meal plan to see what you still need.</div>}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard grocerySectionCard">
          <div className="small shellEyebrow">PRICE MEMORY</div>
          <div className="grocerySectionTitle">Price book</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {state.groceryList.map((item) => (
              <div key={item} className="timelineCard">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800 }}>{item}</div>
                  <label className="field" style={{ minWidth: 150 }}>
                    Est. price
                    <input value={String(state.priceBook[item] ?? estimateItemPrice(item))} onChange={(e) => patchPrice(item, e.target.value)} />
                  </label>
                </div>
              </div>
            ))}
            {!state.groceryList.length && <div className="small">Your generated grocery list seeds the price book automatically.</div>}
          </div>
        </div>

        <div className="card softCard grocerySectionCard">
          <div className="small shellEyebrow">LIVE DEALS</div>
          <div className="grocerySectionTitle">Coupon / deals feed</div>
          <div className="small groceryDenseText" style={{ marginTop: 6 }}>Source: {state.dealSourceMode === "local-proxy" ? `Local proxy • ${state.proxyProviderId} • ${state.proxyStatus}` : "RSS fallback"}</div>
          {state.lastError && <div className="small" style={{ marginTop: 8, color: "var(--warn)" }}>{state.lastError}</div>}
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {state.couponFeed.slice(0, 8).map((item) => (
              <div key={item.id} className="timelineCard groceryTimelineCard">
                <div className="small">{item.source || "Deals"}{item.publishedAt ? ` • ${item.publishedAt}` : ""}</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{item.title}</div>
                {item.summary && <div className="small" style={{ marginTop: 6 }}>{item.summary.slice(0, 180)}{item.summary.length > 180 ? "…" : ""}</div>}
                <div className="row wrap" style={{ marginTop: 8 }}>
                  <button className="tabBtn" onClick={() => openExternalLink(item.link)}>Open deal</button>
                </div>
              </div>
            ))}
            {!state.couponFeed.length && <div className="small">No coupon feed yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
