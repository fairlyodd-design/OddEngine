import React, { useEffect, useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import {
  buildGroceryBudgetSummary,
  loadGroceryBudgetSnapshot,
  money,
  type GroceryBudgetSnapshot,
} from "../lib/groceryBudgetBridge";
import { buildMissingInputsLabel, buildPanelConnectionStatus } from "../lib/panelConnections";

const KEY = "oddengine:familyBudget:v3:integration";

type FamilyBudgetState = {
  monthlyIncome: number;
  fixedBills: number;
  flexibleSpend: number;
  emergencyFund: number;
  debtPayment: number;
  groceryBudgetTarget: number;
  notes: string;
};

const DEFAULT_STATE: FamilyBudgetState = {
  monthlyIncome: 4200,
  fixedBills: 2300,
  flexibleSpend: 650,
  emergencyFund: 1800,
  debtPayment: 300,
  groceryBudgetTarget: 500,
  notes: "Stabilize groceries first, then roll savings into runway.",
};

export default function FamilyBudget() {
  const [state, setState] = useState<FamilyBudgetState>(() => loadJSON<FamilyBudgetState>(KEY, DEFAULT_STATE));
  const [grocerySnapshot, setGrocerySnapshot] = useState<GroceryBudgetSnapshot>(() => loadGroceryBudgetSnapshot());

  useEffect(() => {
    saveJSON(KEY, state);
  }, [state]);

  useEffect(() => {
    const sync = () => setGrocerySnapshot(loadGroceryBudgetSnapshot());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const grocerySummary = useMemo(() => buildGroceryBudgetSummary(grocerySnapshot), [grocerySnapshot]);
  const familySetup = useMemo(() => buildPanelConnectionStatus("money-budget", ["householdProvider", "budgetMode"]), []);
  const freeCash = useMemo(
    () => state.monthlyIncome - state.fixedBills - state.flexibleSpend - state.debtPayment,
    [state]
  );
  const groceryMonthlyPlan = useMemo(() => Math.max(state.groceryBudgetTarget, grocerySnapshot.plannedSpend * 4), [state.groceryBudgetTarget, grocerySnapshot.plannedSpend]);
  const groceryMonthlyActual = useMemo(() => Math.max(grocerySnapshot.actualSpend * 4, grocerySnapshot.estimatedBasket * 4), [grocerySnapshot]);
  const groceryMonthlySavings = useMemo(() => grocerySnapshot.estimatedSavings * 4, [grocerySnapshot]);
  const runwayLift = useMemo(() => freeCash + groceryMonthlySavings, [freeCash, groceryMonthlySavings]);
  const householdWarPriority = grocerySummary.overBudget ? "Re-center grocery basket" : "Protect free cash and stack grocery wins";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card softCard">
        <div className="small shellEyebrow">ODDENGINE • DESKTOP • FAIRLYODD OS</div>
        <div className="h mt-2">🏠 Family Budget</div>
        <div className="sub mt-2">Household cashflow + goals, now cleanly synced to Grocery Meals through the grocery budget bridge.</div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="card softCard">
          <div className="small shellEyebrow">MONTHLY INCOME</div>
          <div className="h mt-2">{money(state.monthlyIncome)}</div>
          <div className="small mt-2">Household gross inflow</div>
        </div>
        <div className="card softCard">
          <div className="small shellEyebrow">FREE CASH</div>
          <div className="h mt-2">{money(freeCash)}</div>
          <div className="small mt-2">After bills, flex spend, and debt plan</div>
        </div>
        <div className="card softCard">
          <div className="small shellEyebrow">EMERGENCY FUND</div>
          <div className="h mt-2">{money(state.emergencyFund)}</div>
          <div className="small mt-2">Current reserve</div>
        </div>
        <div className="card softCard">
          <div className="small shellEyebrow">RUNWAY LIFT</div>
          <div className="h mt-2">{money(runwayLift)}</div>
          <div className="small mt-2">Free cash plus grocery savings signal</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div className="card softCard">
          <div className="small shellEyebrow">HOUSEHOLD INPUTS</div>
          <label className="small mt-2" style={{ display: "block" }}>
            Monthly income
            <input className="input mt-2" type="number" value={state.monthlyIncome} onChange={(e) => setState((p) => ({ ...p, monthlyIncome: Number(e.target.value || 0) }))} />
          </label>
          <label className="small mt-3" style={{ display: "block" }}>
            Fixed bills
            <input className="input mt-2" type="number" value={state.fixedBills} onChange={(e) => setState((p) => ({ ...p, fixedBills: Number(e.target.value || 0) }))} />
          </label>
          <label className="small mt-3" style={{ display: "block" }}>
            Flexible spend
            <input className="input mt-2" type="number" value={state.flexibleSpend} onChange={(e) => setState((p) => ({ ...p, flexibleSpend: Number(e.target.value || 0) }))} />
          </label>
          <label className="small mt-3" style={{ display: "block" }}>
            Debt payment
            <input className="input mt-2" type="number" value={state.debtPayment} onChange={(e) => setState((p) => ({ ...p, debtPayment: Number(e.target.value || 0) }))} />
          </label>
        </div>

        <div className="card softCard">
          <div className="small shellEyebrow">GROCERY LANE</div>
          <div className="small mt-2"><b>Status:</b> {grocerySnapshot.statusLabel}</div>
          <div className="small mt-2"><b>Weekly plan:</b> {money(grocerySnapshot.plannedSpend)}</div>
          <div className="small mt-2"><b>Weekly actual:</b> {money(grocerySnapshot.actualSpend)}</div>
          <div className="small mt-2"><b>Estimated basket:</b> {money(grocerySnapshot.estimatedBasket)}</div>
          <div className="small mt-2"><b>Monthly target:</b> {money(groceryMonthlyPlan)}</div>
          <div className="small mt-2"><b>Monthly actualized:</b> {money(groceryMonthlyActual)}</div>
          <div className="small mt-2"><b>Estimated monthly savings:</b> {money(groceryMonthlySavings)}</div>
          <div className="small mt-2"><b>Delta to plan:</b> {grocerySummary.budgetDeltaLabel}</div>
          <div className="small mt-2"><b>Top need:</b> {grocerySnapshot.topNeed}</div>
          <div className="small mt-2"><b>Preferred stores:</b> {grocerySnapshot.preferredStores.join(" → ") || "None"}</div>
          <div className="note mt-3">Open Grocery Meals to update the shopping list and deal lane. FamilyBudget only reads the shared bridge, not panel-local variables.</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className="card softCard">
          <div className="small shellEyebrow">WAR ROOM PRIORITY</div>
          <div className="h mt-2">{householdWarPriority}</div>
          <div className="small mt-2">{grocerySummary.overBudget
            ? `Grocery lane is running ${grocerySummary.budgetDeltaLabel.replace("+", "-")} off target.`
            : `Grocery lane is on track and contributing ${money(groceryMonthlySavings)} in projected monthly savings.`}</div>
        </div>
        <div className="card softCard">
          <div className="small shellEyebrow">HOUSEHOLD NOTE</div>
          <textarea className="input mt-2" rows={6} value={state.notes} onChange={(e) => setState((p) => ({ ...p, notes: e.target.value }))} />
        </div>
      </div>

      <div className="card softCard">
        <div className="small shellEyebrow">PREFERENCES CONNECTION STATUS</div>
        <div className="small mt-2"><b>Status:</b> {familySetup.ready ? "Ready" : "Needs setup"}</div>
        <div className="small mt-2"><b>Completion:</b> {familySetup.completionPercent}%</div>
        <div className="small mt-2"><b>Missing:</b> {buildMissingInputsLabel(familySetup)}</div>
        <div className="note mt-3">Secrets and providers still live in Preferences. FamilyBudget only consumes setup status plus the grocery budget bridge snapshot.</div>
      </div>
    </div>
  );
}
