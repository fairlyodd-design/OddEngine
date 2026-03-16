export type VegasSeriesTag = "series" | "value" | "prestige" | "daily" | "future" | "satellite" | "show";

export type VegasTournamentSeries = {
  id: string;
  venue: string;
  title: string;
  dateRange: string;
  guarantee: string;
  buyInFocus: string;
  bestFor: string;
  notes: string[];
  tags: VegasSeriesTag[];
};

export type VegasShowIntel = {
  id: string;
  venue: string;
  title: string;
  dateRange: string;
  vibe: string;
  tags: VegasSeriesTag[];
};

export type VegasWatchPrefs = {
  favorites: string[];
  showFavorites: string[];
};

export const VEGAS_WATCH_STORAGE_KEY = "oddengine:vegas-intel:watch:v1";

export const VEGAS_TOURNAMENT_SERIES: VegasTournamentSeries[] = [
  {
    id: "wynn-millions",
    venue: "Wynn Las Vegas",
    title: "2026 Wynn Millions",
    dateRange: "Feb 16 – Mar 22, 2026",
    guarantee: "$7M+ series / $2M Championship",
    buyInFocus: "$200 nightly to $3,500 championship",
    bestFor: "premium flagship room, polished experience, major-series atmosphere",
    notes: [
      "Strong prestige lane when you want a premium room and a flagship series feel.",
      "Watch the championship week and satellites if you want a premium Vegas shot.",
      "Best for a polished room experience more than pure bargain hunting.",
    ],
    tags: ["series", "prestige", "satellite"],
  },
  {
    id: "venetian-deepstack",
    venue: "Venetian Las Vegas",
    title: "DeepStack Showdown (March)",
    dateRange: "Feb 25 – Mar 31, 2026",
    guarantee: "Nearly $2.2M guaranteed",
    buyInFocus: "$200 satellites to $1,600 majors",
    bestFor: "mid-stakes value, broad daily volume, satellites, practical play-today lane",
    notes: [
      "Best blend of value and event depth for a lot of players.",
      "Strong 'best value tonight' candidate most weeks thanks to broad schedule depth.",
      "Great room to watch when you want options instead of one narrow prestige lane.",
    ],
    tags: ["series", "value", "satellite"],
  },
  {
    id: "venetian-plo",
    venue: "Venetian Las Vegas",
    title: "PokerGO Tour PLO Series",
    dateRange: "Mar 20 – Mar 29, 2026",
    guarantee: "$1M+ guaranteed",
    buyInFocus: "$3,300 PLO Main Event and higher-end PLO lanes",
    bestFor: "premium PLO-focused action and sharper specialist fields",
    notes: [
      "Useful if you want PLO-specific series awareness instead of generic NLH tracking.",
      "A more specialist/premium lane than broad nightly-value lane.",
    ],
    tags: ["series", "prestige", "future"],
  },
  {
    id: "pokergo-cup",
    venue: "ARIA / PokerGO Studio",
    title: "PokerGO Cup 2026",
    dateRange: "Mar 1 – Mar 15, 2026",
    guarantee: "10-event headline series",
    buyInFocus: "$3,300+ premium lane",
    bestFor: "headline series awareness and serious tournament atmosphere",
    notes: [
      "Best for following premium series and televised/event prestige.",
      "Less of a budget-value lane and more of a top-tier room/intel lane.",
    ],
    tags: ["series", "prestige"],
  },
  {
    id: "orleans-dailies",
    venue: "The Orleans",
    title: "Daily tournament lane",
    dateRange: "Live daily calendar",
    guarantee: "Daily local-value flow",
    buyInFocus: "$100–$200 daily style lane",
    bestFor: "locals/value lane when you want playable action tonight without flagship pressure",
    notes: [
      "Strong fallback/value room when you just want real daily options.",
      "Great locals lane to watch alongside Venetian for practical tournament nights.",
    ],
    tags: ["daily", "value"],
  },
  {
    id: "horseshoe-dailies",
    venue: "Horseshoe Las Vegas",
    title: "Daily tournament ladder",
    dateRange: "Live daily calendar",
    guarantee: "$100–$160 recurring daily lane",
    buyInFocus: "$100–$160 dailies",
    bestFor: "steady Strip daily action and future WSOP-area awareness",
    notes: [
      "Good recurring daily lane with lots of start times.",
      "Useful as a practical Strip fallback and future summer planning anchor.",
    ],
    tags: ["daily", "value", "future"],
  },
  {
    id: "wsop-2026",
    venue: "Horseshoe / Paris Las Vegas",
    title: "57th Annual WSOP",
    dateRange: "May 26 – Jul 15, 2026",
    guarantee: "World Series season",
    buyInFocus: "Summer flagship range",
    bestFor: "future watchlist, summer planning, satellite awareness",
    notes: [
      "Not the current March lane, but it matters for future planning and summer roadmap.",
      "Keep this pinned if you want future Vegas poker season context.",
    ],
    tags: ["future", "prestige", "satellite"],
  },
];

