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

const KEY = "oddengine:money:offers:v1";
const SELL_KEY = "oddengine:money:sellables:v1";

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
  focus: "Monetize one panel at a time",
  buyer: "Small-account traders / niche dashboard buyers",
  problem: "They want cleaner tools faster without enterprise bloat.",
  offer: "Productized dashboard setup + local-first package",
  deliverables: ["Starter dashboard", "Branding pass", "Install guide", "Upsell path"],
  pricing: "$49 starter • $149 pro setup • $299 lifetime pack",
  fastestPath: "Ship one small paid pack before building a giant suite.",
  offers: [
    { title: "Starter pack", price: "$49", why: "Fastest impulse buy" },
    { title: "Pro install", price: "$149", why: "Service + software hybrid" },
    { title: "Lifetime bundle", price: "$299", why: "Best for fans / power users" },
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

function sid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function Money({ onNavigate }: { onNavigate?: (id: string) => void } = {}) {
  const nav = onNavigate || (() => {});
  const [brand, setBrand] = useState("FairlyOdd");
  const [pack, setPack] = useState<MoneyPackKind>("full_bundle");
  const [state, setState] = useState<OfferState>(() => loadJSON(KEY, DEFAULT_OFFERS));
  const [sellables, setSellables] = useState<Sellable[]>(() => loadJSON<Sellable[]>(SELL_KEY, []));
  const files: GenFile[] = useMemo(() => generateMoneyPack(pack, brand || "FairlyOdd"), [pack, brand]);

  const metrics = useMemo(() => {
    const selling = sellables.filter((s) => s.status === "Selling").length;
    const listed = sellables.filter((s) => s.status === "Listed").length;
    const building = sellables.filter((s) => s.status === "Building").length;
    const active = sellables[0];
    const launchLane = active?.title || state.offers[0]?.title || "Starter pack";
    const quickest = state.offers[0]?.price || "$49";
    return {
      selling,
      listed,
      building,
      launchLane,
      quickest,
      deliverableCount: state.deliverables.length,
      fileCount: files.length,
      mode: pack === "full_bundle" ? "Bundle" : "Single lane",
    };
  }, [files.length, pack, sellables, state.deliverables.length, state.offers]);

  function patch(next: Partial<OfferState>) {
    const merged = { ...state, ...next };
    setState(merged);
    saveJSON(KEY, merged);
  }

  async function doZip() {
    try {
      await downloadZip(`${brand || "FairlyOdd"}_${pack}`, files, `${brand || "FairlyOdd"}_money_pack`);
      pushNotif({ title: "Money", body: "ZIP exported.", tags: ["Money"], level: "good" as any });
    } catch (e: any) {
      pushNotif({ title: "Money", body: `ZIP export failed: ${e?.message || String(e)}`, tags: ["Money"], level: "error" });
    }
  }

  async function doFolder() {
    try {
      await exportToFolderBrowser(`${brand || "FairlyOdd"}_money_pack`, files);
      pushNotif({ title: "Money", body: "Exported to folder.", tags: ["Money"], level: "good" as any });
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
      pushNotif({ title: "Money", body: "Generated into Desktop exports folder (userData/exports).", tags: ["Money"], level: "good" as any });
    } catch (e: any) {
      pushNotif({ title: "Money", body: `Generate failed: ${e?.message || String(e)}`, tags: ["Money"], level: "error" });
    }
  }

  function upsertSellable(s: Sellable) {
    const next = sellables.some((x) => x.id === s.id) ? sellables.map((x) => (x.id === s.id ? s : x)) : [s, ...sellables];
    setSellables(next);
    saveJSON(SELL_KEY, next);
  }

  function quickSeed(kind: SellableKind) {
    const preset: Record<SellableKind, Partial<Sellable>> = {
      Book: { title: "Shades of Light", target: "KDP (ebook + paperback)", price: "$4.99 ebook / $12.99 paperback", notes: "Outline → 30 chapter sketches → publish" },
      GPT: { title: "GrowGPT Coach", target: "ChatGPT Store / SaaS", price: "$9–$29/mo", notes: "Room coach + alerts + routines" },
      App: { title: "Options Sniper Desktop", target: "Gumroad / itch / direct", price: "$49–$299", notes: "Local-first scanner + presets + export" },
      Template: { title: "FairlyOdd Finance Dashboard", target: "Gumroad", price: "$19–$49", notes: "CSV import + net worth + payoff planner" },
    };
    const now = Date.now();
    const base: Sellable = {
      id: sid(),
      kind,
      title: preset[kind].title || `${kind} idea`,
      target: preset[kind].target || "",
      price: preset[kind].price || "",
      status: "Idea",
      notes: preset[kind].notes,
      createdAt: now,
      updatedAt: now,
    };
    upsertSellable(base);
  }

  return (
    <div className="panelMain moneyPanelRoot">
      <PanelHeader
        title="💵 Money"
        subtitle="FairlyGOD Mode revenue lane: sellable pipeline + pack studio + offer builder."
        panelId="Money"
        storagePrefix="oddengine:money"
        storageActionsMode="menu"
        showCopilot
        rightSlot={
          <ActionMenu
            title="Money tools"
            items={[
              { label: "Open Calendar", onClick: () => nav("Calendar") },
              {
                label: "Add weekly launch review (today)",
                onClick: () =>
                  addQuickEvent({
                    title: "Money: weekly launch review",
                    panelId: "Money",
                    date: fmtDate(new Date()),
                    notes: "Review sellables, pick 1 to ship, set a launch date.",
                  }),
              },
              {
                label: "Copy weekly launch plan",
                onClick: () => {
                  const plan = "Weekly launch plan:\n1) Pick 1 sellable\n2) Build/finish MVP\n3) Listing + screenshots\n4) Post update\n5) Collect feedback";
                  navigator.clipboard?.writeText(plan);
                  pushNotif({ title: "Money", body: "Copied weekly launch plan.", tags: ["Money"], level: "good" as any });
                },
              },
            ]}
          />
        }
      />

      <PanelScheduleCard
        panelId="Money"
        title="Money schedule"
        subtitle="Quick-add launch reminders + upcoming items."
        presets={[
          { label: "+ Ship", title: "Money: ship a pack", notes: "Finish 1 deliverable and export the ZIP." },
          { label: "+ Publish", title: "Money: publish listing", offsetDays: 1, notes: "Create listing page + screenshots." },
          { label: "+ Post update", title: "Money: post progress update", offsetDays: 0, notes: "Post to community / socials." },
          { label: "+ Weekly review", title: "Money: weekly launch review", offsetDays: 7, notes: "Pick 1 sellable, set launch, ship." },
        ]}
        onNavigate={nav}
      />

      <div className="card softCard moneyHeroCard">
        <div className="moneyHeroTop">
          <div>
            <div className="small shellEyebrow">REVENUE DESK</div>
            <div className="h">Ship cleaner offers faster</div>
            <div className="sub moneyHeroSub">
              Turn the best FairlyOdd panels into paid packs, listings, and repeatable launch lanes without building a giant suite first.
            </div>
          </div>
          <div className="moneyHeroStatus">
            <span className="badge good">{metrics.mode}</span>
            <span className="badge">Pack {PACKS.find((p) => p.id === pack)?.label}</span>
            <span className="badge">Files {metrics.fileCount}</span>
            <span className="badge">Fast lane {metrics.quickest}</span>
          </div>
        </div>

        <div className="moneyHeroMetrics">
          <div className="card moneyMetricCard">
            <div className="small shellEyebrow">Live lane</div>
            <div className="moneyMetricValue">{metrics.launchLane}</div>
            <div className="small">Best current sellable to push next.</div>
          </div>
          <div className="card moneyMetricCard">
            <div className="small shellEyebrow">Pipeline</div>
            <div className="moneyMetricValue">{sellables.length}</div>
            <div className="small">{metrics.building} building • {metrics.listed} listed • {metrics.selling} selling</div>
          </div>
          <div className="card moneyMetricCard">
            <div className="small shellEyebrow">Offer stack</div>
            <div className="moneyMetricValue">{metrics.deliverableCount}</div>
            <div className="small">Current deliverables in the active offer.</div>
          </div>
          <div className="card moneyMetricCard">
            <div className="small shellEyebrow">Fastest cash</div>
            <div className="moneyMetricValue">{state.offers[0]?.price || "$49"}</div>
            <div className="small">Lead offer: {state.offers[0]?.title || "Starter pack"}</div>
          </div>
        </div>
      </div>

      <div className="card moneyRadarCard">
        <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div className="small shellEyebrow">MONEY RADAR</div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Best path to cash right now</div>
          </div>
          <span className="badge good">{state.fastestPath}</span>
        </div>
        <div className="moneyRadarGrid">
          <div className="moneyRadarPill good">
            <div>
              <div className="small">Lead buyer</div>
              <strong>{state.buyer}</strong>
            </div>
            <span className="badge">Buyer</span>
          </div>
          <div className="moneyRadarPill warn">
            <div>
              <div className="small">Primary focus</div>
              <strong>{state.focus}</strong>
            </div>
            <span className="badge">Focus</span>
          </div>
          <div className="moneyRadarPill">
            <div>
              <div className="small">Positioning</div>
              <strong>{state.offer}</strong>
            </div>
            <span className="badge">Offer</span>
          </div>
          <div className="moneyRadarPill">
            <div>
              <div className="small">Pricing ladder</div>
              <strong>{state.pricing}</strong>
            </div>
            <span className="badge">Price</span>
          </div>
        </div>
        <div className="moneyRouteNote small">Ship one paid lane, post it, collect feedback, then scale the winning offer instead of widening scope too early.</div>
      </div>

      <div className="row" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
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
              <div className="small">Seed a few ideas and we’ll turn them into a weekly launch plan. 👊</div>
            ) : (
              sellables.map((s) => (
                <div key={s.id} className="card moneyStoryCard">
                  <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{s.kind}: {s.title}</div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <select className="input" value={s.status} onChange={(e) => upsertSellable({ ...s, status: e.target.value as any, updatedAt: Date.now() })}>
                        {(["Idea", "Building", "Listed", "Selling"] as const).map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                      <button className="tabBtn" onClick={() => {
                        const text = `Title: ${s.title}\nKind: ${s.kind}\nTarget: ${s.target}\nPrice: ${s.price}\nStatus: ${s.status}\nNotes: ${s.notes || ""}`;
                        navigator.clipboard?.writeText(text);
                        pushNotif({ title: "Money", body: "Copied sellable summary.", tags: ["Money"], level: "good" as any });
                      }}>Copy</button>
                      <button className="tabBtn" onClick={() => {
                        const d = prompt("Date (YYYY-MM-DD)", fmtDate(new Date()));
                        if (!d) return;
                        addQuickEvent({ title: `Launch: ${s.title}`, panelId: "Money", date: d, notes: `${s.kind} • ${s.target} • ${s.price}` });
                        pushNotif({ title: "Money", body: "Added to Calendar.", tags: ["Money"], level: "good" as any });
                      }}>+Cal</button>
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
              ))
            )}
          </div>
        </CardFrame>

        <CardFrame title="Offer Builder" subtitle="Make the offer so clean it sells itself" storageKey="money:offer" className="softCard">
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
        </CardFrame>

        <CardFrame title="ROI Path" subtitle="Fastest-to-cash lane" storageKey="money:roi" className="softCard">
          <label className="field" style={{ marginTop: 10 }}>Pricing ladder
            <textarea rows={4} value={state.pricing} onChange={(e) => patch({ pricing: e.target.value })} />
          </label>
          <label className="field" style={{ marginTop: 10 }}>Fastest path to cash
            <textarea rows={4} value={state.fastestPath} onChange={(e) => patch({ fastestPath: e.target.value })} />
          </label>
          <div className="assistantStack" style={{ marginTop: 12 }}>
            {state.offers.map((offer, idx) => (
              <div key={idx} className="timelineCard">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 800 }}>{offer.title}</div>
                  <span className="badge good">{offer.price}</span>
                </div>
                <div className="small" style={{ marginTop: 6 }}>{offer.why}</div>
              </div>
            ))}
          </div>
        </CardFrame>

        <CardFrame title="Exportable Pack Studio" subtitle="Generate ZIPs/folders for paid packs" storageKey="money:packs" className="softCard">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
            <div className="small">Files in current pack: <b>{files.length}</b></div>
          </div>

          <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
            <input className="input" style={{ minWidth: 220 }} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name (e.g. FairlyOdd)" />
            <select className="input" value={pack} onChange={(e) => setPack(e.target.value as any)}>
              {PACKS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <button onClick={doZip}>Export ZIP</button>
            <button onClick={doFolder}>Export to folder</button>
            {isDesktop() && <button onClick={doDesktopGenerate}>Generate to exports (Desktop)</button>}
          </div>

          <div className="card moneyStoryCard" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800 }}>{PACKS.find((p) => p.id === pack)?.label}</div>
            <div className="small" style={{ marginTop: 6 }}>{PACKS.find((p) => p.id === pack)?.desc}</div>
            <ul className="assistantList small" style={{ marginTop: 8 }}>
              <li>Clean folder structure ready for GitHub</li>
              <li>Starter React dashboard templates + microsite starter</li>
              <li>README stubs so you can ship fast</li>
            </ul>
          </div>
        </CardFrame>
      </div>
    </div>
  );
}
