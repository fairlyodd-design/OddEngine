export type GroceryCategory =
  | "protein"
  | "pantry"
  | "vegetable"
  | "fruit"
  | "dairy"
  | "service"
  | "household";

export type GroceryItem = {
  id: string;
  name: string;
  category: GroceryCategory;
  quantity?: string;
};

export type RetailerDeal = {
  id: string;
  title: string;
  category: GroceryCategory | string;
  itemKey?: string;
  price: number;
  basePrice?: number;
  couponText?: string;
  promoCode?: string;
  onlineOnly?: boolean;
  unitHint?: string;
};

export type Retailer = {
  id: string;
  name: string;
  notes: string;
  cashBackFriendly: "green" | "yellow" | "red";
  deals: RetailerDeal[];
};

export type MealPlan = {
  id: string;
  name: string;
  ingredients: string[];
  notes: string[];
};

export type SwagbucksStore = {
  id: string;
  name: string;
  cashbackRate: number;
  stackConfidence: "green" | "yellow" | "red";
  bestUse: string;
};

export type BasketLine = {
  item: string;
  retailerId: string;
  retailerName: string;
  price: number;
  basePrice: number;
  couponLabel: string;
  savings: number;
};

export type BestBasketResult = {
  total: number;
  baseTotal: number;
  estimatedSavings: number;
  mixedBasket: BasketLine[];
  bestSingleStore: {
    retailerId: string;
    retailerName: string;
    total: number;
    estimatedSavings: number;
  } | null;
};

export type RetailerSummary = {
  retailerId: string;
  retailerName: string;
  basketTotal: number;
  savings: number;
  onlineOnlyCount: number;
  confidence: ReturnType<typeof buildCouponConfidence>;
};

export type MealSuggestion = {
  id: string;
  name: string;
  bestRetailerName: string;
  estimatedCost: number;
  potentialSavings: number;
  ingredients: string[];
  itemRetailers: Record<string, string>;
  notes: string[];
};

export type BasketSwap = {
  item: string;
  fromRetailer: string;
  toRetailer: string;
  saveAmount: number;
  note: string;
};

export type DealHighlight = {
  retailerName: string;
  title: string;
  category: string;
  price: number;
  savings: number;
  couponText?: string;
  onlineOnly?: boolean;
};

export const DEFAULT_GROCERY_ITEMS: GroceryItem[] = [
  { id: "chicken", name: "Chicken breast", category: "protein", quantity: "2–3 lb" },
  { id: "groundBeef", name: "Ground beef", category: "protein", quantity: "2 lb" },
  { id: "rice", name: "Rice", category: "pantry", quantity: "1 bag" },
  { id: "pasta", name: "Pasta", category: "pantry", quantity: "2 boxes" },
  { id: "greenBeans", name: "Green beans", category: "vegetable", quantity: "2 cans/bags" },
  { id: "lettuce", name: "Romaine / lettuce", category: "vegetable", quantity: "1–2 heads" },
  { id: "cheese", name: "Shredded cheese", category: "dairy", quantity: "1 bag" },
  { id: "eggs", name: "Eggs", category: "dairy", quantity: "1 carton" },
];

export const DEFAULT_RETAILERS: Retailer[] = [
  {
    id: "walmart",
    name: "Walmart",
    notes: "Strong base basket pricing and pickup flow.",
    cashBackFriendly: "yellow",
    deals: [
      { id: "wm-chicken", title: "Boneless skinless chicken breast", category: "protein", itemKey: "Chicken breast", price: 2.97, basePrice: 3.34, couponText: "pickup saver" },
      { id: "wm-rice", title: "Long grain rice 5 lb", category: "pantry", itemKey: "Rice", price: 4.62, basePrice: 5.09 },
      { id: "wm-eggs", title: "Large eggs 18 ct", category: "dairy", itemKey: "Eggs", price: 3.88, basePrice: 4.29, couponText: "digital coupon" },
      { id: "wm-beans", title: "Cut green beans canned", category: "vegetable", itemKey: "Green beans", price: 0.98, basePrice: 1.14 },
      { id: "wm-pasta", title: "Pasta 16 oz", category: "pantry", itemKey: "Pasta", price: 1.28, basePrice: 1.59 },
    ],
  },
  {
    id: "smiths",
    name: "Smith's / Kroger",
    notes: "Best when weekly ad and digital coupons stack together.",
    cashBackFriendly: "green",
    deals: [
      { id: "sm-groundbeef", title: "Ground beef family pack", category: "protein", itemKey: "Ground beef", price: 2.49, basePrice: 3.49, couponText: "card price" },
      { id: "sm-cheese", title: "Shredded cheese 8 oz", category: "dairy", itemKey: "Shredded cheese", price: 1.77, basePrice: 2.49, couponText: "digital coupon" },
      { id: "sm-lettuce", title: "Romaine hearts", category: "vegetable", itemKey: "Romaine / lettuce", price: 2.49, basePrice: 2.99 },
      { id: "sm-pasta", title: "Pasta 16 oz", category: "pantry", itemKey: "Pasta", price: 0.99, basePrice: 1.49, promoCode: "weekly digital" },
      { id: "sm-eggs", title: "Eggs 18 ct", category: "dairy", itemKey: "Eggs", price: 3.69, basePrice: 4.29 },
    ],
  },
  {
    id: "albertsons",
    name: "Albertsons / Vons",
    notes: "Good produce and app-offer plays when member offers are strong.",
    cashBackFriendly: "yellow",
    deals: [
      { id: "al-chicken", title: "Chicken breast value pack", category: "protein", itemKey: "Chicken breast", price: 2.99, basePrice: 3.59, couponText: "member price" },
      { id: "al-eggs", title: "Eggs 12 ct", category: "dairy", itemKey: "Eggs", price: 2.47, basePrice: 3.29, couponText: "app coupon" },
      { id: "al-beans", title: "Green beans fresh", category: "vegetable", itemKey: "Green beans", price: 1.49, basePrice: 1.99 },
      { id: "al-rice", title: "Rice 3 lb", category: "pantry", itemKey: "Rice", price: 3.99, basePrice: 4.69, onlineOnly: true, couponText: "pickup deal" },
      { id: "al-lettuce", title: "Romaine hearts", category: "vegetable", itemKey: "Romaine / lettuce", price: 2.29, basePrice: 2.99 },
    ],
  },
  {
    id: "instacart",
    name: "Instacart",
    notes: "Use for convenience runs and online-only cash-back lanes.",
    cashBackFriendly: "green",
    deals: [
      { id: "in-delivery", title: "Free delivery over threshold", category: "service", price: 0, basePrice: 9.99, couponText: "first order", onlineOnly: true },
      { id: "in-chicken", title: "Chicken breast online lane", category: "protein", itemKey: "Chicken breast", price: 3.18, basePrice: 3.49, onlineOnly: true },
      { id: "in-eggs", title: "Eggs online lane", category: "dairy", itemKey: "Eggs", price: 3.74, basePrice: 4.10, onlineOnly: true },
    ],
  },
];