export const VEGAS_SHOW_INTEL: VegasShowIntel[] = [
  {
    id: "sphere-eagles",
    venue: "Sphere",
    title: "Eagles",
    dateRange: "Mar 20 – Apr 11, 2026",
    vibe: "premium legacy residency and easy add-on to a bigger Vegas poker trip",
    tags: ["show", "prestige"],
  },
  {
    id: "sphere-illenium",
    venue: "Sphere",
    title: "ILLENIUM",
    dateRange: "Mar 5 – Apr 4, 2026",
    vibe: "big visual/electronic lane with a more modern event feel",
    tags: ["show"],
  },
  {
    id: "sphere-anyma",
    venue: "Sphere",
    title: "Anyma – The End of Genesys",
    dateRange: "final shows / current availability",
    vibe: "immersive electronic experience for a strong poker-night-plus-show lane",
    tags: ["show"],
  },
  {
    id: "sphere-wizard",
    venue: "Sphere",
    title: "The Wizard of Oz at Sphere",
    dateRange: "on sale",
    vibe: "immersive destination-style show pick",
    tags: ["show", "future"],
  },
  {
    id: "sphere-backstreet",
    venue: "Sphere",
    title: "Backstreet Boys",
    dateRange: "Jul 16 – Aug 22, 2026",
    vibe: "future summer residency lane",
    tags: ["show", "future"],
  },
];

export function safeLoadVegasPrefs(): VegasWatchPrefs {
  if (typeof window === "undefined") return { favorites: [], showFavorites: [] };
  try {
    const raw = window.localStorage.getItem(VEGAS_WATCH_STORAGE_KEY);
    if (!raw) return { favorites: [], showFavorites: [] };
    const parsed = JSON.parse(raw);
    return {
      favorites: Array.isArray(parsed?.favorites) ? parsed.favorites : [],
      showFavorites: Array.isArray(parsed?.showFavorites) ? parsed.showFavorites : [],
    };
  } catch {
    return { favorites: [], showFavorites: [] };
  }
}

export function safeSaveVegasPrefs(prefs: VegasWatchPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VEGAS_WATCH_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // local-only, ignore write errors
  }
}

export function getVenueTone(venue: string) {
  const key = venue.toLowerCase();
  if (key.includes("wynn")) return "premium";
  if (key.includes("venetian")) return "value";
  if (key.includes("aria")) return "prestige";
  if (key.includes("orleans") || key.includes("horseshoe")) return "locals";
  if (key.includes("sphere")) return "show";
  return "neutral";
}

export function buildTonightLanes() {
  return [
    {
      id: "value-tonight",
      title: "Best value tonight",
      lane: "Venetian + Orleans first",
      note: "Start with Venetian for series depth and Orleans for practical value fallback.",
      tone: "value",
    },
    {
      id: "premium-tonight",
      title: "Premium shot tonight",
      lane: "Wynn + ARIA first",
      note: "Use this when you want prestige atmosphere, stronger flagship energy, and a polished room.",
      tone: "premium",
    },
    {
      id: "show-night",
      title: "Poker + show night",
      lane: "Sphere watchlist",
      note: "Use this when you want to pair a strong poker room night with a real Vegas event add-on.",
      tone: "show",
    },
  ];
}
