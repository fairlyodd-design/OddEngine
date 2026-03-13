import React, { useMemo, useState } from "react";
import { VEGAS_POKER_TOURNAMENTS, buildVegasPokerFeedMarkdown, filterVegasPokerFeed } from "../lib/vegasPokerFeed";

const ROOMS = ["all", "Wynn", "Venetian", "Aria", "Bellagio", "MGM Grand", "Horseshoe / WSOP"];
const BUCKETS = ["all", "today", "tomorrow", "this-week", "series"] as const;

export default function VegasPokerFeed() {
  const [query, setQuery] = useState("");
  const [room, setRoom] = useState("all");
  const [bucket, setBucket] = useState<(typeof BUCKETS)[number]>("all");

  const items = useMemo(
    () => filterVegasPokerFeed(VEGAS_POKER_TOURNAMENTS, { query, room, bucket }),
    [query, room, bucket]
  );

  const markdown = useMemo(() => buildVegasPokerFeedMarkdown(items), [items]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card softCard">
        <div className="small shellEyebrow">VEGAS POKER FEED</div>
        <div className="h mt-2">Las Vegas tournament radar</div>
        <div className="sub mt-2">Use this like a poker news feed for daily events, room schedules, and major series windows.</div>
      </div>

      <div className="card softCard">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <input className="input" placeholder="Search room, buy-in, or format…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="input" value={room} onChange={(e) => setRoom(e.target.value)}>
            {ROOMS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select className="input" value={bucket} onChange={(e) => setBucket(e.target.value as any)}>
            {BUCKETS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <button className="tabBtn" onClick={() => navigator.clipboard?.writeText(markdown)}>Copy markdown</button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((item) => (
          <div key={item.id} className="card softCard">
            <div className="small shellEyebrow">{item.room} • {item.source}</div>
            <div className="h mt-2">{item.title}</div>
            <div className="small mt-2"><b>Buy-in:</b> {item.buyIn}{item.guarantee ? ` • ${item.guarantee}` : ""}</div>
            <div className="small mt-1"><b>Starts:</b> {item.startsAt}</div>
            <div className="small mt-1"><b>Format:</b> {item.format}</div>
            {item.notes ? <div className="note mt-3">{item.notes}</div> : null}
          </div>
        ))}
        {!items.length ? <div className="card softCard"><div className="small">No feed items matched this filter.</div></div> : null}
      </div>
    </div>
  );
}
