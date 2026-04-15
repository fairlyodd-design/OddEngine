
import { loadCalendar, fmtDate, type CalEvent } from "./calendarStore";
import { loadJSON } from "./storage";

const FAMILY_BUDGET_KEY = "oddengine:familyBudget:v2";
const MONEY_OFFERS_KEY = "oddengine:money:offers:v1";
const SELLABLES_KEY = "oddengine:money:sellables:v1";

type RecurringItem = {
  id: string;
  name: string;
  amount: number;
  nextDue: string;
  type: "bill" | "subscription";
  category: string;
};

type Account = {
  id: string;
  name: string;
  type: string;
  balance: number;
  apr?: number;
  minPayment?: number;
};

type Goal = {
  id: string;
  name: string;
  target: number;
  current: number;
  monthly: number;
};

type PlanMonth = {
  month: string;
  expectedIncome: number;
  fixedExpenses: number;
  flexibleExpenses: number;
  nonMonthlyExpenses: number;
  savingsGoal: number;
};

type FamilyBudgetState = {
  household?: { name?: string; currency?: string };
  accounts?: Account[];
  recurring?: RecurringItem[];
  goals?: Goal[];
  annualPlan?: PlanMonth[];
};

type OfferState = {
  focus?: string;
  buyer?: string;
  problem?: string;
  offer?: string;
  pricing?: string;
  fastestPath?: string;
};

