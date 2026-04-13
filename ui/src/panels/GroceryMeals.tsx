import React, { useEffect, useMemo, useState } from "react";
import { acknowledgePanelAction, getPanelActions, PANEL_ACTION_EVENT } from "../lib/brain";
import { normalizeBoolean, normalizeNumber, normalizeString, normalizeStringArray, loadGuardedState, saveGuardedState, toRecord } from "../lib/stateGuard";
import { pushNotif } from "../lib/notifs";
import { DEFAULT_COUPON_LINKS, FeedItem, fetchNewsFeed, openExternalLink } from "../lib/webData";
import PluginMiniWidgets from "../components/PluginMiniWidgets";
import { UPGRADE_PACKS_EVENT, isUpgradePackInstalled } from "../lib/plugins";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import { addQuickEvent, fmtDate } from "../lib/calendarStore";
import { buildGroceryMealsCommand, estimateItemPrice, GroceryState as GroceryCommandState } from "../lib/groceryMealsCommand";

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
  lastUpdated?: number;
  lastError?: string;
};

const KEY = "oddengine:groceryMeals:v1";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STORE_OPTIONS = ["Walmart", "Smith's/Kroger", "Albertsons/Vons", "Costco", "Target"];
const defaultState: GroceryState = {
  pantry: `rice\neggs\nfrozen vegetables`,
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
};

const STATE_VERSION = "10.35.2";

function sanitizeMeal(raw: unknown): MealPlan {
  const rec = toRecord(raw);
  return {
    day: normalizeString(rec.day) || "Day",
    breakfast: normalizeString(rec.breakfast),
    lunch: normalizeString(rec.lunch),
    dinner: normalizeString(rec.dinner),
    snacks: normalizeString(rec.snacks),
  };
}

function sanitizeFeedItem(raw: unknown): FeedItem | null {
  const rec = toRecord(raw);
  const title = normalizeString(rec.title);
  const link = normalizeString(rec.link);
  if (!title || !link) return null;
  return {
    id: normalizeString(rec.id) || `${title}-${link}`,
    title,
    link,
    source: normalizeString(rec.source) || undefined,
    publishedAt: normalizeString(rec.publishedAt) || undefined,
    summary: normalizeString(rec.summary) || undefined,
  };
}

function sanitizePriceBook(raw: unknown): Record<string, number> {
  const rec = toRecord(raw);
  const out: Record<string, number> = {};
  Object.entries(rec).forEach(([key, value]) => {
    const cleanKey = String(key || "").trim();
    if (!cleanKey) return;
    out[cleanKey] = Number(normalizeNumber(value, estimateItemPrice(cleanKey)).toFixed(2));
  });
  return out;
}

