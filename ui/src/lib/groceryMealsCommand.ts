export type MealPlan = { day: string; breakfast: string; lunch: string; dinner: string; snacks: string };
export type GroceryState = {
  pantry: string;
  dietaryTags: string;
  meals: MealPlan[];
  groceryList: string[];
  couponMatches: string[];
  priceBook: Record<string, number>;
  storePlan: string[];
  basketGoal: string;
  preferredStores: string[];
  cheapWeekMode: boolean;
};

export type GroceryActionTone = "good" | "warn" | "bad";

export type GroceryAction = {
  id: string;
  title: string;
  body: string;
  tone: GroceryActionTone;
  actionId: "build-list" | "refresh-coupons" | "estimate-basket" | "cheap-week" | "store-plan" | "match-coupons";
};

export type GrocerySubstitution = {
  need: string;
  swap: string;
  why: string;
};

export type GroceryMealIdea = {
  title: string;
  why: string;
  ingredients: string[];
};

export type GroceryStapleStatus = {
  label: string;
  state: "ready" | "low" | "missing";
};

export type GroceryCommand = {
  whatMattersToday: string;
  doThisNow: GroceryAction;
  actionQueue: GroceryAction[];
  substitutions: GrocerySubstitution[];
  mealIdeas: GroceryMealIdea[];
  stapleStatus: GroceryStapleStatus[];
  estimatedCost: number;
  targetNumber: number;
  budgetDelta: number;
  pantryCoverage: number;
  mustBuyNow: string[];
  trustedRouteNote: string;
};

