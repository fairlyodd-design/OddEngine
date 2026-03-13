import React, { useMemo, useState } from "react";
import { VEGAS_POKER_CASH_PROMOS, bestRoomTonight, buildVegasPokerCashPromosMarkdown, filterVegasPokerCashPromos } from "../lib/vegasPokerCashPromos";

const ROOMS = ["all", "Wynn", "Venetian", "Aria", "Bellagio", "MGM", "Resorts World", "Horseshoe / WSOP"];
const TAGS = ["all", "high-hand", "splash-pot", "room-watch", "series-promo", "best-room"] as const;

export default function VegasPokerCashPromos() {
  const [query, setQuery] = useState("");
  const [room, setRoom] = useState("all");
  const [tag, setTag] = useState<(typeof TAGS)[number]>("all");

  const items = useMemo(
    () => filterVegasPokerCashPromos(VEGAS_POKER_CASH_PROMOS, { query, room, tag }),
    [query, room, tag]
  );

  const best = useMemo(() => bestRoomTonight(items), [items]);
  const markdown = useMemo(() => buildVegasPokerCashPromosMarkdown(items), [items]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card softCard">
        <div className="small shellEyebrow">VEGAS POKER CASH + PROMOS</div>
        <div className="h mt-2">Cash rooms, promos, and best-room-tonight lane</div>
        <div className="sub mt-2">Track Strip cash-game rooms, promo watches, and a simple recommendation for where to play tonight.</div>
      </div>

      {best ? (
        <div className="card softCard">
          <div className="small shellEyebrow">BEST ROOM TONIGHT</div>
          <div className="h mt-2">{best.room}</div>
          <div className="small mt-2">{best.stakes}</div>
          <div className="note mt-3">{best.promo}{best.notes ? ` • ${best.notes}` : ""}</div>
        </div>
      ) : null}

      <div className="card softCard">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <input className="input" placeholder="Search room, stakes, or promo…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="input" value={room} onChange={(e) => setRoom(e.target.value)}>
            {ROOMS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select className="input" value={tag} onChange={(e) => setTag(e.target.value as any)}>
            {TAGS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <button className="tabBtn" onClick={() => navigator.clipboard?.writeText(markdown)}>Copy markdown</button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((item) => (
          <div key={item.id} className="card softCard">
            <div className="small shellEyebrow">{item.room} • {item.source}</div>
            <div className="h mt-2">{item.promo}</div>
            <div className="small mt-2"><b>Stakes:</b> {item.stakes}</div>
            <div className="small mt-1"><b>Type:</b> {item.tag}</div>
            {item.notes ? <div className="note mt-3">{item.notes}</div> : null}
          </div>
        ))}
        {!items.length ? <div className="card softCard"><div className="small">No cash-game promo items matched this filter.</div></div> : null}
      </div>
    </div>
  );
}
