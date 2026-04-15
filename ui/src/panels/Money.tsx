
import React, { useMemo, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import { addQuickEvent, fmtDate } from "../lib/calendarStore";
import CardFrame from "../components/CardFrame";
import { downloadZip, exportToFolderBrowser, type GenFile } from "../lib/files";
import { generateMoneyPack, type MoneyPackKind } from "../lib/generators";
import { pushNotif } from "../lib/notifs";
import { isDesktop, oddApi } from "../lib/odd";
import { loadJSON, saveJSON } from "../lib/storage";
import { buildMoneyHouseholdOpsSnapshot } from "../lib/moneyHouseholdOps";

const KEY = "oddengine:money:offers:v1";

const PACKS: { id: MoneyPackKind; label: string; desc: string }[] = [
  { id: "trader_pack", label: "Trader pack", desc: "Starter dashboard + README" },
  { id: "mining_pack", label: "Mining pack", desc: "Mining dashboard starter + README" },
  { id: "affiliate_pack", label: "Affiliate pack", desc: "Microsite starter + keyword pages" },
  { id: "full_bundle", label: "Full bundle", desc: "Trader + Mining + Affiliate all-in-one" },
];

type OfferState = {
  focus: string;
  buyer: string;
  problem: string;
  offer: string;
  deliverables: string[];
  pricing: string;
  fastestPath: string;
  offers: Array<{ title: string; price: string; why: string }>;
};

const DEFAULT_OFFERS: OfferState = {
  focus: "Protect the house, then ship one paid thing at a time",
  buyer: "Families and operators who want practical local-first tools",
  problem: "Money gets noisy when bills, debt, goals, and product ideas all compete at once.",
  offer: "Household clarity + a shippable product lane that can earn without enterprise bloat.",
  deliverables: ["Household money clarity", "Debt focus", "Weekly ship target", "Exportable starter pack"],
  pricing: "$19 entry • $49 starter • $149 guided setup • $299 lifetime bundle",
  fastestPath: "Protect essentials, pick one sellable, give it a date, and ship it before starting another lane.",
  offers: [
    { title: "Household clarity pack", price: "$19", why: "Fastest practical value for family users" },
    { title: "Starter product pack", price: "$49", why: "Best first digital offer" },
    { title: "Guided setup", price: "$149", why: "Service + software hybrid" },
  ],
};

type SellableKind = "Book" | "GPT" | "App" | "Template";
type Sellable = {
  id: string;
  kind: SellableKind;
  title: string;
  target: string;
  price: string;
  status: "Idea" | "Building" | "Listed" | "Selling";
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

const SELL_KEY = "oddengine:money:sellables:v1";

function sid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function money(n: number, currency = "USD") {
  return Number(n || 0).toLocaleString(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
}

export default function Money({ onNavigate }: { onNavigate?: (id: string) => void } = {}) {
  const nav = onNavigate || (() => {});
  const [brand, setBrand] = useState("FairlyOdd");
  const [pack, setPack] = useState<MoneyPackKind>("full_bundle");
  const [state, setState] = useState<OfferState>(() => loadJSON(KEY, DEFAULT_OFFERS));
  const [sellables, setSellables] = useState<Sellable[]>(() => loadJSON<Sellable[]>(SELL_KEY, []));
  const files: GenFile[] = useMemo(() => generateMoneyPack(pack, brand || "FairlyOdd"), [pack, brand]);
  const household = useMemo(() => buildMoneyHouseholdOpsSnapshot(), [sellables, state]);

  function patch(next: Partial<OfferState>) {
    const merged = { ...state, ...next };
    setState(merged);
    saveJSON(KEY, merged);
  }

  function upsertSellable(s: Sellable) {
    const next = sellables.some((x) => x.id === s.id) ? sellables.map((x) => (x.id === s.id ? s : x)) : [s, ...sellables];
    setSellables(next);
    saveJSON(SELL_KEY, next);
  }

  function quickSeed(kind: SellableKind) {
    const preset: Record<SellableKind, Partial<Sellable>> = {
      Book: { title: "Shades of Light", target: "KDP (ebook + paperback)", price: "$4.99 ebook / $12.99 paperback", notes: "Outline → chapters → cover → publish" },
      GPT: { title: "GrowGPT Coach", target: "ChatGPT Store / SaaS", price: "$9–$29/mo", notes: "Coach + routines + useful prompts" },
      App: { title: "Options Sniper Desktop", target: "Gumroad / direct", price: "$49–$299", notes: "Local-first scanner + presets + export" },
      Template: { title: "FairlyOdd Finance Dashboard", target: "Gumroad", price: "$19–$49", notes: "CSV import + net worth + payoff planner" },
    };
    const now = Date.now();
    upsertSellable({
      id: sid(),
      kind,
      title: preset[kind].title || `${kind} idea`,
      target: preset[kind].target || "",
      price: preset[kind].price || "",
      status: "Idea",
      notes: preset[kind].notes,
      createdAt: now,
      updatedAt: now,
    });
  }

  async function doZip() {
    try {
      await downloadZip(`${brand || "FairlyOdd"}_${pack}`, files, `${brand || "FairlyOdd"}_money_pack`);
      pushNotif({ title: "Money", body: "ZIP exported.", tags: ["Money"], level: "success" });
    } catch (e: any) {
      pushNotif({ title: "Money", body: `ZIP export failed: ${e?.message || String(e)}`, tags: ["Money"], level: "error" });
    }
  }

  async function doFolder() {
    try {
      await exportToFolderBrowser(`${brand || "FairlyOdd"}_money_pack`, files);
      pushNotif({ title: "Money", body: "Exported to folder.", tags: ["Money"], level: "success" });
    } catch (e: any) {
      pushNotif({ title: "Money", body: `Folder export failed: ${e?.message || String(e)}`, tags: ["Money"], level: "error" });
    }
  }

  async function doDesktopGenerate() {
    if (!isDesktop()) {
      pushNotif({ title: "Money", body: "Desktop mode required.", tags: ["Money"], level: "warn" });
      return;
    }
    try {
      const api = oddApi();
      const todo: string[] = [];
      if (pack === "trader_pack" || pack === "full_bundle") todo.push("fairlyodd_dashboard");
      if (pack === "mining_pack" || pack === "full_bundle") todo.push("crypto_dashboard");
      if (pack === "affiliate_pack" || pack === "full_bundle") todo.push("affiliate_site");
      for (const t of todo) {
        await api.generate({ type: t, opts: { brand: brand || "FairlyOdd" } });
      }
      pushNotif({ title: "Money", body: "Generated into Desktop exports folder.", tags: ["Money"], level: "success" });
    } catch (e: any) {
      pushNotif({ title: "Money", body: `Generate failed: ${e?.message || String(e)}`, tags: ["Money"], level: "error" });
    }
  }

  function addWeeklyReview() {
    addQuickEvent({
      title: "Money: weekly launch review",
      panelId: "Money",
      date: household.weeklyReviewDate,
      notes: `Protect essentials, review debt focus, then ship ${household.shipFocus}.`,
    });
    pushNotif({ title: "Money", body: "Weekly review added to Calendar.", tags: ["Money"], level: "success" });
  }

  return (
    <div className="panelMain">
      <PanelHeader
        title="💵 Money"
        subtitle="Household financial ops + weekly ship lane"
        panelId="Money"
        storagePrefix="oddengine:money"
        storageActionsMode="menu"
        showCopilot
        rightSlot={
          <ActionMenu
            title="Money tools"
            items={[
              { label: "Open Family Budget", onClick: () => nav("FamilyBudget") },
              { label: "Open Calendar", onClick: () => nav("Calendar") },
              { label: "Add weekly launch review", onClick: addWeeklyReview },
              {
                label: "Copy weekly launch plan",
                onClick: () => {
                  const plan = [
                    "Weekly launch plan",
                    "1) Protect bills and essentials",
                    "2) Review debt focus",
                    `3) Push ${household.shipFocus}`,
                    "4) Set publish date",
                    "5) Collect feedback and receipts",
                  ].join("\n");
                  navigator.clipboard?.writeText(plan);
                  pushNotif({ title: "Money", body: "Copied weekly launch plan.", tags: ["Money"], level: "success" });
                },
              },
            ]}
          />
        }
      />

      <PanelScheduleCard
        panelId="Money"
        title="Money schedule"
        subtitle="Keep ship / publish / review dates visible."
        presets={[
          { label: "+ Ship", title: "Money: ship a pack", notes: "Finish one deliverable and export the ZIP." },
          { label: "+ Publish", title: "Money: publish listing", offsetDays: 1, notes: "Create listing + screenshots." },
          { label: "+ Review", title: "Money: weekly launch review", offsetDays: 7, notes: "Protect the house, then ship one thing." },
        ]}
        onNavigate={nav}
      />

      <div className="card" style={{ marginTop: 12, background: "linear-gradient(180deg, rgba(16,185,129,.08), rgba(15,23,42,.55))", border: "1px solid rgba(16,185,129,.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div className="small shellEyebrow">Household financial ops</div>
            <div style={{ fontWeight: 900, fontSize: 22, marginTop: 4 }}>{household.headline}</div>
            <div className="small" style={{ marginTop: 8, maxWidth: 860, lineHeight: 1.6 }}>{household.subline}</div>
          </div>
          <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button onClick={() => nav("FamilyBudget")}>Open Family Budget</button>
            <button onClick={() => nav("Calendar")}>Open Calendar</button>
            <button onClick={addWeeklyReview}>Schedule review</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
          <div className="card" style={{ gridColumn: "span 3" }}>
            <div className="small">Projected free cash</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{money(household.projectedFreeCash, household.currency)}</div>
            <div className="small" style={{ marginTop: 6 }}>Month-level cushion after the current household plan.</div>
          </div>
          <div className="card" style={{ gridColumn: "span 3" }}>
            <div className="small">Bills due in 7 days</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{money(household.dueSoonTotal, household.currency)}</div>
            <div className="small" style={{ marginTop: 6 }}>{household.dueSoonCount} due-soon item(s) are visible.</div>
          </div>
          <div className="card" style={{ gridColumn: "span 3" }}>
            <div className="small">Debt focus</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{household.debtFocus}</div>
            <div className="small" style={{ marginTop: 6 }}>{money(household.debtBalance, household.currency)} still needs pressure relief.</div>
          </div>
          <div className="card" style={{ gridColumn: "span 3" }}>
            <div className="small">Ship focus</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{household.shipFocus}</div>
            <div className="small" style={{ marginTop: 6 }}>Use Money like an operator lane, not an idea graveyard.</div>
          </div>

          <div className="card" style={{ gridColumn: "span 8" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Do this now</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {household.actionQueue.map((item, idx) => (
                <div key={`${item.title}-${idx}`} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{idx + 1}. {item.title}</div>
                      <div className="small" style={{ marginTop: 6 }}>{item.detail}</div>
                    </div>
                    <button onClick={() => nav(item.panelId)}>Open {item.panelId}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 4" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Offer focus</div>
            <div className="small" style={{ marginTop: 8, lineHeight: 1.6 }}>{household.offerFocus}</div>
            <div className="assistantChipWrap" style={{ marginTop: 12 }}>
              <span className="badge">Cash {money(household.cashOnHand, household.currency)}</span>
              <span className="badge">Goal gap {money(household.goalGap, household.currency)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="row" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
        <CardFrame title="Ship This Week" subtitle="Keep the money lane honest" storageKey="money:shiplane" className="softCard">
          <div style={{ display: "grid", gap: 10 }}>
            {household.weeklyLaunchItems.length === 0 ? (
              <div className="small">No active sellables are staged yet. Seed one below, then give it a date.</div>
            ) : household.weeklyLaunchItems.map((item) => (
              <div key={item.id} className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{item.kind}: {item.title}</div>
                    <div className="small" style={{ marginTop: 6 }}>{item.target} • {item.price}</div>
                    {item.notes ? <div className="small" style={{ marginTop: 6 }}>{item.notes}</div> : null}
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <select className="input" value={item.status} onChange={(e) => upsertSellable({ ...item, status: e.target.value as any, updatedAt: Date.now() })}>
                      {(["Idea", "Building", "Listed", "Selling"] as const).map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                    <button className="tabBtn" onClick={() => {
                      addQuickEvent({
                        title: `Launch: ${item.title}`,
                        panelId: "Money",
                        date: household.weeklyReviewDate,
                        notes: `${item.kind} • ${item.target} • ${item.price}`,
                      });
                      pushNotif({ title: "Money", body: "Added launch date to Calendar.", tags: ["Money"], level: "success" });
                    }}>+Cal</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardFrame>

        <CardFrame title="Sellables Pipeline" subtitle="Books • GPTs • Apps • Templates" storageKey="money:sellables" className="softCard">
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn" onClick={() => quickSeed("Book")}>+ Book</button>
              <button className="tabBtn" onClick={() => quickSeed("GPT")}>+ GPT</button>
              <button className="tabBtn" onClick={() => quickSeed("App")}>+ App</button>
              <button className="tabBtn" onClick={() => quickSeed("Template")}>+ Template</button>
            </div>
            <div className="small">{sellables.length} items</div>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {sellables.length === 0 ? (
              <div className="small">Seed a few ideas and turn one into this week’s ship target. 👊</div>
            ) : sellables.map((s) => (
              <div key={s.id} className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>{s.kind}: {s.title}</div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <select className="input" value={s.status} onChange={(e) => upsertSellable({ ...s, status: e.target.value as any, updatedAt: Date.now() })}>
                      {(["Idea", "Building", "Listed", "Selling"] as const).map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                    <button className="tabBtn" onClick={() => {
                      const text = `Title: ${s.title}\nKind: ${s.kind}\nTarget: ${s.target}\nPrice: ${s.price}\nStatus: ${s.status}\nNotes: ${s.notes || ""}`;
                      navigator.clipboard?.writeText(text);
                      pushNotif({ title: "Money", body: "Copied sellable summary.", tags: ["Money"], level: "success" });
                    }}>Copy</button>
                    <button className="tabBtn" onClick={() => {
                      const next = sellables.filter((x) => x.id !== s.id);
                      setSellables(next);
                      saveJSON(SELL_KEY, next);
                    }}>✕</button>
                  </div>
                </div>
                <div className="grid2" style={{ marginTop: 10 }}>
                  <label className="field">Target
                    <input value={s.target} onChange={(e) => upsertSellable({ ...s, target: e.target.value, updatedAt: Date.now() })} />
                  </label>
                  <label className="field">Price
                    <input value={s.price} onChange={(e) => upsertSellable({ ...s, price: e.target.value, updatedAt: Date.now() })} />
                  </label>
                </div>
                <label className="field" style={{ marginTop: 10 }}>Notes
                  <textarea rows={3} value={s.notes || ""} onChange={(e) => upsertSellable({ ...s, notes: e.target.value, updatedAt: Date.now() })} />
                </label>
              </div>
            ))}
          </div>
        </CardFrame>

        <CardFrame title="Offer Builder" subtitle="Make the offer clear enough to act on" storageKey="money:offer" className="softCard">
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">Focus
              <input value={state.focus} onChange={(e) => patch({ focus: e.target.value })} />
            </label>
            <label className="field">Buyer
              <input value={state.buyer} onChange={(e) => patch({ buyer: e.target.value })} />
            </label>
          </div>
          <label className="field" style={{ marginTop: 10 }}>Problem
            <textarea rows={4} value={state.problem} onChange={(e) => patch({ problem: e.target.value })} />
          </label>
          <label className="field" style={{ marginTop: 10 }}>Offer
            <textarea rows={4} value={state.offer} onChange={(e) => patch({ offer: e.target.value })} />
          </label>
          <label className="field" style={{ marginTop: 10 }}>Deliverables (one per line)
            <textarea rows={5} value={state.deliverables.join("\n")} onChange={(e) => patch({ deliverables: e.target.value.split(/\n+/).map((v) => v.trim()).filter(Boolean) })} />
          </label>
          <label className="field" style={{ marginTop: 10 }}>Pricing ladder
            <textarea rows={3} value={state.pricing} onChange={(e) => patch({ pricing: e.target.value })} />
          </label>
          <label className="field" style={{ marginTop: 10 }}>Fastest path
            <textarea rows={3} value={state.fastestPath} onChange={(e) => patch({ fastestPath: e.target.value })} />
          </label>
        </CardFrame>

        <CardFrame title="Exportable Pack Studio" subtitle="Generate ZIPs and starter bundles" storageKey="money:packs" className="softCard">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
            <div className="small">Files in current pack: <b>{files.length}</b></div>
          </div>

          <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
            <input className="input" style={{ minWidth: 220 }} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name" />
            <select className="input" value={pack} onChange={(e) => setPack(e.target.value as any)}>
              {PACKS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <button onClick={doZip}>Export ZIP</button>
            <button onClick={doFolder}>Export to folder</button>
            {isDesktop() && <button onClick={doDesktopGenerate}>Generate to exports</button>}
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800 }}>{PACKS.find((p) => p.id === pack)?.label}</div>
            <div className="small" style={{ marginTop: 6 }}>{PACKS.find((p) => p.id === pack)?.desc}</div>
            <ul className="assistantList small" style={{ marginTop: 8 }}>
              <li>Household-friendly product lane starter</li>
              <li>Clean folder structure ready for GitHub</li>
              <li>README stubs so you can ship fast</li>
            </ul>
          </div>
        </CardFrame>
      </div>
    </div>
  );
}
