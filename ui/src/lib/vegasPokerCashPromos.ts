export type VegasPokerCashPromo = {
  id: string;
  room: string;
  stakes: string;
  promo: string;
  source: "PokerAtlas" | "Wynn" | "Venetian" | "Aria" | "Bellagio" | "MGM" | "Resorts World" | "WSOP";
  tag: "high-hand" | "splash-pot" | "room-watch" | "series-promo" | "best-room";
  notes?: string;
};

export const VEGAS_POKER_CASH_PROMOS: VegasPokerCashPromo[] = [
  { id: "wynn-25-50", room: "Wynn", stakes: "1/3, 2/5 NLH", promo: "Strong room quality + steady list depth", source: "Wynn", tag: "best-room", notes: "Great all-around room when lineups are healthy." },
  { id: "venetian-hh", room: "Venetian", stakes: "1/3, 2/5 NLH", promo: "High-hand / promo watch", source: "Venetian", tag: "high-hand", notes: "Check official room promos for current windows." },
  { id: "aria-watch", room: "Aria", stakes: "1/3, 2/5, 5/10 NLH", promo: "Premium player pool / room-watch", source: "PokerAtlas", tag: "room-watch", notes: "Good for game quality and regular action." },
  { id: "bellagio-watch", room: "Bellagio", stakes: "2/5+ NLH", promo: "Classic room / deeper lineup watch", source: "PokerAtlas", tag: "room-watch" },
  { id: "mgm-hh", room: "MGM", stakes: "1/2, 1/3 NLH", promo: "Promo / splash-style watch", source: "MGM", tag: "splash-pot", notes: "Watch room page and local feed notes." },
  { id: "rw-room", room: "Resorts World", stakes: "1/3, 2/5 NLH", promo: "Modern room + lineup watch", source: "PokerAtlas", tag: "room-watch" },
  { id: "horseshoe-wsop", room: "Horseshoe / WSOP", stakes: "1/3, 2/5 NLH", promo: "Series spillover + tourist action", source: "WSOP", tag: "series-promo", notes: "Best when WSOP/Circuit traffic is active." },
];

export type CashPromoFilter = {
  query: string;
  room: string;
  tag: "all" | "high-hand" | "splash-pot" | "room-watch" | "series-promo" | "best-room";
};

export function filterVegasPokerCashPromos(items: VegasPokerCashPromo[], filter: CashPromoFilter) {
  const q = String(filter.query || "").trim().toLowerCase();
  const room = String(filter.room || "all");
  const tag = filter.tag || "all";
  return items.filter((item) => {
    if (room !== "all" && item.room !== room) return false;
    if (tag !== "all" && item.tag !== tag) return false;
    if (!q) return true;
    const hay = `${item.room} ${item.stakes} ${item.promo} ${item.notes || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

export function bestRoomTonight(items: VegasPokerCashPromo[]) {
  return items.find((item) => item.tag === "best-room") || items[0] || null;
}

export function buildVegasPokerCashPromosMarkdown(items: VegasPokerCashPromo[]) {
  const lines = ["# Vegas Poker Cash + Promos", ""];
  items.forEach((item) => {
    lines.push(`- **${item.room}** — ${item.stakes} | ${item.promo} | ${item.source}`);
  });
  return lines.join("\n");
}
