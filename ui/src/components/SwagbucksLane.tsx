import React, { useMemo, useState } from "react";
import {
  buildSwagbucksMarkdown,
  loadSwagbucksCredentials,
  loadSwagbucksOffers,
  saveSwagbucksCredentials,
  summarizeSwagbucksForList,
  toShoppingItems,
  type ShoppingItem,
} from "../lib/grocerySwagbucks";

type Props = {
  rawItems: Array<string | ShoppingItem>;
};

export default function SwagbucksLane({ rawItems }: Props) {
  const [creds, setCreds] = useState(() => loadSwagbucksCredentials());
  const [showDetails, setShowDetails] = useState(false);

  const items = useMemo(() => toShoppingItems(rawItems), [rawItems]);
  const offers = useMemo(() => loadSwagbucksOffers(), []);
  const summary = useMemo(
    () => summarizeSwagbucksForList(items, { offers, connected: creds.isConnected }),
    [items, offers, creds.isConnected],
  );

  const saveCredPatch = (patch: Partial<typeof creds>) => {
    const next = saveSwagbucksCredentials(patch);
    setCreds(next);
  };

  return (
    <div className="card softCard mt-4">
      <div className="small shellEyebrow">SWAGBUCKS / MAGIC RECEIPTS</div>
      <div className="sub mt-2">
        Match your current shopping list against Swagbucks-style receipt bonuses and local grocery cash-back value.
      </div>

      <div
        className="mt-3"
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          alignItems: "start",
        }}
      >
        <div className="card softCard">
          <div className="small shellEyebrow">ACCOUNT</div>
          <label className="small mt-2" style={{ display: "grid", gap: 6 }}>
            Email / login
            <input
              className="input"
              value={creds.email}
              onChange={(e) => saveCredPatch({ email: e.target.value })}
              placeholder="your-email@example.com"
            />
          </label>
          <label className="small mt-2" style={{ display: "grid", gap: 6 }}>
            Member name
            <input
              className="input"
              value={creds.memberName}
              onChange={(e) => saveCredPatch({ memberName: e.target.value })}
              placeholder="Swagbucks display name"
            />
          </label>
          <label className="small mt-2" style={{ display: "grid", gap: 6 }}>
            Notes
            <textarea
              className="input"
              rows={3}
              value={creds.notes}
              onChange={(e) => saveCredPatch({ notes: e.target.value })}
              placeholder="Receipt strategy, favorite stores, weekly reset reminders..."
            />
          </label>

          <div className="row wrap mt-3" style={{ gap: 10 }}>
            <button className={`tabBtn ${creds.isConnected ? "active" : ""}`} onClick={() => saveCredPatch({ isConnected: !creds.isConnected })}>
              {creds.isConnected ? "Connected" : "Mark connected"}
            </button>
            <button
              className="tabBtn"
              onClick={() => navigator.clipboard.writeText(buildSwagbucksMarkdown(summary, items))}
            >
              Copy summary
            </button>
          </div>
        </div>

        <div className="card softCard">
          <div className="small shellEyebrow">MATCH SUMMARY</div>
          <div className="small mt-2"><b>Status:</b> {summary.connected ? "Ready" : "Needs setup"}</div>
          <div className="small mt-2"><b>Offers loaded:</b> {summary.totalOffers}</div>
          <div className="small mt-2"><b>Matched items:</b> {summary.matchedItems}</div>
          <div className="small mt-2"><b>Potential value:</b> {summary.totalPotentialLabel}</div>
          <div className="small mt-2"><b>Unmatched:</b> {summary.unmatchedItems}</div>
          <div className="note mt-3">
            Weekly receipt offers can rotate fast. Use this lane as the household cash-back helper, then confirm the final receipt on Swagbucks before purchase.
          </div>
        </div>
      </div>

      <div className="row wrap mt-4" style={{ gap: 10 }}>
        <button className={`tabBtn ${showDetails ? "active" : ""}`} onClick={() => setShowDetails((v) => !v)}>
          {showDetails ? "Hide details" : "Show details"}
        </button>
      </div>

      {showDetails ? (
        <div
          className="mt-3"
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            alignItems: "start",
          }}
        >
          <div className="card softCard">
            <div className="small shellEyebrow">BEST RECEIPT MATCHES</div>
            {summary.matches.length ? (
              <div className="mt-2" style={{ display: "grid", gap: 10 }}>
                {summary.matches.map((match) => (
                  <div key={`${match.itemTitle}-${match.offer.id}`} className="card softCard">
                    <div className="small"><b>{match.itemTitle}</b></div>
                    <div className="small mt-1">{match.offer.title}</div>
                    <div className="small mt-1">{match.offer.amountLabel} • {match.reason}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="small mt-2">No strong Swagbucks-style receipt matches found yet.</div>
            )}
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">UNMATCHED ITEMS</div>
            {summary.unmatched.length ? (
              <div className="mt-2" style={{ display: "grid", gap: 6 }}>
                {summary.unmatched.map((item) => (
                  <div key={item.title} className="small">- {item.title}</div>
                ))}
              </div>
            ) : (
              <div className="small mt-2">Everything on the list has at least one strong match.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
