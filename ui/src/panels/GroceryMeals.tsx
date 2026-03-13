import React, { useEffect, useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import {
  buildGroceryBudgetMarkdown,
  buildGroceryBudgetSnapshot,
  buildGroceryBudgetSummary,
  loadGroceryBudgetSnapshot,
  money,
  saveGroceryBudgetSnapshot,
  type GroceryBudgetSnapshot,
} from "../lib/groceryBudgetBridge";
import { buildMissingInputsLabel, buildPanelConnectionStatus } from "../lib/panelConnections";

const KEY = "oddengine:groceryMeals:v2:integration";

type GroceryState = {
  shoppingListText: string;
  pantryText: string;
  basketGoal: number;
  actualSpend: number;
  estimatedSavings: number;
  couponDealCount: number;
  preferredStoresText: string;
  topNeed: string;
};

const DEFAULT_STATE: GroceryState = {
  shoppingListText: "eggs\nmilk\nchicken\nrice\nfrozen vegetables",
  pantryText: "rice\nbeans\npasta\noats\npeanut butter",
  basketGoal: 125,
  actualSpend: 92,
  estimatedSavings: 18,
  couponDealCount: 12,
  preferredStoresText: "Walmart\nSmith's/Kroger\nCostco",
  topNeed: "protein + produce",
};

function normalizeLines(text: string) {
  return text
    .split(/\r?\n|,/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function estimatePrice(item: string) {
  const low = item.toLowerCase();
  if (/(chicken|beef|fish|turkey|sausage)/.test(low)) return 7;
  if (/(milk|eggs|yogurt|cheese)/.test(low)) return 5;
  if (/(rice|beans|oats|bread|pasta|potato)/.test(low)) return 3;
  if (/(banana|apple|berry|fruit|broccoli|vegetable|salad|carrot)/.test(low)) return 4;
  return 4;
}

function calcEstimatedBasket(items: string[]) {
  return items.reduce((sum, item) => sum + estimatePrice(item), 0);
}

function calcPantryPressure(list: string[], pantry: string[]) {
  if (!list.length) return 0;
  const pantryLow = pantry.map((v) => v.toLowerCase());
  const missing = list.filter((item) => !pantryLow.includes(item.toLowerCase())).length;
  return Math.round((missing / list.length) * 100);
}

function copyText(text: string) {
  return navigator.clipboard?.writeText(text);
}

export default function GroceryMeals() {
  const [state, setState] = useState<GroceryState>(() => loadJSON<GroceryState>(KEY, DEFAULT_STATE));
  const [bridgeCopied, setBridgeCopied] = useState(false);
  const [lastSavedBridge, setLastSavedBridge] = useState<GroceryBudgetSnapshot>(() => loadGroceryBudgetSnapshot());

  const list = useMemo(() => normalizeLines(state.shoppingListText), [state.shoppingListText]);
  const pantry = useMemo(() => normalizeLines(state.pantryText), [state.pantryText]);
  const preferredStores = useMemo(() => normalizeLines(state.preferredStoresText), [state.preferredStoresText]);
  const estimatedBasket = useMemo(() => calcEstimatedBasket(list), [list]);
  const pantryPressure = useMemo(() => calcPantryPressure(list, pantry), [list, pantry]);
  const urgentRestockCount = useMemo(() => list.filter((item) => !pantry.map((v) => v.toLowerCase()).includes(item.toLowerCase())).length, [list, pantry]);
  const budgetSnapshot = useMemo(
    () =>
      buildGroceryBudgetSnapshot({
        basketGoalLabel: `${money(state.basketGoal)} family week`,
        plannedSpend: state.basketGoal,
        actualSpend: state.actualSpend,
        estimatedBasket,
        estimatedSavings: state.estimatedSavings,
        couponDealCount: state.couponDealCount,
        groceryItemCount: list.length,
        urgentRestockCount,
        pantryPressure,
        topNeed: state.topNeed,
        preferredStores,
      }),
    [state, estimatedBasket, list.length, urgentRestockCount, pantryPressure, preferredStores]
  );
  const budgetSummary = useMemo(() => buildGroceryBudgetSummary(budgetSnapshot), [budgetSnapshot]);
  const grocerySetup = useMemo(
    () => buildPanelConnectionStatus("grocery", ["providerBaseUrl", "zipCode"]),
    []
  );

  useEffect(() => {
    saveJSON(KEY, state);
  }, [state]);

  useEffect(() => {
    saveGroceryBudgetSnapshot(budgetSnapshot);
    setLastSavedBridge(budgetSnapshot);
  }, [budgetSnapshot]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card softCard">
        <div className="small shellEyebrow">CORE PANELS • DESKTOP • FAIRLYODD OS</div>
        <div className="h mt-2">🥗 Grocery Meals</div>
        <div className="sub mt-2">
          Meal planning + coupon hunting + household budget sync. This pass is wired cleanly to FamilyBudget through the grocery budget bridge.
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="card softCard">
          <div className="small shellEyebrow">BASKET GOAL</div>
          <div className="h mt-2">{money(state.basketGoal)}</div>
          <div className="small mt-2">Weekly target</div>
        </div>
        <div className="card softCard">
          <div className="small shellEyebrow">EST. BASKET</div>
          <div className="h mt-2">{money(estimatedBasket)}</div>
          <div className="small mt-2">{budgetSummary.onTrack ? "On track" : "Over target"} • {budgetSummary.budgetDeltaLabel}</div>
        </div>
        <div className="card softCard">
          <div className="small shellEyebrow">LIVE DEALS</div>
          <div className="h mt-2">{state.couponDealCount}</div>
          <div className="small mt-2">Estimated savings {money(state.estimatedSavings)}</div>
        </div>
        <div className="card softCard">
          <div className="small shellEyebrow">PANTRY PRESSURE</div>
          <div className="h mt-2">{pantryPressure}%</div>
          <div className="small mt-2">{urgentRestockCount} urgent restocks • top need {state.topNeed}</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div className="card softCard">
          <div className="small shellEyebrow">SHOPPING LIST</div>
          <textarea
            className="input mt-2"
            rows={10}
            value={state.shoppingListText}
            onChange={(e) => setState((prev) => ({ ...prev, shoppingListText: e.target.value }))}
          />
          <div className="small mt-2">{list.length} items</div>
        </div>

        <div className="card softCard">
          <div className="small shellEyebrow">PANTRY + ROUTE</div>
          <textarea
            className="input mt-2"
            rows={5}
            value={state.pantryText}
            onChange={(e) => setState((prev) => ({ ...prev, pantryText: e.target.value }))}
          />
          <textarea
            className="input mt-3"
            rows={4}
            value={state.preferredStoresText}
            onChange={(e) => setState((prev) => ({ ...prev, preferredStoresText: e.target.value }))}
          />
          <div className="small mt-2">Preferred stores: {preferredStores.join(" → ") || "None yet"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <div className="card softCard">
          <div className="small shellEyebrow">GROCERY INPUTS</div>
          <label className="small mt-2" style={{ display: "block" }}>
            Weekly basket goal
            <input
              className="input mt-2"
              type="number"
              value={state.basketGoal}
              onChange={(e) => setState((prev) => ({ ...prev, basketGoal: Number(e.target.value || 0) }))}
            />
          </label>
          <label className="small mt-3" style={{ display: "block" }}>
            Actual spend
            <input
              className="input mt-2"
              type="number"
              value={state.actualSpend}
              onChange={(e) => setState((prev) => ({ ...prev, actualSpend: Number(e.target.value || 0) }))}
            />
          </label>
        </div>

        <div className="card softCard">
          <div className="small shellEyebrow">SAVINGS SIGNAL</div>
          <label className="small mt-2" style={{ display: "block" }}>
            Estimated savings
            <input
              className="input mt-2"
              type="number"
              value={state.estimatedSavings}
              onChange={(e) => setState((prev) => ({ ...prev, estimatedSavings: Number(e.target.value || 0) }))}
            />
          </label>
          <label className="small mt-3" style={{ display: "block" }}>
            Deal count
            <input
              className="input mt-2"
              type="number"
              value={state.couponDealCount}
              onChange={(e) => setState((prev) => ({ ...prev, couponDealCount: Number(e.target.value || 0) }))}
            />
          </label>
        </div>

        <div className="card softCard">
          <div className="small shellEyebrow">TOP NEED</div>
          <input
            className="input mt-2"
            value={state.topNeed}
            onChange={(e) => setState((prev) => ({ ...prev, topNeed: e.target.value }))}
          />
          <div className="note mt-3">FamilyBudget will read this bridge and show a grocery lane without directly depending on GroceryMeals internals.</div>
        </div>
      </div>

      <div className="card softCard">
        <div className="small shellEyebrow">BRIDGE STATUS</div>
        <div className="small mt-2"><b>Last saved:</b> {lastSavedBridge.updatedAt ? new Date(lastSavedBridge.updatedAt).toLocaleString() : "Not saved yet"}</div>
        <div className="small mt-2"><b>Bridge summary:</b> {lastSavedBridge.quickSummary}</div>
        <div className="row wrap mt-3" style={{ gap: 10 }}>
          <button className="tabBtn" onClick={() => setState(DEFAULT_STATE)}>Reset Grocery lane</button>
          <button
            className="tabBtn active"
            onClick={async () => {
              await copyText(buildGroceryBudgetMarkdown(lastSavedBridge));
              setBridgeCopied(true);
              window.setTimeout(() => setBridgeCopied(false), 1200);
            }}
          >
            {bridgeCopied ? "Copied" : "Copy bridge markdown"}
          </button>
        </div>
      </div>

      <div className="card softCard">
        <div className="small shellEyebrow">PREFERENCES CONNECTION STATUS</div>
        <div className="small mt-2"><b>Status:</b> {grocerySetup.ready ? "Ready" : "Needs setup"}</div>
        <div className="small mt-2"><b>Completion:</b> {grocerySetup.completionPercent}%</div>
        <div className="small mt-2"><b>Missing:</b> {buildMissingInputsLabel(grocerySetup)}</div>
        <div className="note mt-3">Secrets still live in Preferences only. Grocery reads status and household bridge data here.</div>
      </div>
    </div>
  );
}