type Sellable = {
  id: string;
  kind: "Book" | "GPT" | "App" | "Template";
  title: string;
  target: string;
  price: string;
  status: "Idea" | "Building" | "Listed" | "Selling";
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export type MoneyHouseholdAction = {
  title: string;
  detail: string;
  panelId: "FamilyBudget" | "Calendar" | "Money";
};

export type MoneyHouseholdOpsSnapshot = {
  householdName: string;
  currency: string;
  headline: string;
  subline: string;
  projectedFreeCash: number;
  dueSoonTotal: number;
  dueSoonCount: number;
  cashOnHand: number;
  goalGap: number;
  debtBalance: number;
  debtFocus: string;
  shipFocus: string;
  weeklyReviewDate: string;
  dueSoon: Array<{ title: string; amount: number; date: string; panelId: "FamilyBudget" | "Calendar" }>;
  actionQueue: MoneyHouseholdAction[];
  weeklyLaunchItems: Sellable[];
  upcomingLaunchEvents: CalEvent[];
  offerFocus: string;
};

function moneyNumber(n: unknown) {
  const v = Number(n || 0);
  return Number.isFinite(v) ? v : 0;
}

function monthKey(d = new Date()) {
  return fmtDate(d).slice(0, 7);
}

function daysBetween(fromIso: string, toIso: string) {
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function loadBudget(): FamilyBudgetState {
  return loadJSON<FamilyBudgetState>(FAMILY_BUDGET_KEY, {
    household: { name: "Household", currency: "USD" },
    accounts: [],
    recurring: [],
    goals: [],
    annualPlan: [],
  });
}

function loadOffers(): OfferState {
  return loadJSON<OfferState>(MONEY_OFFERS_KEY, {});
}

function loadSellables(): Sellable[] {
  const rows = loadJSON<Sellable[]>(SELLABLES_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function buildMoneyHouseholdOpsSnapshot(): MoneyHouseholdOpsSnapshot {
  const budget = loadBudget();
  const calendar = loadCalendar();
  const offers = loadOffers();
  const sellables = loadSellables();
  const today = fmtDate(new Date());
  const currentMonth = monthKey();

  const currency = String(budget.household?.currency || "USD");
  const householdName = String(budget.household?.name || "Household");

  const accounts = Array.isArray(budget.accounts) ? budget.accounts : [];
  const recurring = Array.isArray(budget.recurring) ? budget.recurring : [];
  const goals = Array.isArray(budget.goals) ? budget.goals : [];
  const annualPlan = Array.isArray(budget.annualPlan) ? budget.annualPlan : [];

  const cashOnHand = accounts
    .filter((a) => String(a.type).toUpperCase() === "CHECKING" || String(a.type).toUpperCase() === "SAVINGS")
    .reduce((sum, a) => sum + moneyNumber(a.balance), 0);

  const liabilities = accounts
    .filter((a) => moneyNumber(a.balance) < 0 || String(a.type).toUpperCase() === "CREDIT_CARD" || String(a.type).toUpperCase() == "LOAN")
    .map((a) => ({
      ...a,
      payoffBalance: Math.abs(moneyNumber(a.balance)),
      aprSafe: moneyNumber(a.apr),
    }))
    .filter((a) => a.payoffBalance > 0.009)
    .sort((a, b) => b.aprSafe - a.aprSafe || b.payoffBalance - a.payoffBalance);

  const debtBalance = liabilities.reduce((sum, a) => sum + a.payoffBalance, 0);
  const debtFocus = liabilities[0]?.name || "No active debt focus";

  const currentPlan = annualPlan.find((row) => row.month === currentMonth) || annualPlan[0];
  const projectedFreeCash = currentPlan
    ? moneyNumber(currentPlan.expectedIncome) - moneyNumber(currentPlan.fixedExpenses) - moneyNumber(currentPlan.flexibleExpenses) - moneyNumber(currentPlan.nonMonthlyExpenses) - moneyNumber(currentPlan.savingsGoal)
    : 0;

  const dueSoonRecurring = recurring
    .filter((item) => {
      const diff = daysBetween(today, item.nextDue);
      return diff >= 0 && diff <= 7;
    })
    .map((item) => ({
      title: item.name,
      amount: moneyNumber(item.amount),
      date: item.nextDue,
      panelId: "FamilyBudget" as const,
    }));

  const upcomingLaunchEvents = (calendar.events || [])
    .filter((item) => {
      const diff = daysBetween(today, item.date);
      return diff >= 0 && diff <= 14 && (item.panelId === "Money" || item.panelId === "FamilyBudget" || /launch|publish|money/i.test(item.title || ""));
    })
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))
    .slice(0, 4);

  const dueSoonCalendar = upcomingLaunchEvents
    .filter((item) => daysBetween(today, item.date) <= 7)
    .map((item) => ({
      title: item.title,
      amount: 0,
      date: item.date,
      panelId: "Calendar" as const,
    }));

  const dueSoon = [...dueSoonRecurring, ...dueSoonCalendar]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const dueSoonTotal = dueSoonRecurring.reduce((sum, item) => sum + item.amount, 0);
  const dueSoonCount = dueSoon.length;

  const goalGap = goals.reduce((sum, goal) => sum + Math.max(0, moneyNumber(goal.target) - moneyNumber(goal.current)), 0);

  const weeklyLaunchItems = sellables
    .filter((item) => item.status === "Building" || item.status === "Idea" || item.status === "Listed")
    .sort((a, b) => {
      const order = { Building: 0, Listed: 1, Idea: 2, Selling: 3 } as const;
      return order[a.status] - order[b.status] || b.updatedAt - a.updatedAt;
    })
    .slice(0, 4);

  const shipFocus = weeklyLaunchItems[0]?.title || "No ship focus picked yet";
  const weeklyReviewDate = upcomingLaunchEvents[0]?.date || today;
  const offerFocus = String(offers.fastestPath || offers.offer || offers.focus || "Ship one clean paid thing before expanding the suite.");

  const actionQueue: MoneyHouseholdAction[] = [];
  if (projectedFreeCash < 0) {
    actionQueue.push({
      title: "Bring the month back into the green",
      detail: "Open Family Budget and trim flexible spending before touching essentials.",
      panelId: "FamilyBudget",
    });
  }
  if (dueSoonTotal > 0) {
    actionQueue.push({
      title: "Cover bills due this week",
      detail: `${dueSoonRecurring.length} recurring item(s) need cash coverage soon.`,
      panelId: "FamilyBudget",
    });
  }
  if (debtBalance > 0) {
    actionQueue.push({
      title: `Attack ${debtFocus}`,
      detail: "Use the payoff planner to decide the next household pressure release.",
      panelId: "FamilyBudget",
    });
  }
  if (weeklyLaunchItems.length) {
    actionQueue.push({
      title: `Ship ${shipFocus}`,
      detail: "Keep the money lane honest: one sellable pushed forward this week.",
      panelId: "Money",
    });
  }
  if (!actionQueue.length || upcomingLaunchEvents.length) {
    actionQueue.push({
      title: "Review launch timing",
      detail: "Use Calendar to keep ship / publish / review dates visible.",
      panelId: "Calendar",
    });
  }

  let headline = "Money is stable enough to operate deliberately.";
  if (projectedFreeCash < 0) {
    headline = `This month is projected short before the household finish line.`;
  } else if (dueSoonTotal > cashOnHand && dueSoonTotal > 0) {
    headline = `Bills due soon are heavier than easy cash on hand.`;
  } else if (debtBalance > 0) {
    headline = `${debtFocus} is still the loudest pressure point in the house.`;
  } else if (weeklyLaunchItems.length) {
    headline = `Your cleanest money move is to ship ${shipFocus}.`;
  }

  const subline = [
    projectedFreeCash < 0 ? "Trim flexible spend first." : "Protect essentials and keep momentum.",
    dueSoonTotal > 0 ? `${dueSoonRecurring.length} due-soon bill(s) are visible.` : "No urgent recurring bill pile is showing right now.",
    weeklyLaunchItems.length ? `${weeklyLaunchItems.length} sellable(s) are waiting for a push.` : "Seed one product lane and give it a date."
  ].join(" ");

  return {
    householdName,
    currency,
    headline,
    subline,
    projectedFreeCash,
    dueSoonTotal,
    dueSoonCount,
    cashOnHand,
    goalGap,
    debtBalance,
    debtFocus,
    shipFocus,
    weeklyReviewDate,
    dueSoon,
    actionQueue: actionQueue.slice(0, 4),
    weeklyLaunchItems,
    upcomingLaunchEvents,
    offerFocus,
  };
}