function sanitizeState(raw: unknown, fallback: GroceryState = defaultState): GroceryState {
  const rec = toRecord(raw);
  const meals = Array.isArray(rec.meals) ? rec.meals.map(sanitizeMeal).slice(0, DAYS.length) : fallback.meals;
  while (meals.length < DAYS.length) {
    meals.push({ day: DAYS[meals.length], breakfast: "", lunch: "", dinner: "", snacks: "" });
  }
  meals.forEach((meal, idx) => { meal.day = DAYS[idx]; });

  return {
    pantry: normalizeString(rec.pantry, fallback.pantry),
    dietaryTags: normalizeString(rec.dietaryTags, fallback.dietaryTags),
    meals,
    groceryList: normalizeStringArray(rec.groceryList),
    couponFeed: Array.isArray(rec.couponFeed) ? rec.couponFeed.map(sanitizeFeedItem).filter(Boolean) as FeedItem[] : [],
    cheapWeekMode: normalizeBoolean(rec.cheapWeekMode, false),
    preferredStores: normalizeStringArray(rec.preferredStores).length ? normalizeStringArray(rec.preferredStores) : fallback.preferredStores,
    couponMatches: normalizeStringArray(rec.couponMatches),
    priceBook: sanitizePriceBook(rec.priceBook),
    storePlan: normalizeStringArray(rec.storePlan),
    basketGoal: normalizeString(rec.basketGoal, fallback.basketGoal),
    lastUpdated: normalizeNumber(rec.lastUpdated, fallback.lastUpdated || Date.now()),
    lastError: normalizeString(rec.lastError),
  };
}

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
  const [state, setState] = useState<GroceryState>(() => loadGuardedState<GroceryState>({ key: KEY, version: STATE_VERSION, defaultState, sanitize: sanitizeState }));
  const [busy, setBusy] = useState(false);
  const [pluginTick, setPluginTick] = useState(0);
  const hasSaverPack = isUpgradePackInstalled("grocery-saver-pack");

  function persist(next: GroceryState) {
    setState(next);
    saveGuardedState(KEY, STATE_VERSION, next);
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
    if (push) persist(next); else { setState(next); saveGuardedState(KEY, STATE_VERSION, next); }
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

  function runCommandAction(actionId: string) {
    if (actionId === "build-list") buildList();
    if (actionId === "refresh-coupons") refreshCoupons();
    if (actionId === "estimate-basket") estimateBasket();
    if (actionId === "cheap-week") runCheapWeek();
    if (actionId === "store-plan") buildStorePlan();
    if (actionId === "match-coupons") matchCoupons();
  }

  useEffect(() => { if (!state.couponFeed.length) refreshCoupons(); }, []);

  useEffect(() => {
    const pluginHandler = () => setPluginTick((v) => v + 1);
    window.addEventListener(UPGRADE_PACKS_EVENT, pluginHandler as EventListener);
    return () => window.removeEventListener(UPGRADE_PACKS_EVENT, pluginHandler as EventListener);
  }, []);

  useEffect(() => {
    const sanitized = sanitizeState(state);
    const changed = JSON.stringify(sanitized) !== JSON.stringify(state);
    if (changed) {
      setState(sanitized);
      saveGuardedState(KEY, STATE_VERSION, sanitized);
      pushNotif("Grocery Meals cleaned up older saved data so the list can render safely.");
    }
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
  const command = useMemo(() => buildGroceryMealsCommand(state as GroceryCommandState, hasSaverPack), [state, hasSaverPack]);

  return (
    <div className="page">
      <PanelHeader
        panelId="GroceryMeals"
        title="🛒 Grocery Meals"
        subtitle="Family food, savings, meal planning, and substitution lane."
        storagePrefix="oddengine:groceryMeals"
        storageActionsMode="menu"
        badges={[
          { label: `${state.groceryList.length} needed`, tone: state.groceryList.length ? "warn" : "good" },
          { label: `Pantry ${command.pantryCoverage}%`, tone: command.pantryCoverage >= 70 ? "good" : command.pantryCoverage >= 40 ? "warn" : "bad" },
          { label: `Est. $${command.estimatedCost.toFixed(0)}${command.targetNumber ? ` vs goal $${command.targetNumber.toFixed(0)}` : ""}`, tone: command.budgetDelta > 0 ? "warn" : "good" },
          ...(hasSaverPack ? [{ label: "Saver pack active", tone: "good" as const }] : []),
        ]}
        rightSlot={
          <ActionMenu
            title="Grocery tools"
            items={[
              { label: "Open Calendar", onClick: () => onNavigate?.("Calendar") },
              { label: "Add grocery run", onClick: () => { const d = prompt("Date (YYYY-MM-DD)", fmtDate(new Date())); if(!d) return; addQuickEvent({ title: "Grocery run", panelId: "GroceryMeals", date: d, notes: `Basket goal: ${state.basketGoal || "—"}` }); } },
              { label: "Add meal prep session", onClick: () => { const d = prompt("Date (YYYY-MM-DD)", fmtDate(new Date())); if(!d) return; addQuickEvent({ title: "Meal prep", panelId: "GroceryMeals", date: d, notes: "Prep proteins + chop veg + portion snacks." }); } },
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

      <div className="card heroCard missionHero">
        <div className="small shellEyebrow">FAMILY FOOD COMMAND</div>
        <div className="h">What matters today</div>
        <div className="sub">{command.whatMattersToday}</div>
        <div className="assistantChipWrap" style={{ marginTop: 12 }}>
          <span className={`badge ${command.doThisNow.tone}`}>{command.doThisNow.title}</span>
          <span className="badge">Pantry items {pantryCount}</span>
          <span className={`badge ${state.cheapWeekMode ? "warn" : "good"}`}>{state.cheapWeekMode ? "Cheap week active" : "Balanced week"}</span>
        </div>
        <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
          <button className="tabBtn active" onClick={() => runCommandAction(command.doThisNow.actionId)}>{command.doThisNow.title}</button>
          <button className="tabBtn" onClick={() => buildList()}>Build grocery list</button>
          <button className="tabBtn" onClick={() => refreshCoupons()} disabled={busy}>{busy ? "Refreshing…" : "Refresh coupon lane"}</button>
          {hasSaverPack && <button className="tabBtn" onClick={() => estimateBasket()}>Estimate basket</button>}
        </div>
        {state.lastError && <div className="small" style={{ marginTop: 8, color: "var(--warn)" }}>{state.lastError}</div>}
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard">
          <div className="h">Do this now</div>
          <div className={`timelineCard ${command.doThisNow.tone === "bad" ? "warn" : ""}`} style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 800 }}>{command.doThisNow.title}</div>
            <div className="small" style={{ marginTop: 6 }}>{command.doThisNow.body}</div>
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={() => runCommandAction(command.doThisNow.actionId)}>Run now</button>
              {hasSaverPack && <button className="tabBtn" onClick={() => buildStorePlan()}>Store plan</button>}
            </div>
          </div>
          <div className="assistantSectionTitle" style={{ marginTop: 14 }}>Trusted route note</div>
          <div className="timelineCard" style={{ marginTop: 10 }}>{command.trustedRouteNote}</div>
        </div>

        <div className="card softCard">
          <div className="h">Family food queue</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {command.actionQueue.map((item) => (
              <div key={item.id} className={`timelineCard ${item.tone === "bad" ? "warn" : ""}`}>
                <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.title}</div>
                    <div className="small" style={{ marginTop: 6 }}>{item.body}</div>
                  </div>
                  <button className="tabBtn active" onClick={() => runCommandAction(item.actionId)}>Run</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard" data-no-drag="true" data-no-snap="true">
          <div className="h">Staples + pantry status</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            {command.stapleStatus.map((item) => (
              <span key={item.label} className={`badge ${item.state === "ready" ? "good" : item.state === "low" ? "warn" : "bad"}`}>{item.label}</span>
            ))}
          </div>
          <label className="field" style={{ marginTop: 12 }}>Pantry items
            <textarea rows={6} value={state.pantry} onChange={(e) => persist({ ...state, pantry: e.target.value, lastUpdated: Date.now() })} placeholder="List one item per line…" />
          </label>
          <label className="field">Dietary tags / notes
            <input value={state.dietaryTags} onChange={(e) => persist({ ...state, dietaryTags: e.target.value, lastUpdated: Date.now() })} placeholder="low sodium, higher protein, kid friendly…" />
          </label>
          <label className="field">Basket goal
            <input value={state.basketGoal} onChange={(e) => persist({ ...state, basketGoal: e.target.value, lastUpdated: Date.now() })} placeholder="$125 family week" />
          </label>
        </div>

        <div className="card softCard" data-no-drag="true" data-no-snap="true">
          <div className="h">Meal ideas from what you already have</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {command.mealIdeas.map((idea) => (
              <div key={idea.title} className="timelineCard">
                <div style={{ fontWeight: 800 }}>{idea.title}</div>
                <div className="small" style={{ marginTop: 6 }}>{idea.why}</div>
                <div className="assistantChipWrap" style={{ marginTop: 8 }}>
                  {idea.ingredients.map((ingredient) => <span key={ingredient} className="badge">{ingredient}</span>)}
                </div>
              </div>
            ))}
          </div>
          <div className="assistantSectionTitle" style={{ marginTop: 14 }}>Money-saving substitutions</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {command.substitutions.map((item) => (
              <div key={item.need} className="timelineCard">
                <div style={{ fontWeight: 800 }}>{item.need} → {item.swap}</div>
                <div className="small" style={{ marginTop: 6 }}>{item.why}</div>
              </div>
            ))}
            {!command.substitutions.length && <div className="small">Build the grocery list first to surface substitution ideas.</div>}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard" data-no-drag="true" data-no-snap="true">
          <div className="h">Weekly meal plan</div>
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

        <div className="card softCard" data-no-drag="true" data-no-snap="true">
          <div className="h">Generated grocery list</div>
          <div className="assistantChipWrap" style={{ marginTop: 10 }}>
            {command.mustBuyNow.map((item) => <span key={item} className="badge warn">{item}</span>)}
          </div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {state.groceryList.map((item) => <div key={item} className="timelineCard">{item}</div>)}
            {!state.groceryList.length && <div className="small">Build the list from your meal plan to see what you still need.</div>}
          </div>
        </div>
      </div>

      {hasSaverPack && (
        <div className="grid2" style={{ alignItems: "start" }}>
          <div className="card softCard" data-no-drag="true" data-no-snap="true">
            <div className="h">Store profiles + store plan</div>
            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              {STORE_OPTIONS.map((store) => (
                <button key={store} className={`tabBtn ${state.preferredStores.includes(store) ? "active" : ""}`} onClick={() => toggleStore(store)}>{store}</button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={buildStorePlan}>Build store plan</button>
              <button className="tabBtn" onClick={() => matchCoupons()}>Match coupons</button>
              <button className="tabBtn" onClick={runCheapWeek}>Cheap week</button>
            </div>
            <div className="assistantStack" style={{ marginTop: 12 }}>
              {(state.storePlan || []).map((line, idx) => <div key={idx} className="timelineCard">{line}</div>)}
              {!state.storePlan.length && <div className="small">Select preferred stores, then build a store plan.</div>}
            </div>
          </div>
          <div className="card softCard" data-no-drag="true" data-no-snap="true">
            <div className="h">Coupon matches</div>
            <div className="assistantStack" style={{ marginTop: 10 }}>
              {state.couponMatches.map((item) => <div key={item} className="timelineCard">{item}</div>)}
              {!state.couponMatches.length && <div className="small">Build the list and refresh deals to surface likely coupon matches.</div>}
            </div>
          </div>
        </div>
      )}

      {hasSaverPack && (
        <div className="card softCard" data-no-drag="true" data-no-snap="true">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="h">Price book</div>
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

      <div className="card softCard" data-no-drag="true" data-no-snap="true">
        <div className="h">Coupon / deals feed</div>
        <div className="assistantChipWrap" style={{ marginTop: 10 }}>
          {DEFAULT_COUPON_LINKS.map((link) => <button key={link.label} className="tabBtn" onClick={() => openExternalLink(link.url)}>{link.label}</button>)}
        </div>
        {state.lastError && <div className="small" style={{ marginTop: 8, color: "var(--warn)" }}>{state.lastError}</div>}
        <div className="assistantStack" style={{ marginTop: 10 }}>
          {state.couponFeed.slice(0, 8).map((item) => (
            <div key={item.id} className="timelineCard">
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
