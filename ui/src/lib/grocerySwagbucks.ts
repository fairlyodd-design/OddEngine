import { loadJSON, saveJSON } from "./storage";

export type SwagbucksCredentialState = {
  email: string;
  memberName: string;
  notes: string;
  isConnected: boolean;
  lastUpdatedAt: number;
};

export type SwagbucksOffer = {
  id: string;
  title: string;
  store: string;
  amountSb: number;
  amountLabel: string;
  expiresAt?: string;
  tags: string[];
  matchTerms: string[];
  category?: string;
};

export type ShoppingItem = {
  title: string;
  qty?: number;
  category?: string;
};

export type SwagbucksMatch = {
  itemTitle: string;
  offer: SwagbucksOffer;
  score: number;
  reason: string;
};

export type SwagbucksSummary = {
  connected: boolean;
  totalOffers: number;
  matchedItems: number;
  unmatchedItems: number;
  totalPotentialSb: number;
  totalPotentialLabel: string;
  bestOffers: SwagbucksOffer[];
  matches: SwagbucksMatch[];
  unmatched: ShoppingItem[];
  expiresSoon: SwagbucksOffer[];
};

const KEY_CREDENTIALS = "oddengine:grocery:swagbucks:credentials:v1";
const KEY_OFFERS = "oddengine:grocery:swagbucks:offers:v1";
const KEY_LAST_SYNC = "oddengine:grocery:swagbucks:lastSync:v1";

const FALLBACK_OFFERS: SwagbucksOffer[] = [
  {
    id: "sb_milk_001",
    title: "Milk / almond milk receipt bonus",
    store: "Any grocery store",
    amountSb: 75,
    amountLabel: "75 SB",
    expiresAt: "",
    tags: ["dairy", "milk", "receipt"],
    matchTerms: ["milk", "almond milk", "oat milk", "lactose free milk"],
    category: "Dairy",
  },
  {
    id: "sb_eggs_001",
    title: "Eggs purchase receipt bonus",
    store: "Any grocery store",
    amountSb: 60,
    amountLabel: "60 SB",
    expiresAt: "",
    tags: ["eggs", "protein", "receipt"],
    matchTerms: ["eggs", "egg whites"],
    category: "Dairy",
  },
  {
    id: "sb_bread_001",
    title: "Bread / buns receipt bonus",
    store: "Any grocery store",
    amountSb: 50,
    amountLabel: "50 SB",
    expiresAt: "",
    tags: ["bread", "buns", "receipt"],
    matchTerms: ["bread", "buns", "rolls", "bagels", "toast"],
    category: "Bakery",
  },
  {
    id: "sb_fruit_001",
    title: "Fresh fruit receipt bonus",
    store: "Any grocery store",
    amountSb: 80,
    amountLabel: "80 SB",
    expiresAt: "",
    tags: ["produce", "fruit", "receipt"],
    matchTerms: ["apple", "banana", "berries", "grapes", "fruit", "orange"],
    category: "Produce",
  },
  {
    id: "sb_chicken_001",
    title: "Chicken / family pack receipt bonus",
    store: "Any grocery store",
    amountSb: 125,
    amountLabel: "125 SB",
    expiresAt: "",
    tags: ["meat", "chicken", "receipt"],
    matchTerms: ["chicken", "breast", "thighs", "drumsticks", "tenders"],
    category: "Meat",
  },
  {
    id: "sb_snacks_001",
    title: "Snack receipt bonus",
    store: "Any grocery store",
    amountSb: 45,
    amountLabel: "45 SB",
    expiresAt: "",
    tags: ["snacks", "receipt"],
    matchTerms: ["chips", "crackers", "cookies", "snacks", "pretzels"],
    category: "Snacks",
  },
];

function clean(text: unknown) {
  return String(text ?? "").trim();
}

function normalize(text: unknown) {
  return clean(text).toLowerCase();
}

function moneyFromSb(totalSb: number) {
  return `$${(totalSb / 100).toFixed(2)} value`;
}

export function loadSwagbucksCredentials(): SwagbucksCredentialState {
  return loadJSON<SwagbucksCredentialState>(KEY_CREDENTIALS, {
    email: "",
    memberName: "",
    notes: "",
    isConnected: false,
    lastUpdatedAt: 0,
  });
}

export function saveSwagbucksCredentials(next: Partial<SwagbucksCredentialState>) {
  const current = loadSwagbucksCredentials();
  const merged: SwagbucksCredentialState = {
    ...current,
    ...next,
    lastUpdatedAt: Date.now(),
  };
  saveJSON(KEY_CREDENTIALS, merged);
  return merged;
}