export function normalizeItems(text: string) {
  return String(text || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function estimateItemPrice(item: string) {
  const text = String(item || "").toLowerCase();
  if (["chicken", "beef", "sausage", "turkey", "fish"].some((t) => text.includes(t))) return 6.5;
  if (["eggs", "milk", "yogurt", "cheese"].some((t) => text.includes(t))) return 4.2;
  if (["rice", "beans", "oatmeal", "bread", "pasta", "potatoes", "tortilla"].some((t) => text.includes(t))) return 2.5;
  if (["berries", "banana", "apple", "fruit", "vegetable", "broccoli", "carrots", "salad"].some((t) => text.includes(t))) return 3.1;
  if (["snack", "chips", "crackers", "juice"].some((t) => text.includes(t))) return 3.9;
  return 4.0;
}

function sumPriceBook(items: string[], priceBook: Record<string, number>) {
  return items.reduce((sum, item) => sum + Number(priceBook[item] || estimateItemPrice(item) || 0), 0);
}

function cleanGoalNumber(text: string) {
  return Number(String(text || "").replace(/[^0-9.]/g, "")) || 0;
}

function pantryHas(pantryItems: string[], needle: string) {
  const lower = needle.toLowerCase();
  return pantryItems.some((item) => item.toLowerCase().includes(lower));
}

function computePantryCoverage(state: GroceryState) {
  const raw = state.meals
    .flatMap((meal) => [meal.breakfast, meal.lunch, meal.dinner, meal.snacks])
    .flatMap((entry) => normalizeItems(entry));
  const deduped = Array.from(new Set(raw.map((item) => item.trim()).filter(Boolean)));
  if (!deduped.length) return 0;
  return Math.max(0, Math.round(((deduped.length - state.groceryList.length) / deduped.length) * 100));
}

function buildStaples(pantryItems: string[]): GroceryStapleStatus[] {
  const staples = [
    { label: "Eggs", keys: ["egg"] },
    { label: "Rice", keys: ["rice"] },
    { label: "Beans", keys: ["bean"] },
    { label: "Bread / Tortillas", keys: ["bread", "tortilla"] },
    { label: "Frozen vegetables", keys: ["frozen veg", "vegetable", "broccoli", "mixed veg"] },
    { label: "Fruit", keys: ["banana", "apple", "fruit"] },
    { label: "Oats / cereal", keys: ["oat", "cereal"] },
    { label: "Milk / yogurt", keys: ["milk", "yogurt"] },
  ];
  return staples.map((staple) => {
    const hits = staple.keys.filter((key) => pantryHas(pantryItems, key)).length;
    return {
      label: staple.label,
      state: hits >= 1 ? "ready" : hits === 0 ? "missing" : "low",
    };
  });
}

function buildSubstitutions(list: string[], pantryItems: string[]): GrocerySubstitution[] {
  const out: GrocerySubstitution[] = [];
  const push = (need: string, swap: string, why: string) => {
    if (out.some((item) => item.need === need)) return;
    out.push({ need, swap, why });
  };

  list.forEach((item) => {
    const text = item.toLowerCase();
    if (text.includes("berries")) push(item, "bananas or apples", "Usually cheaper and easier to stretch through the week.");
    else if (text.includes("spinach") || text.includes("salad")) push(item, "frozen mixed vegetables", "Less waste and often cheaper per serving.");
    else if (text.includes("chicken breast")) push(item, "chicken thighs", "Usually cheaper and better for leftovers.");
    else if (text.includes("ground beef")) push(item, "beans + rice, turkey, or lentils", "Drops basket cost while keeping meal volume high.");
    else if (text.includes("chips") || text.includes("cookies")) push(item, "popcorn or crackers already on hand", "Easy snack savings without changing the whole meal plan.");
    else if (text.includes("juice")) push(item, "water + fruit", "Cuts cost and usually stretches farther.");
  });

  if (!out.length && pantryHas(pantryItems, "rice")) {
    push("extra takeout-style side", "rice bowl with whatever protein is on hand", "Use the pantry to soak up flavor without adding a new spend lane.");
  }
  return out.slice(0, 6);
}

function buildMealIdeas(pantryItems: string[], dietaryTags: string): GroceryMealIdea[] {
  const tags = String(dietaryTags || "").toLowerCase();
  const ideas: GroceryMealIdea[] = [];
  const has = (key: string) => pantryHas(pantryItems, key);
  const add = (title: string, why: string, ingredients: string[]) => {
    if (ideas.some((item) => item.title === title)) return;
    ideas.push({ title, why, ingredients });
  };

  if (has("rice") && has("egg") && (has("vegetable") || has("broccoli"))) {
    add("Leftover fried rice", "Cheap, fast, and great for using up odds and ends.", ["rice", "eggs", "vegetables"]);
  }
  if (has("bean") && (has("tortilla") || has("bread"))) {
    add("Bean burritos or melts", "Good protein-per-dollar and easy kid food.", ["beans", "tortillas or bread", "cheese if available"]);
  }
  if (has("pasta") && has("vegetable")) {
    add("Pasta night with vegetables", "One pot, easy leftovers, pantry friendly.", ["pasta", "marinara or oil", "vegetables"]);
  }
  if (has("oat") || has("oatmeal")) {
    add("Stretch breakfast bowls", "Cheap breakfast anchor for busy mornings.", ["oats", "banana or apple", "peanut butter if available"]);
  }
  if (!ideas.length) {
    add("Cheap week soup + sandwich", "Fallback family lane when the pantry is thin.", ["bread", "soup", "fruit"]);
  }
  if (tags.includes("high protein")) {
    add("Protein bowl", "Easy way to keep meals filling without lots of separate ingredients.", ["eggs or chicken", "rice or potatoes", "vegetables"]);
  }
  return ideas.slice(0, 5);
}

export function buildGroceryMealsCommand(state: GroceryState, hasSaverPack: boolean): GroceryCommand {
  const pantryItems = normalizeItems(state.pantry);
  const estimatedCost = sumPriceBook(state.groceryList, state.priceBook);
  const targetNumber = cleanGoalNumber(state.basketGoal);
  const budgetDelta = targetNumber ? estimatedCost - targetNumber : 0;
  const pantryCoverage = computePantryCoverage(state);
  const stapleStatus = buildStaples(pantryItems);
  const substitutions = buildSubstitutions(state.groceryList, pantryItems);
  const mealIdeas = buildMealIdeas(pantryItems, state.dietaryTags);
  const mustBuyNow = state.groceryList.slice(0, 6);

  const actionQueue: GroceryAction[] = [];
  const pushAction = (action: GroceryAction) => actionQueue.push(action);

  if (!state.groceryList.length) {
    pushAction({
      id: "build-list",
      title: "Build the real grocery list",
      body: "Turn the meal plan into the actual buy-now list first so the rest of the lane has something trustworthy to work from.",
      tone: "warn",
      actionId: "build-list",
    });
  }

  if (targetNumber && budgetDelta > 0) {
    pushAction({
      id: "trim-basket",
      title: "Trim the basket before checkout",
      body: `The estimate is about $${budgetDelta.toFixed(0)} over the goal. Use substitutions and overlap meals before shopping.`,
      tone: budgetDelta > 20 ? "bad" : "warn",
      actionId: hasSaverPack ? "estimate-basket" : "build-list",
    });
  }

  if (hasSaverPack && !state.couponMatches.length) {
    pushAction({
      id: "refresh-coupons",
      title: "Refresh deals and coupon lane",
      body: "No live matches are helping the basket yet. Refresh the deal feed before choosing stores.",
      tone: "warn",
      actionId: "refresh-coupons",
    });
  }

  if (hasSaverPack && !state.storePlan.length) {
    pushAction({
      id: "store-plan",
      title: "Build the store plan",
      body: "Pick the main store and the backup store before the run so staples and deals work together.",
      tone: "warn",
      actionId: "store-plan",
    });
  }

  if (pantryCoverage < 45) {
    pushAction({
      id: "cheap-week",
      title: "Plan more overlap meals",
      body: "Pantry coverage is thin. Lean into repeat ingredients and cheap-week structure to stop the basket from ballooning.",
      tone: "warn",
      actionId: hasSaverPack ? "cheap-week" : "build-list",
    });
  }

  if (!actionQueue.length) {
    pushAction({
      id: "steady",
      title: "Keep the plan steady",
      body: "The pantry, meal plan, and basket estimate are working together pretty well right now. Refresh deals and run the list.",
      tone: "good",
      actionId: hasSaverPack ? "match-coupons" : "build-list",
    });
  }

  const doThisNow = actionQueue[0];

  const whatMattersToday = !state.groceryList.length
    ? "You do not have a trustworthy buy list yet. Build the list from meals first, then trim cost and match deals."
    : targetNumber && budgetDelta > 0
      ? `The basket is trending over goal. Cut extras, swap expensive proteins, and use more overlap meals before the run.`
      : hasSaverPack && !state.couponMatches.length
        ? "The list is built, but the savings lane is weak. Refresh deals and build a store plan before shopping."
        : `The meal plan, pantry, and list are lined up. Focus on the grocery run, prep, and keeping overlap ingredients working for the full week.`;

  const trustedRouteNote = hasSaverPack
    ? `Route this lane through ${state.preferredStores[0] || "Walmart"} first, then use ${state.preferredStores[1] || "your backup store"} only for stronger deal or produce/meat quality wins.`
    : "Build the list first, then compare it against Family Budget before the grocery run.";

  return {
    whatMattersToday,
    doThisNow,
    actionQueue: actionQueue.slice(0, 5),
    substitutions,
    mealIdeas,
    stapleStatus,
    estimatedCost,
    targetNumber,
    budgetDelta,
    pantryCoverage,
    mustBuyNow,
    trustedRouteNote,
  };
}
