import React, { useEffect, useMemo, useState } from "react";
import { acknowledgePanelAction, getPanelActions, PANEL_ACTION_EVENT } from "../lib/brain";
import { loadJSON, saveJSON } from "../lib/storage";
import { pushNotif } from "../lib/notifs";
import { DEFAULT_COUPON_LINKS, FeedItem, fetchNewsFeed, openExternalLink } from "../lib/webData";
import PluginMiniWidgets from "../components/PluginMiniWidgets";
import { UPGRADE_PACKS_EVENT, isUpgradePackInstalled } from "../lib/plugins";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import { addQuickEvent, fmtDate } from "../lib/calendarStore";

type MealPlan = { day: string; breakfast: string; lunch: string; dinner: string; snacks: string };
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
  lastUpdated?: number;
  lastError?: string;
};

const KEY = "oddengine:groceryMeals:v1";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STORE_OPTIONS = ["Walmart", "Smith's/Kroger", "Albertsons/Vons", "Costco", "Target"];
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
  prepPlan: "Cook protein first, prep grab-and-go snacks, and batch one flexible carb for the week.",
  aiDealNote: "",
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
  if (stores[1]) notes.push(`Secondary pass: ${stores[1]} for ad-match or better produce/meat pricing.`);
  if (cheapWeekMode) notes.push("Cheap-week mode is on, so prioritize staples, frozen veg, eggs, beans, rice, oats, and overlap ingredients.");
  if (couponMatches.length) notes.push(`Coupon lane has ${couponMatches.length} likely matches. Check those before checkout.`);
  if (!couponMatches.length) notes.push("Refresh the coupon lane before shopping so the plan can pivot to live deals.");
  return notes;
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
    const storePlan = hasSaverPack ? buildStorePlanText(base.preferredStores, base.cheapWeekMode, base.couponMatches) : base.storePlan;
    const next = { ...base, groceryList, priceBook, storePlan, lastUpdated: Date.now() };
    persist(next);
    if (hasSaverPack) matchCoupons(next, false);
  }

  async function refreshCoupons() {
    setBusy(true);
    try {
      const couponFeed = await fetchNewsFeed("https://slickdeals.net/newsearch.php?q=grocery&searcharea=deals&searchin=first&rss=1", "Slickdeals Grocery");
      const next = { ...state, couponFeed, lastUpdated: Date.now(), lastError: "" };
      persist(next);
      if (hasSaverPack) matchCoupons(next, false);
    } catch (e: any) {
      persist({ ...state, lastError: e?.message || String(e), lastUpdated: Date.now() });
    } finally {
      setBusy(false);
    }
  }

  function runCheapWeek() {
    if (!hasSaverPack) return;
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
    if (!hasSaverPack) return;
    const items = (base.groceryList || []).map((item) => item.toLowerCase());
    const couponMatches = (base.couponFeed || [])
      .filter((deal) => items.some((item) => `${deal.title} ${deal.summary || ""}`.toLowerCase().includes(item)))
      .slice(0, 8)
      .map((deal) => deal.title);
    const next = { ...base, couponMatches, storePlan: buildStorePlanText(base.preferredStores, base.cheapWeekMode, couponMatches), lastUpdated: Date.now() };
    if (push) persist(next); else { setState(next); saveJSON(KEY, next); }
  }

  function estimateBasket() {
    const priceBook = { ...state.priceBook };
    state.groceryList.forEach((item) => {
      if (!(item in priceBook)) priceBook[item] = Number(estimateItemPrice(item).toFixed(2));
    });
    persist({ ...state, priceBook, storePlan: hasSaverPack ? buildStorePlanText(state.preferredStores, state.cheapWeekMode, state.couponMatches) : state.storePlan, lastUpdated: Date.now() });
  }

  function patchPrice(item: string, value: string) {
    const parsed = Number(value);
    const next = { ...state, priceBook: { ...state.priceBook, [item]: Number.isFinite(parsed) ? parsed : 0 }, lastUpdated: Date.now() };
    persist(next);
  }

  function buildStorePlan() {
    if (!hasSaverPack) return;
    persist({ ...state, storePlan: buildStorePlanText(state.preferredStores, state.cheapWeekMode, state.couponMatches), lastUpdated: Date.now() });
  }

  function buildAiDealAssist(base = state) {
    const topDeals = (base.couponFeed || []).slice(0, 4).map((d) => d.title);
    const target = base.basketGoal || "$125 family week";
    const strongest = base.couponMatches.length ? `Strongest current matches: ${base.couponMatches.slice(0,3).join(", ")}.` : "No direct coupon matches yet, so lean into pantry overlap and staple swaps.";
    const focus = base.groceryList.slice(0, 5).join(", ") || "rice, eggs, frozen vegetables";
    const note = [
      `# AI Deal Assistant`,
      ``,
      `Basket goal: ${target}.`,
      `Primary store lane: ${base.preferredStores[0] || "Walmart"}.`,
      strongest,
      `Priority items: ${focus}.`,
      topDeals.length ? `Live deal lane: ${topDeals.join(" | ")}` : `Refresh the live deal lane for fresh coupon data.`,
      ``,
      `## Best move`,
      `1. Lock meals that reuse the same proteins + veg.`,
      `2. Buy staples first, then only add bonus snacks if the basket stays within goal.`,
      `3. Use the cheapest store for pantry refills and only do a second stop if coupon matches justify it.`,
    ].join("\n");
    persist({ ...base, aiDealNote: note, lastUpdated: Date.now() });
  }

  useEffect(() => { if (!state.couponFeed.length) refreshCoupons(); }, []);

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
        if (action.actionId === "grocery:cheap-week") runCheapWeek();
        if (action.actionId === "grocery:match-coupons") matchCoupons();
        if (action.actionId === "grocery:estimate-basket") estimateBasket();
        if (action.actionId === "grocery:store-plan") buildStorePlan();
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

  const topNeed = state.groceryList[0] || "Build your list";
  const primaryStore = state.preferredStores[0] || "Walmart";
  const couponPosture = state.couponMatches.length ? "Deals matched" : state.couponFeed.length ? "Deals loaded" : "Need refresh";
  const prepFocus = useMemo(() => normalizeItems(state.prepPlan).slice(0, 4), [state.prepPlan]);
  const bestDealHeadline = state.couponMatches[0] || state.couponFeed[0]?.title || "Refresh the coupon lane";
  const storePlaybook = useMemo(() => (state.storePlan || []).slice(0, 3), [state.storePlan]);

  return (
    <div className="page">
      <PanelHeader
        panelId="GroceryMeals"
        title="🛒 Grocery Meals"
        subtitle="Meal planning + grocery list + coupon feed."
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
          <div className="small shellEyebrow">MEAL + SAVINGS COMMAND</div>
          <div className="groceryHeroTitle">Grocery Meals</div>
          <div className="small groceryHeroSub">Plan meals, build the list, pressure-test the basket, and route the run through your best store lane.</div>
        </div>
        <div className="row wrap groceryHeroBadges" style={{ justifyContent: "flex-end" }}>
          <span className={`badge ${state.cheapWeekMode ? "warn" : "good"}`}>{state.cheapWeekMode ? "Cheap week active" : "Balanced planning"}</span>
          <span className={`badge ${budgetDelta > 0 ? "warn" : "good"}`}>Basket {targetNumber ? `${estimatedListCost.toFixed(0)} / ${targetNumber.toFixed(0)}` : `$${estimatedListCost.toFixed(0)}`}</span>
          <span className="badge">Primary store {primaryStore}</span>
          <span className="badge">{couponPosture}</span>
        </div>
      </div>

      <div className="groceryMetricStrip">
        <div className="card groceryMetricCard">
          <div className="small shellEyebrow">PANTRY COVERAGE</div>
          <div className="groceryMetricValue">{pantryCoverage}%</div>
          <div className="small">{pantryCount} pantry staples already in play.</div>
        </div>
        <div className="card groceryMetricCard">
          <div className="small shellEyebrow">LIST LOAD</div>
          <div className="groceryMetricValue">{state.groceryList.length}</div>
          <div className="small">Top need: {topNeed}</div>
        </div>
        <div className="card groceryMetricCard">
          <div className="small shellEyebrow">COUPON MATCHES</div>
          <div className="groceryMetricValue">{state.couponMatches.length}</div>
          <div className="small">{state.couponFeed.length} deal items in the live lane.</div>
        </div>
        <div className="card groceryMetricCard">
          <div className="small shellEyebrow">BASKET DELTA</div>
          <div className="groceryMetricValue">{targetNumber ? `${budgetDelta >= 0 ? "+" : "-"}$${Math.abs(budgetDelta).toFixed(0)}` : `$${estimatedListCost.toFixed(0)}`}</div>
          <div className="small">{targetNumber ? (budgetDelta > 0 ? "Above goal" : "Within goal") : "Set a basket goal to track."}</div>
        </div>
      </div>

      <div className="spotlightGrid groceryFollowupGrid">
        <div className="card spotlightCard groceryFollowupCard">
          <div className="small shellEyebrow">FASTEST WIN</div>
          <div className="grocerySectionTitle">Trim the basket first</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>Start with pantry overlap, then swap the highest-cost new adds for staples or coupon-matched items before checkout.</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            <span className="badge">Top need {topNeed}</span>
            <span className={`badge ${budgetDelta > 0 ? "warn" : "good"}`}>{targetNumber ? `${budgetDelta > 0 ? "Above" : "Within"} goal` : "Goal optional"}</span>
          </div>
        </div>
        <div className="card spotlightCard groceryFollowupCard">
          <div className="small shellEyebrow">STORE PLAYBOOK</div>
          <div className="grocerySectionTitle">Route the run</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>{state.storePlan?.[0] || `Start with ${primaryStore} for staple coverage, then use the coupon lane to decide if a second stop is worth it.`}</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            <span className="badge">Primary {primaryStore}</span>
            <span className="badge">{couponPosture}</span>
          </div>
        </div>
      </div>



      <div className="groceryPrepGrid">
        <div className="card softCard grocerySectionCard">
          <div className="small shellEyebrow">FOOD PREP + PLANNING</div>
          <div className="grocerySectionTitle">Prep game plan</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>Use this as your real-life prep lane so groceries turn into ready meals instead of good intentions.</div>
          <textarea className="input mt-4" rows={6} value={state.prepPlan} onChange={(e) => persist({ ...state, prepPlan: e.target.value, lastUpdated: Date.now() })} placeholder="Cook proteins, chop veg, portion snacks, make a sauce base…" />
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            <span className="badge">Batch protein</span>
            <span className="badge">Grab-and-go snacks</span>
            <span className="badge">One flexible carb</span>
          </div>
        </div>
        <div className="card softCard grocerySectionCard">
          <div className="small shellEyebrow">AI DEAL ASSISTANT</div>
          <div className="grocerySectionTitle">Coupon + deal strategy</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>Pull a quick strategy note from your live deal lane, coupon matches, basket goal, and current list.</div>
          <div className="row wrap mt-4">
            <button className="tabBtn active" onClick={() => buildAiDealAssist()}>{state.aiDealNote ? "Refresh strategy" : "Build strategy"}</button>
            <button className="tabBtn" onClick={refreshCoupons} disabled={busy}>{busy ? "Refreshing…" : "Refresh deals"}</button>
          </div>
          <pre className="writersPlannerPreview mt-4">{state.aiDealNote || "No AI deal strategy yet. Build one after refreshing the coupon lane."}</pre>
        </div>
      </div>

      <div className="spotlightGrid groceryCommandGrid">
        <div className="card spotlightCard groceryCommandCard">
          <div className="small shellEyebrow">FOOD PREP COMMAND</div>
          <div className="grocerySectionTitle">Turn groceries into ready food</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>Build the prep lane first so the basket actually becomes breakfasts, grab-and-go lunches, and easy dinners.</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            {(prepFocus.length ? prepFocus : ["Batch protein", "Chop veg", "Portion snacks", "Make one sauce"]).map((item) => <span key={item} className="badge">{item}</span>)}
          </div>
        </div>
        <div className="card spotlightCard groceryCommandCard">
          <div className="small shellEyebrow">AI DEAL RADAR</div>
          <div className="grocerySectionTitle">Best current savings lane</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>{bestDealHeadline}</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            <span className="badge">{couponPosture}</span>
            <span className="badge">{primaryStore}</span>
            <span className={`badge ${budgetDelta > 0 ? "warn" : "good"}`}>{targetNumber ? `${budgetDelta > 0 ? "Over" : "Within"} goal` : "Goal optional"}</span>
          </div>
        </div>
        <div className="card spotlightCard groceryCommandCard">
          <div className="small shellEyebrow">RUN ROUTE</div>
          <div className="grocerySectionTitle">Store playbook</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {(storePlaybook.length ? storePlaybook : [state.storePlan?.[0] || `Start at ${primaryStore} for staples and pantry overlap.`]).map((line, idx) => <div key={idx} className="timelineCard groceryTimelineCard">{line}</div>)}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard groceryOverviewCard">
          <div className="small shellEyebrow">SHOPPING RADAR</div>
          <div className="grocerySectionTitle">Savings overview</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            <div className="timelineCard groceryTimelineCard">Pantry items: {pantryCount}</div>
            <div className="timelineCard groceryTimelineCard">Estimated basket: ${estimatedListCost.toFixed(2)}</div>
            <div className="timelineCard groceryTimelineCard">Coupon matches: {state.couponMatches.length}</div>
            <div className="timelineCard groceryTimelineCard">Mode: {state.cheapWeekMode ? "Cheap week active" : "Balanced planning"}</div>
          </div>
          <div className="groceryChecklistCard">
            <div className="small shellEyebrow">RUN CHECKLIST</div>
            <ul className="groceryListBullets">
              <li>Build the list from this week’s meals.</li>
              <li>Refresh the coupon lane before checkout.</li>
              <li>Use the price book to tighten next week’s basket.</li>
            </ul>
          </div>
        </div>

        <div className="card softCard grocerySectionCard">
          <div className="small shellEyebrow">PANTRY + COUPONS</div>
          <div className="grocerySectionTitle">Pantry + savings lane</div>
          <label className="field" style={{ marginTop: 10 }}>Pantry items
            <textarea rows={6} value={state.pantry} onChange={(e) => persist({ ...state, pantry: e.target.value, lastUpdated: Date.now() })} placeholder="List one item per line…" />
          </label>
          <label className="field">Dietary tags / notes
            <input value={state.dietaryTags} onChange={(e) => persist({ ...state, dietaryTags: e.target.value, lastUpdated: Date.now() })} placeholder="low sodium, higher protein, kid friendly…" />
          </label>
          <label className="field">Basket goal
            <input value={state.basketGoal} onChange={(e) => persist({ ...state, basketGoal: e.target.value, lastUpdated: Date.now() })} placeholder="$125 family week" />
          </label>
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <button className="tabBtn active" onClick={() => buildList()}>Build grocery list</button>
            <button className="tabBtn" onClick={refreshCoupons} disabled={busy}>{busy ? "Refreshing…" : "Refresh coupon lane"}</button>
            {hasSaverPack && <button className="tabBtn" onClick={runCheapWeek}>Cheap week</button>}
            {hasSaverPack && <button className="tabBtn" onClick={estimateBasket}>Estimate basket</button>}
            <button className="tabBtn" onClick={() => buildAiDealAssist()}>{state.aiDealNote ? "Refresh AI deals" : "AI deal assist"}</button>
          </div>
          <div className="assistantSectionTitle" style={{ marginTop: 14 }}>Live coupon links</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            {DEFAULT_COUPON_LINKS.map((link) => <button key={link.label} className="tabBtn" onClick={() => openExternalLink(link.url)}>{link.label}</button>)}
          </div>
        </div>
      </div>

      <div className="spotlightGrid groceryCommandGrid">
        <div className="card spotlightCard groceryCommandCard">
          <div className="small shellEyebrow">FOOD PREP COMMAND</div>
          <div className="grocerySectionTitle">Turn groceries into ready food</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>Build the prep lane first so the basket actually becomes breakfasts, grab-and-go lunches, and easy dinners.</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            {(prepFocus.length ? prepFocus : ["Batch protein", "Chop veg", "Portion snacks", "Make one sauce"]).map((item) => <span key={item} className="badge">{item}</span>)}
          </div>
        </div>
        <div className="card spotlightCard groceryCommandCard">
          <div className="small shellEyebrow">AI DEAL RADAR</div>
          <div className="grocerySectionTitle">Best current savings lane</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>{bestDealHeadline}</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            <span className="badge">{couponPosture}</span>
            <span className="badge">{primaryStore}</span>
            <span className={`badge ${budgetDelta > 0 ? "warn" : "good"}`}>{targetNumber ? `${budgetDelta > 0 ? "Over" : "Within"} goal` : "Goal optional"}</span>
          </div>
        </div>
        <div className="card spotlightCard groceryCommandCard">
          <div className="small shellEyebrow">RUN ROUTE</div>
          <div className="grocerySectionTitle">Store playbook</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {(storePlaybook.length ? storePlaybook : [state.storePlan?.[0] || `Start at ${primaryStore} for staples and pantry overlap.`]).map((line, idx) => <div key={idx} className="timelineCard groceryTimelineCard">{line}</div>)}
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
          <div className="grocerySectionTitle">Generated grocery list</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {state.groceryList.map((item) => <div key={item} className="timelineCard groceryTimelineCard">{item}</div>)}
            {!state.groceryList.length && <div className="small">Build the list from your meal plan to see what you still need.</div>}
          </div>
        </div>
      </div>

      {hasSaverPack && (
        <div className="grid2" style={{ alignItems: "start" }}>
          <div className="card softCard grocerySectionCard">
            <div className="small shellEyebrow">STORE ROUTING</div>
            <div className="grocerySectionTitle">Store profiles + store plan</div>
            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              {STORE_OPTIONS.map((store) => (
                <button key={store} className={`tabBtn ${state.preferredStores.includes(store) ? "active" : ""}`} onClick={() => toggleStore(store)}>{store}</button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={buildStorePlan}>Build store plan</button>
              <button className="tabBtn" onClick={() => matchCoupons()}>Match coupons</button>
            </div>
            <div className="assistantStack" style={{ marginTop: 12 }}>
              {(state.storePlan || []).map((line, idx) => <div key={idx} className="timelineCard groceryTimelineCard">{line}</div>)}
              {!state.storePlan.length && <div className="small">Select preferred stores, then build a store plan.</div>}
            </div>
          </div>
          <div className="card softCard grocerySectionCard">
            <div className="small shellEyebrow">MATCHED DEALS</div>
            <div className="grocerySectionTitle">Coupon matches</div>
            <div className="assistantStack" style={{ marginTop: 10 }}>
              {state.couponMatches.map((item) => <div key={item} className="timelineCard groceryTimelineCard">{item}</div>)}
              {!state.couponMatches.length && <div className="small">Build the list and refresh deals to surface likely coupon matches.</div>}
            </div>
          </div>
        </div>
      )}

      {hasSaverPack && (
        <div className="card softCard grocerySectionCard">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="small shellEyebrow">PRICE MEMORY</div>
              <div className="grocerySectionTitle">Price book</div>
              <div className="sub">Tune estimated prices so the basket forecast gets more real over time.</div>
            </div>
            <button className="tabBtn active" onClick={estimateBasket}>Refresh estimate</button>
          </div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {state.groceryList.map((item) => (
              <div key={item} className="timelineCard">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800 }}>{item}</div>
                  <label className="field" style={{ minWidth: 140 }}>
                    Est. price
                    <input value={String(state.priceBook[item] ?? estimateItemPrice(item))} onChange={(e) => patchPrice(item, e.target.value)} />
                  </label>
                </div>
              </div>
            ))}
            {!state.groceryList.length && <div className="small">Your generated grocery list will seed the price book automatically.</div>}
          </div>
        </div>
      )}

      <div className="card softCard grocerySectionCard">
        <div className="small shellEyebrow">LIVE DEALS</div>
        <div className="grocerySectionTitle">Coupon / deals feed</div>
        {state.lastError && <div className="small" style={{ marginTop: 8, color: "var(--warn)" }}>{state.lastError}</div>}
        <div className="assistantStack" style={{ marginTop: 10 }}>
          {state.couponFeed.slice(0, 8).map((item) => (
            <div key={item.id} className="timelineCard groceryTimelineCard">
              <div className="small">{item.source || "Deals"}{item.publishedAt ? ` • ${item.publishedAt}` : ""}</div>
              <div style={{ fontWeight: 800, marginTop: 4 }}>{item.title}</div>
              {item.summary && <div className="small" style={{ marginTop: 6 }}>{item.summary.slice(0, 180)}{item.summary.length > 180 ? "…" : ""}</div>}
              <div className="row" style={{ marginTop: 8, gap: 8 }}>
                <button className="tabBtn" onClick={() => openExternalLink(item.link)}>Open deal</button>
              </div>
            </div>
          ))}
          {!state.couponFeed.length && <div className="small">No coupon feed yet.</div>}
        </div>
      </div>
    </div>
  );
}