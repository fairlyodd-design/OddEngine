import { loadJSON, saveJSON } from "./storage";

export const GROCERY_BUDGET_BRIDGE_KEY = "oddengine:groceryBudgetBridge:v1";

export type GroceryBudgetSnapshot = {
  updatedAt: number;
  basketGoalLabel: string;
  plannedSpend: number;
  actualSpend: number;
  estimatedBasket: number;
  estimatedSavings: number;
  couponDealCount: number;
  groceryItemCount: number;
  urgentRestockCount: number;
  pantryPressure: number;
  topNeed: string;
  preferredStores: string[];
  quickSummary: string;
  statusLabel: string;
};

export const DEFAULT_GROCERY_BUDGET_SNAPSHOT: GroceryBudgetSnapshot = {
  updatedAt: 0,
  basketGoalLabel: "$125 family week",
  plannedSpend: 125,
  actualSpend: 0,
  estimatedBasket: 0,
  estimatedSavings: 0,
  couponDealCount: 0,
  groceryItemCount: 0,
  urgentRestockCount: 0,
  pantryPressure: 0,
  topNeed: "Refresh shopping list",
  preferredStores: ["Walmart", "Smith's/Kroger"],
  quickSummary: "No grocery signal saved yet.",
  statusLabel: "Needs planning",
};

export function loadGroceryBudgetSnapshot(): GroceryBudgetSnapshot {
  const raw = loadJSON<Partial<GroceryBudgetSnapshot> | null>(GROCERY_BUDGET_BRIDGE_KEY, null);
  return { ...DEFAULT_GROCERY_BUDGET_SNAPSHOT, ...(raw || {}) };
}

export function saveGroceryBudgetSnapshot(snapshot: GroceryBudgetSnapshot) {
  saveJSON(GROCERY_BUDGET_BRIDGE_KEY, snapshot);
}

export function buildGroceryBudgetSnapshot(input: {
  basketGoalLabel?: string;
  plannedSpend?: number;
  actualSpend?: number;
  estimatedBasket?: number;
  estimatedSavings?: number;
  couponDealCount?: number;
  groceryItemCount?: number;
  urgentRestockCount?: number;
  pantryPressure?: number;
  topNeed?: string;
  preferredStores?: string[];
}): GroceryBudgetSnapshot {
  const plannedSpend = Math.max(0, Number(input.plannedSpend ?? DEFAULT_GROCERY_BUDGET_SNAPSHOT.plannedSpend));
  const actualSpend = Math.max(0, Number(input.actualSpend ?? DEFAULT_GROCERY_BUDGET_SNAPSHOT.actualSpend));
  const estimatedBasket = Math.max(0, Number(input.estimatedBasket ?? actualSpend));
  const estimatedSavings = Math.max(0, Number(input.estimatedSavings ?? 0));
  const pantryPressure = Math.max(0, Math.min(100, Number(input.pantryPressure ?? 0)));
  const urgentRestockCount = Math.max(0, Number(input.urgentRestockCount ?? 0));
  const couponDealCount = Math.max(0, Number(input.couponDealCount ?? 0));
  const groceryItemCount = Math.max(0, Number(input.groceryItemCount ?? 0));
  const budgetDelta = plannedSpend - estimatedBasket;

  let statusLabel = "On track";
  if (urgentRestockCount >= 4 || pantryPressure >= 70) statusLabel = "Restock pressure";
  if (budgetDelta < 0) statusLabel = "Over target";
  if (couponDealCount >= 5 && budgetDelta >= 0) statusLabel = "Savings lane ready";

  const summaryBits = [
    `Plan ${money(plannedSpend)}`,
    `basket ${money(estimatedBasket)}`,
    couponDealCount ? `${couponDealCount} deals` : "no live deals yet",
  ];

  return {
    updatedAt: Date.now(),
    basketGoalLabel: input.basketGoalLabel || `${money(plannedSpend)} family week`,
    plannedSpend,
    actualSpend,
    estimatedBasket,
    estimatedSavings,
    couponDealCount,
    groceryItemCount,
    urgentRestockCount,
    pantryPressure,
    topNeed: input.topNeed || DEFAULT_GROCERY_BUDGET_SNAPSHOT.topNeed,
    preferredStores: input.preferredStores?.length ? input.preferredStores : DEFAULT_GROCERY_BUDGET_SNAPSHOT.preferredStores,
    quickSummary: summaryBits.join(" • "),
    statusLabel,
  };
}

export function buildGroceryBudgetSummary(snapshot: GroceryBudgetSnapshot) {
  const budgetDelta = snapshot.plannedSpend - snapshot.estimatedBasket;
  return {
    budgetDelta,
    budgetDeltaLabel: `${budgetDelta >= 0 ? "+" : "-"}${money(Math.abs(budgetDelta))}`,
    overBudget: budgetDelta < 0,
    onTrack: budgetDelta >= 0,
  };
}

export function buildGroceryBudgetMarkdown(snapshot: GroceryBudgetSnapshot) {
  const summary = buildGroceryBudgetSummary(snapshot);
  return [
    "# Grocery Budget Bridge",
    "",
    `Updated: ${snapshot.updatedAt ? new Date(snapshot.updatedAt).toLocaleString() : "Not saved yet"}`,
    `Status: ${snapshot.statusLabel}`,
    `Basket goal: ${snapshot.basketGoalLabel}`,
    `Planned spend: ${money(snapshot.plannedSpend)}`,
    `Actual spend: ${money(snapshot.actualSpend)}`,
    `Estimated basket: ${money(snapshot.estimatedBasket)}`,
    `Estimated savings: ${money(snapshot.estimatedSavings)}`,
    `Budget delta: ${summary.budgetDeltaLabel}`,
    `Coupon / deal count: ${snapshot.couponDealCount}`,
    `Grocery item count: ${snapshot.groceryItemCount}`,
    `Urgent restock count: ${snapshot.urgentRestockCount}`,
    `Pantry pressure: ${snapshot.pantryPressure}%`,
    `Top need: ${snapshot.topNeed}`,
    `Preferred stores: ${snapshot.preferredStores.join(", ") || "None"}`,
    "",
    snapshot.quickSummary,
  ].join("\n");
}

export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}