export function loadSwagbucksOffers(): SwagbucksOffer[] {
  const stored = loadJSON<SwagbucksOffer[]>(KEY_OFFERS, []);
  return stored.length ? stored : FALLBACK_OFFERS;
}

export function saveSwagbucksOffers(offers: SwagbucksOffer[]) {
  saveJSON(KEY_OFFERS, offers);
  saveJSON(KEY_LAST_SYNC, Date.now());
}

export function getSwagbucksLastSync(): number {
  return loadJSON<number>(KEY_LAST_SYNC, 0);
}

function offerScore(item: ShoppingItem, offer: SwagbucksOffer) {
  const itemText = normalize(`${item.title} ${item.category ?? ""}`);
  let score = 0;
  const matchedTerms: string[] = [];

  for (const term of offer.matchTerms) {
    const t = normalize(term);
    if (t && itemText.includes(t)) {
      score += 10;
      matchedTerms.push(term);
    }
  }

  const category = normalize(item.category);
  if (category && normalize(offer.category) === category) {
    score += 4;
  }

  if (score === 0) return null;

  return {
    itemTitle: item.title,
    offer,
    score,
    reason: matchedTerms.length
      ? `Matched on ${matchedTerms.join(", ")}`
      : `Matched on category ${item.category ?? "general"}`,
  } satisfies SwagbucksMatch;
}

export function summarizeSwagbucksForList(
  items: ShoppingItem[],
  options?: { offers?: SwagbucksOffer[]; connected?: boolean },
): SwagbucksSummary {
  const offers = options?.offers ?? loadSwagbucksOffers();
  const creds = loadSwagbucksCredentials();
  const connected = options?.connected ?? creds.isConnected;

  const matches: SwagbucksMatch[] = [];
  const unmatched: ShoppingItem[] = [];

  for (const item of items) {
    const ranked = offers
      .map((offer) => offerScore(item, offer))
      .filter(Boolean)
      .sort((a, b) => (b!.score - a!.score)) as SwagbucksMatch[];

    if (ranked.length) {
      matches.push(ranked[0]);
    } else {
      unmatched.push(item);
    }
  }

  const bestOffers = [...matches]
    .sort((a, b) => b.offer.amountSb - a.offer.amountSb || b.score - a.score)
    .slice(0, 5)
    .map((m) => m.offer);

  const expiresSoon = offers
    .filter((offer) => clean(offer.expiresAt))
    .sort((a, b) => String(a.expiresAt).localeCompare(String(b.expiresAt)))
    .slice(0, 5);

  const totalPotentialSb = matches.reduce((sum, m) => sum + m.offer.amountSb, 0);

  return {
    connected,
    totalOffers: offers.length,
    matchedItems: matches.length,
    unmatchedItems: unmatched.length,
    totalPotentialSb,
    totalPotentialLabel: `${totalPotentialSb} SB • ${moneyFromSb(totalPotentialSb)}`,
    bestOffers,
    matches,
    unmatched,
    expiresSoon,
  };
}

export function toShoppingItems(rawItems: Array<string | ShoppingItem>) {
  return rawItems
    .map((item) =>
      typeof item === "string"
        ? ({ title: item } satisfies ShoppingItem)
        : ({ title: clean(item.title), qty: item.qty, category: item.category } satisfies ShoppingItem),
    )
    .filter((item) => clean(item.title));
}

export function buildSwagbucksMarkdown(summary: SwagbucksSummary, items: ShoppingItem[]) {
  const lines = [
    `# Swagbucks Grocery Summary`,
    ``,
    `- Connected: ${summary.connected ? "Yes" : "No"}`,
    `- Shopping items: ${items.length}`,
    `- Matched items: ${summary.matchedItems}`,
    `- Unmatched items: ${summary.unmatchedItems}`,
    `- Potential value: ${summary.totalPotentialLabel}`,
    ``,
    `## Best receipt matches`,
  ];

  if (!summary.matches.length) {
    lines.push(`- No strong Magic Receipts style matches yet.`);
  } else {
    summary.matches.forEach((match) => {
      lines.push(`- ${match.itemTitle} → ${match.offer.title} (${match.offer.amountLabel})`);
    });
  }

  if (summary.unmatched.length) {
    lines.push(``, `## Items with no strong match yet`);
    summary.unmatched.forEach((item) => lines.push(`- ${item.title}`));
  }

  return lines.join("\n");
}
