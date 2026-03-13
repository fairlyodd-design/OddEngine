export type VegasPokerTournament = {
  id: string;
  room: string;
  title: string;
  buyIn: string;
  guarantee?: string;
  startsAt: string;
  dayBucket: "today" | "tomorrow" | "this-week" | "series";
  format: string;
  source: "PokerAtlas" | "Wynn" | "Venetian" | "WSOP" | "MGM";
  notes?: string;
};

export const VEGAS_POKER_TOURNAMENTS: VegasPokerTournament[] = [
  { id: "wynn-daily-1", room: "Wynn", title: "Daily No-Limit Hold'em", buyIn: "$160", guarantee: "$5K GTD", startsAt: "1:00 PM", dayBucket: "today", format: "NLH", source: "Wynn", notes: "Core daily room event." },
  { id: "venetian-dse-1", room: "Venetian", title: "DeepStack Warmup", buyIn: "$200", guarantee: "$10K GTD", startsAt: "12:10 PM", dayBucket: "today", format: "NLH", source: "Venetian", notes: "DeepStack-style daily lane." },
  { id: "aria-daily-1", room: "Aria", title: "Daily Poker Tournament", buyIn: "$140", guarantee: "$3K GTD", startsAt: "7:00 PM", dayBucket: "today", format: "NLH", source: "PokerAtlas", notes: "Typical evening room slot." },
  { id: "bellagio-daily-1", room: "Bellagio", title: "Evening No-Limit Hold'em", buyIn: "$120", startsAt: "6:00 PM", dayBucket: "tomorrow", format: "NLH", source: "PokerAtlas" },
  { id: "mgm-grandstack", room: "MGM Grand", title: "Grand Stack Weekend", buyIn: "$300", startsAt: "11:00 AM", dayBucket: "this-week", format: "NLH", source: "MGM", notes: "Weekend series-style event." },
  { id: "wsop-circuit", room: "Horseshoe / WSOP", title: "WSOP Circuit Event", buyIn: "$400", guarantee: "Series Event", startsAt: "12:00 PM", dayBucket: "series", format: "NLH", source: "WSOP", notes: "Official series calendar lane." },
  { id: "wynn-series", room: "Wynn", title: "Wynn Signature / Millions Rail", buyIn: "$600+", guarantee: "Series", startsAt: "Series Window", dayBucket: "series", format: "Mixed", source: "Wynn", notes: "Use room page for official schedule updates." },
];

export type FeedFilter = {
  query: string;
  room: string;
  bucket: "all" | "today" | "tomorrow" | "this-week" | "series";
};

export function filterVegasPokerFeed(items: VegasPokerTournament[], filter: FeedFilter) {
  const q = String(filter.query || "").trim().toLowerCase();
  const room = String(filter.room || "all");
  const bucket = filter.bucket || "all";
  return items.filter((item) => {
    if (room !== "all" && item.room !== room) return false;
    if (bucket !== "all" && item.dayBucket !== bucket) return false;
    if (!q) return true;
    const hay = `${item.room} ${item.title} ${item.buyIn} ${item.guarantee || ""} ${item.format} ${item.notes || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

export function buildVegasPokerFeedMarkdown(items: VegasPokerTournament[]) {
  const lines = ["# Vegas Poker Feed", ""];
  items.forEach((item) => {
    lines.push(`- **${item.room}** — ${item.title} | ${item.buyIn}${item.guarantee ? ` | ${item.guarantee}` : ""} | ${item.startsAt} | ${item.source}`);
  });
  return lines.join("\n");
}