export const DEFAULT_MEAL_PLANS: MealPlan[] = [
  {
    id: "chicken-rice",
    name: "Chicken + rice bowls",
    ingredients: ["Chicken breast", "Rice", "Green beans"],
    notes: ["cheap protein week", "easy batch meal"],
  },
  {
    id: "beef-pasta",
    name: "Beef pasta skillet",
    ingredients: ["Ground beef", "Pasta", "Shredded cheese"],
    notes: ["strong coupon stack", "fast dinner"],
  },
  {
    id: "salad-eggs",
    name: "Salad + eggs lunch prep",
    ingredients: ["Romaine / lettuce", "Eggs", "Shredded cheese"],
    notes: ["light meal", "good pickup lane"],
  },
];

export const DEFAULT_SWAGBUCKS_STORES: SwagbucksStore[] = [
  {
    id: "instacart",
    name: "Instacart",
    cashbackRate: 2.5,
    stackConfidence: "green",
    bestUse: "Best for pickup or delivery when the full order can stay inside the tracked online session.",
  },
  {
    id: "walmart",
    name: "Walmart",
    cashbackRate: 1.0,
    stackConfidence: "yellow",
    bestUse: "Useful for pickup flow when the official offer and the cash-back lane agree.",
  },
  {
    id: "albertsons",
    name: "Albertsons / Vons",
    cashbackRate: 1.5,
    stackConfidence: "yellow",
    bestUse: "Good when member offers are strong and you stay in the tracked online lane.",
  },
];

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function buildCouponConfidence(retailer: Retailer) {
  if (retailer.cashBackFriendly === "green") {
    return {
      label: "green lane",
      tone: "green" as const,
      note: "Official digital coupons and online checkout usually play together well here.",
    };
  }
  if (retailer.cashBackFriendly === "yellow") {
    return {
      label: "stack carefully",
      tone: "yellow" as const,
      note: "Use official store offers first. Third-party coupon codes may break cash back.",
    };
  }
  return {
    label: "watch the fine print",
    tone: "red" as const,
    note: "Treat this as an edge case. Good for browsing, not always the safest tracked lane.",
  };
}

function findDealsForItem(itemName: string, retailers: Retailer[]) {
  return retailers.flatMap((retailer) =>
    retailer.deals
      .filter((deal) => deal.itemKey === itemName)
      .map((deal) => ({
        retailerId: retailer.id,
        retailerName: retailer.name,
        price: deal.price,
        basePrice: deal.basePrice ?? deal.price,
        couponLabel: deal.couponText || deal.promoCode || "base price",
        onlineOnly: !!deal.onlineOnly,
      }))
  );
}

