import React, { useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";

const KEY = "oddengine:optionssaas:v1";

type State = {
  productName: string;
  targetUser: string;
  promise: string;
  dataSources: string;
  pricing: { entry: string; pro: string; lifetime: string };
  roadmap: string[];
  features: string[];
  onboarding: string;
  routes: string;
  schemaNotes: string;
  launchChecklist: string[];
};

const DEFAULTS: State = {
  productName: "",
  targetUser: "",
  promise: "",
  dataSources: "",
  pricing: { entry: "$19/mo", pro: "$49/mo", lifetime: "$299" },
  roadmap: ["Scanner dashboard", "Options chain + risk box", "Saved watchlists"],
  features: ["Signal scoring", "Chain filtering", "Daily gameplan"],
  onboarding: "Explain value in one sentence, collect ticker/watchlist, show first ranked setup fast.",
  routes: "GET /watchlist\nGET /scanner\nGET /chains/:symbol\nPOST /journal\nGET /dashboard",
  schemaNotes: "watchlists, contracts, journalEntries, subscriptions, alerts",
  launchChecklist: ["Landing page copy", "Pricing page", "Waitlist or checkout", "Onboarding email", "Analytics"],
};

function migrate(raw: any): State {
  if (!raw) return DEFAULTS;
  if (typeof raw === "string") {
    return { ...DEFAULTS, promise: raw };
  }
  return {
    ...DEFAULTS,
    ...raw,
    pricing: { ...DEFAULTS.pricing, ...(raw.pricing || {}) },
    roadmap: Array.isArray(raw.roadmap) ? raw.roadmap : DEFAULTS.roadmap,
    features: Array.isArray(raw.features) ? raw.features : DEFAULTS.features,
    launchChecklist: Array.isArray(raw.launchChecklist) ? raw.launchChecklist : DEFAULTS.launchChecklist,
  };
}

function toLines(value: string) {
  return value.split(/\n+/).map((v) => v.trim()).filter(Boolean);
}

function fromLines(lines: string[]) {
  return lines.join("\n");
}

export default function OptionsSaaS() {
  const [state, setState] = useState<State>(() => migrate(loadJSON(KEY, null as any)));
  const roadmapText = useMemo(() => fromLines(state.roadmap), [state.roadmap]);
  const featuresText = useMemo(() => fromLines(state.features), [state.features]);
  const checklistText = useMemo(() => fromLines(state.launchChecklist), [state.launchChecklist]);

  function patch(next: Partial<State>) {
    const merged = { ...state, ...next };
    setState(merged);
    saveJSON(KEY, merged);
  }

  const mvpScore = [state.productName, state.targetUser, state.promise, state.routes].filter((v) => String(v || "").trim()).length;

  return (
    <div className="page">
      <div className="card">
        <div className="h">📈 Options SaaS</div>
        <div className="sub">Turn the old textarea into a real MVP planner: buyer, promise, pricing, routes, launch checklist.</div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="h">Core brief</div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">Product name
              <input value={state.productName} onChange={(e) => patch({ productName: e.target.value })} placeholder="OddSniper Pro" />
            </label>
            <label className="field">Target user
              <input value={state.targetUser} onChange={(e) => patch({ targetUser: e.target.value })} placeholder="Small-account options traders" />
            </label>
          </div>
          <label className="field" style={{ marginTop: 10 }}>Core promise
            <textarea rows={4} value={state.promise} onChange={(e) => patch({ promise: e.target.value })} placeholder="Help traders find cleaner contracts faster with risk guardrails." />
          </label>
          <label className="field" style={{ marginTop: 10 }}>Data sources
            <textarea rows={4} value={state.dataSources} onChange={(e) => patch({ dataSources: e.target.value })} placeholder="Public chain data, TradingView embeds, custom scanner inputs..." />
          </label>
        </div>

        <div className="card">
          <div className="h">Offer / pricing</div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">Entry
              <input value={state.pricing.entry} onChange={(e) => patch({ pricing: { ...state.pricing, entry: e.target.value } })} />
            </label>
            <label className="field">Pro
              <input value={state.pricing.pro} onChange={(e) => patch({ pricing: { ...state.pricing, pro: e.target.value } })} />
            </label>
            <label className="field">Lifetime
              <input value={state.pricing.lifetime} onChange={(e) => patch({ pricing: { ...state.pricing, lifetime: e.target.value } })} />
            </label>
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800 }}>MVP readiness</div>
            <div className="small" style={{ marginTop: 8 }}>Filled core blocks: <b>{mvpScore}/4</b></div>
            <div className="small" style={{ marginTop: 8 }}>A strong MVP usually needs: buyer, promise, routes, and first-price point.</div>
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="h">Feature stack</div>
          <label className="field" style={{ marginTop: 10 }}>Features (one per line)
            <textarea rows={7} value={featuresText} onChange={(e) => patch({ features: toLines(e.target.value) })} />
          </label>
          <label className="field" style={{ marginTop: 10 }}>Roadmap (one per line)
            <textarea rows={7} value={roadmapText} onChange={(e) => patch({ roadmap: toLines(e.target.value) })} />
          </label>
        </div>

        <div className="card">
          <div className="h">Implementation notes</div>
          <label className="field" style={{ marginTop: 10 }}>Routes / API notes
            <textarea rows={7} value={state.routes} onChange={(e) => patch({ routes: e.target.value })} />
          </label>
          <label className="field" style={{ marginTop: 10 }}>Schema / data model notes
            <textarea rows={7} value={state.schemaNotes} onChange={(e) => patch({ schemaNotes: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="h">Onboarding</div>
          <textarea rows={7} value={state.onboarding} onChange={(e) => patch({ onboarding: e.target.value })} placeholder="What should the first-run flow do?" style={{ marginTop: 10 }} />
        </div>
        <div className="card">
          <div className="h">Launch checklist</div>
          <textarea rows={7} value={checklistText} onChange={(e) => patch({ launchChecklist: toLines(e.target.value) })} style={{ marginTop: 10 }} />
        </div>
      </div>
    </div>
  );
}
