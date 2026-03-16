import React, { useMemo, useState } from "react";
import {
  DEFAULT_GROCERY_ITEMS,
  DEFAULT_MEAL_PLANS,
  DEFAULT_RETAILERS,
  DEFAULT_SWAGBUCKS_STORES,
  buildBestBasket,
  buildCouponConfidence,
  buildDealHighlights,
  buildMealSuggestions,
  buildRetailerSummaries,
  buildSwapSuggestions,
  formatMoney,
} from "../lib/householdSavings";

type Tab = "basket" | "meals" | "compare" | "cashback";

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.035)",
  borderRadius: 16,
  padding: 14,
};

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
  borderRadius: 12,
  padding: "10px 12px",
};

function toneStyle(tone: "green" | "yellow" | "red") {
  if (tone === "green") return { background: "rgba(94,201,111,0.16)", borderColor: "rgba(94,201,111,0.28)" };
  if (tone === "yellow") return { background: "rgba(255,197,61,0.16)", borderColor: "rgba(255,197,61,0.28)" };
  return { background: "rgba(255,111,97,0.16)", borderColor: "rgba(255,111,97,0.28)" };
}

function Pill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tabBtn ${active ? "active" : ""}`}
      style={{ borderRadius: 999, padding: "8px 12px" }}
    >
      {children}
    </button>
  );
}

export default function GroceryMeals() {
  const [tab, setTab] = useState<Tab>("basket");

  const basket = useMemo(() => buildBestBasket(DEFAULT_GROCERY_ITEMS, DEFAULT_RETAILERS), []);
  const retailerSummaries = useMemo(() => buildRetailerSummaries(DEFAULT_GROCERY_ITEMS, DEFAULT_RETAILERS), []);
  const mealSuggestions = useMemo(() => buildMealSuggestions(DEFAULT_MEAL_PLANS, DEFAULT_RETAILERS), []);
  const swapSuggestions = useMemo(() => buildSwapSuggestions(DEFAULT_GROCERY_ITEMS, DEFAULT_RETAILERS), []);
  const highlights = useMemo(() => buildDealHighlights(DEFAULT_RETAILERS), []);

  return (
    <div className="stack">
      <div className="card softCard" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="small shellEyebrow">Household savings engine</div>
            <div className="h">Grocery Meals</div>
            <div className="sub">
              Cleaner basket logic, smarter store compare, meal-to-cart value, and a safer Swagbucks lane.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ ...card, minWidth: 128 }}>
              <div className="small">Mixed basket</div>
              <b>{formatMoney(basket.total)}</b>
            </div>
            <div style={{ ...card, minWidth: 128 }}>
              <div className="small">Estimated savings</div>
              <b>{formatMoney(basket.estimatedSavings)}</b>
            </div>
            <div style={{ ...card, minWidth: 128 }}>
              <div className="small">Best single store</div>
              <b>{basket.bestSingleStore ? basket.bestSingleStore.retailerName : "n/a"}</b>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill active={tab === "basket"} onClick={() => setTab("basket")}>Best basket</Pill>
          <Pill active={tab === "meals"} onClick={() => setTab("meals")}>Meal plans</Pill>
          <Pill active={tab === "compare"} onClick={() => setTab("compare")}>Store compare</Pill>
          <Pill active={tab === "cashback"} onClick={() => setTab("cashback")}>Swagbucks lane</Pill>
        </div>
      </div>

      {tab === "basket" ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(320px,0.95fr)", gap: 12 }}>
          <div className="stack">
            <div className="card softCard">
              <div className="small shellEyebrow">Cheapest current basket</div>
              <div className="h">Best basket this week</div>
              <div className="sub" style={{ marginTop: 4 }}>
                Mixed basket logic finds the cheapest visible item lane instead of forcing one store.
              </div>

              <div className="stack" style={{ marginTop: 10 }}>
                {basket.mixedBasket.map((line) => (
                  <div style={row} key={line.item}>
                    <div>
                      <strong>{line.item}</strong>
                      <div className="muted">{line.retailerName}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <strong>{formatMoney(line.price)}</strong>
                      <span
                        style={{
                          borderRadius: 999,
                          padding: "4px 8px",
                          fontSize: 11,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.05)",
                        }}
                      >
                        {line.couponLabel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card softCard">
              <div className="small shellEyebrow">High-value changes</div>
              <div className="h">Swap suggestions</div>
              <div className="stack" style={{ marginTop: 10 }}>
                {swapSuggestions.map((swap) => (
                  <div style={row} key={`${swap.item}-${swap.toRetailer}`}>
                    <div>
                      <strong>{swap.item}</strong>
                      <div className="muted">{swap.note}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong>{formatMoney(swap.saveAmount)}</strong>
                      <div className="muted">{swap.fromRetailer} → {swap.toRetailer}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="stack">
            <div className="card softCard">
              <div className="small shellEyebrow">Coupon confidence</div>
              <div className="h">Stack lanes</div>
              <div className="stack" style={{ marginTop: 10 }}>
                {DEFAULT_RETAILERS.map((retailer) => {
                  const confidence = buildCouponConfidence(retailer);
                  return (
                    <div style={row} key={retailer.id}>
                      <div>
                        <strong>{retailer.name}</strong>
                        <div className="muted">{confidence.note}</div>
                      </div>
                      <span
                        style={{
                          borderRadius: 999,
                          padding: "5px 8px",
                          fontSize: 11,
                          border: "1px solid rgba(255,255,255,0.08)",
                          ...toneStyle(confidence.tone),
                        }}
                      >
                        {confidence.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card softCard">
              <div className="small shellEyebrow">Biggest visible deals</div>
              <div className="h">Weekly highlights</div>
              <div className="stack" style={{ marginTop: 10 }}>
                {highlights.map((deal) => (
                  <div style={row} key={`${deal.retailerName}-${deal.title}`}>
                    <div>
                      <strong>{deal.title}</strong>
                      <div className="muted">{deal.retailerName} · {deal.category}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong>{formatMoney(deal.price)}</strong>
                      <div className="muted">save {formatMoney(deal.savings)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "meals" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
          {mealSuggestions.map((meal) => (
            <div className="card softCard" key={meal.id}>
              <div className="small shellEyebrow">Meal-value lane</div>
              <div className="h">{meal.name}</div>
              <div className="sub" style={{ marginTop: 4 }}>
                Best lane now: {meal.bestRetailerName}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <div style={{ ...card, minWidth: 120 }}>
                  <div className="small">Estimated meal cost</div>
                  <b>{formatMoney(meal.estimatedCost)}</b>
                </div>
                <div style={{ ...card, minWidth: 120 }}>
                  <div className="small">Potential savings</div>
                  <b>{formatMoney(meal.potentialSavings)}</b>
                </div>
              </div>

              <div className="stack" style={{ marginTop: 10 }}>
                {meal.ingredients.map((ingredient) => (
                  <div style={row} key={`${meal.id}-${ingredient}`}>
                    <strong>{ingredient}</strong>
                    <span className="muted">{meal.itemRetailers[ingredient]}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {meal.notes.map((note) => (
                  <span
                    key={note}
                    style={{
                      borderRadius: 999,
                      padding: "4px 8px",
                      fontSize: 11,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.05)",
                    }}
                  >
                    {note}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "compare" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
          {retailerSummaries.map((summary) => (
            <div className="card softCard" key={summary.retailerId}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div className="h">{summary.retailerName}</div>
                  <div className="sub">{summary.confidence.note}</div>
                </div>
                <span
                  style={{
                    borderRadius: 999,
                    padding: "5px 8px",
                    fontSize: 11,
                    border: "1px solid rgba(255,255,255,0.08)",
                    ...toneStyle(summary.confidence.tone),
                  }}
                >
                  {summary.confidence.label}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginTop: 10 }}>
                <div style={card}>
                  <div className="small">Basket total</div>
                  <b>{formatMoney(summary.basketTotal)}</b>
                </div>
                <div style={card}>
                  <div className="small">Savings</div>
                  <b>{formatMoney(summary.savings)}</b>
                </div>
                <div style={card}>
                  <div className="small">Online-only</div>
                  <b>{summary.onlineOnlyCount}</b>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "cashback" ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(300px,0.9fr)", gap: 12 }}>
          <div className="card softCard">
            <div className="small shellEyebrow">Swagbucks lane</div>
            <div className="h">Cash-back guide</div>
            <div className="sub" style={{ marginTop: 4 }}>
              Use this lane only when an online order actually makes sense and you can start the session there cleanly.
            </div>

            <div className="stack" style={{ marginTop: 10 }}>
              {DEFAULT_SWAGBUCKS_STORES.map((store) => (
                <div style={row} key={store.id}>
                  <div>
                    <strong>{store.name}</strong>
                    <div className="muted">{store.bestUse}</div>
                  </div>
                  <span
                    style={{
                      borderRadius: 999,
                      padding: "5px 8px",
                      fontSize: 11,
                      border: "1px solid rgba(255,255,255,0.08)",
                      ...toneStyle(store.stackConfidence),
                    }}
                  >
                    {store.cashbackRate.toFixed(1)}% back
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">Smart rules</div>
            <div className="h">Protect the cash-back lane</div>
            <div className="stack" style={{ marginTop: 10 }}>
              {[
                "Start at Swagbucks first so the shopping session can track properly.",
                "Prefer official store coupons. Random third-party codes can break rewards.",
                "Use online pickup/delivery lanes when the whole order can stay inside the tracked flow.",
                "Line up the meal plan and the strongest deal week so cash back is a bonus, not the only reason to buy.",
              ].map((rule) => (
                <div style={row} key={rule}>
                  <span className="muted">{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