export function buildBestBasket(items: GroceryItem[], retailers: Retailer[]): BestBasketResult {
  const mixedBasket: BasketLine[] = items.map((item) => {
    const options = findDealsForItem(item.name, retailers).sort((a, b) => a.price - b.price);
    const best = options[0] || {
      retailerId: "manual",
      retailerName: "manual add",
      price: 0,
      basePrice: 0,
      couponLabel: "check store",
      onlineOnly: false,
    };
    return {
      item: item.name,
      retailerId: best.retailerId,
      retailerName: best.retailerName,
      price: best.price,
      basePrice: best.basePrice,
      couponLabel: best.couponLabel,
      savings: Math.max(0, best.basePrice - best.price),
    };
  });

  const total = mixedBasket.reduce((sum, line) => sum + line.price, 0);
  const baseTotal = mixedBasket.reduce((sum, line) => sum + line.basePrice, 0);

  const perStore = retailers.map((retailer) => {
    const storeLines = items.map((item) => {
      const deal = retailer.deals.find((entry) => entry.itemKey === item.name);
      return deal
        ? {
            price: deal.price,
            basePrice: deal.basePrice ?? deal.price,
          }
        : {
            price: 9999,
            basePrice: 9999,
          };
    });
    const total = storeLines.reduce((sum, line) => sum + line.price, 0);
    const base = storeLines.reduce((sum, line) => sum + line.basePrice, 0);
    return {
      retailerId: retailer.id,
      retailerName: retailer.name,
      total,
      estimatedSavings: Math.max(0, base - total),
    };
  }).filter((row) => row.total < 9999);

  const bestSingleStore = perStore.sort((a, b) => a.total - b.total)[0] ?? null;

  return {
    total,
    baseTotal,
    estimatedSavings: Math.max(0, baseTotal - total),
    mixedBasket,
    bestSingleStore,
  };
}

export function buildRetailerSummaries(items: GroceryItem[], retailers: Retailer[]): RetailerSummary[] {
  return retailers
    .map((retailer) => {
      let basketTotal = 0;
      let savings = 0;
      let onlineOnlyCount = 0;
      items.forEach((item) => {
        const deal = retailer.deals.find((entry) => entry.itemKey === item.name);
        if (deal) {
          basketTotal += deal.price;
          savings += Math.max(0, (deal.basePrice ?? deal.price) - deal.price);
          if (deal.onlineOnly) onlineOnlyCount += 1;
        } else {
          basketTotal += 9999;
        }
      });
      return {
        retailerId: retailer.id,
        retailerName: retailer.name,
        basketTotal,
        savings,
        onlineOnlyCount,
        confidence: buildCouponConfidence(retailer),
      };
    })
    .filter((row) => row.basketTotal < 9999)
    .sort((a, b) => a.basketTotal - b.basketTotal);
}

export function buildMealSuggestions(meals: MealPlan[], retailers: Retailer[]): MealSuggestion[] {
  return meals.map((meal) => {
    const ingredientPricing = meal.ingredients.map((ingredient) => {
      const best = retailers
        .flatMap((retailer) =>
          retailer.deals
            .filter((deal) => deal.itemKey === ingredient)
            .map((deal) => ({
              retailerName: retailer.name,
              price: deal.price,
            }))
        )
        .sort((a, b) => a.price - b.price)[0];

      return {
        ingredient,
        retailerName: best?.retailerName ?? "manual add",
        price: best?.price ?? 0,
      };
    });

    const estimatedCost = ingredientPricing.reduce((sum, item) => sum + item.price, 0);
    const retailerCount: Record<string, number> = {};
    ingredientPricing.forEach((entry) => {
      retailerCount[entry.retailerName] = (retailerCount[entry.retailerName] ?? 0) + 1;
    });

    const bestRetailerName = Object.entries(retailerCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "mixed basket";

    return {
      id: meal.id,
      name: meal.name,
      bestRetailerName,
      estimatedCost,
      potentialSavings: estimatedCost > 0 ? Math.max(0, estimatedCost * 0.12) : 0,
      ingredients: meal.ingredients,
      itemRetailers: Object.fromEntries(
        ingredientPricing.map((entry) => [entry.ingredient, entry.retailerName])
      ),
      notes: meal.notes,
    };
  });
}

export function buildSwapSuggestions(items: GroceryItem[], retailers: Retailer[]): BasketSwap[] {
  const swaps: BasketSwap[] = [];
  items.forEach((item) => {
    const options = findDealsForItem(item.name, retailers).sort((a, b) => a.price - b.price);
    if (options.length < 2) return;
    const best = options[0];
    const second = options[1];
    const saveAmount = Math.max(0, second.price - best.price);
    if (saveAmount < 0.25) return;
    swaps.push({
      item: item.name,
      fromRetailer: second.retailerName,
      toRetailer: best.retailerName,
      saveAmount,
      note: `Shift this item to ${best.retailerName} and keep the rest of the basket steady.`,
    });
  });
  return swaps.sort((a, b) => b.saveAmount - a.saveAmount).slice(0, 6);
}

export function buildDealHighlights(retailers: Retailer[]): DealHighlight[] {
  return retailers
    .flatMap((retailer) =>
      retailer.deals.map((deal) => ({
        retailerName: retailer.name,
        title: deal.title,
        category: String(deal.category),
        price: deal.price,
        savings: Math.max(0, (deal.basePrice ?? deal.price) - deal.price),
        couponText: deal.couponText || deal.promoCode,
        onlineOnly: !!deal.onlineOnly,
      }))
    )
    .sort((a, b) => b.savings - a.savings || a.price - b.price)
    .slice(0, 8);
}
