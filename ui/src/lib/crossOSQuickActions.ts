export type CrossOSQuickAction = {
  id: string;
  title: string;
  panelId: string;
  description: string;
  icon: string;
  group: string;
};

export type CrossOSQuickActionGroup = {
  id: string;
  eyebrow: string;
  title: string;
  actions: CrossOSQuickAction[];
};

export const CROSS_OS_ACTION_GROUPS: CrossOSQuickActionGroup[] = [
  {
    id: "heartbeat",
    eyebrow: "HEARTBEAT",
    title: "Home + Homie",
    actions: [
      { id: "home", title: "Open Home", panelId: "Home", description: "Return to mission control.", icon: "🏠", group: "Home + Homie" },
      { id: "homie", title: "Open Homie", panelId: "Homie", description: "Check in with your companion deck.", icon: "👊", group: "Home + Homie" },
      { id: "calendar", title: "Open Calendar", panelId: "Calendar", description: "Review what is next today.", icon: "📅", group: "Home + Homie" },
    ],
  },
  {
    id: "family",
    eyebrow: "HOUSEHOLD",
    title: "Family flow",
    actions: [
      { id: "chores", title: "Daily Chores", panelId: "DailyChores", description: "Reset the house and daily checklists.", icon: "🧹", group: "Family flow" },
      { id: "grocery", title: "Grocery Meals", panelId: "GroceryMeals", description: "Plan meals and shopping in one lane.", icon: "🛒", group: "Family flow" },
      { id: "budget", title: "Family Budget", panelId: "FamilyBudget", description: "Check household money and next bills.", icon: "💸", group: "Family flow" },
    ],
  },
  {
    id: "trading",
    eyebrow: "MARKET",
    title: "Trading deck",
    actions: [
      { id: "trading", title: "Trading Home", panelId: "Trading", description: "Open the trading command deck.", icon: "🎯", group: "Trading deck" },
      { id: "graphs", title: "Charts + Graphs", panelId: "MarketGraphPanel", description: "See structure, trend, and graph lanes.", icon: "📈", group: "Trading deck" },
      { id: "chains", title: "Options Chains", panelId: "OptionsSniperTerminal", description: "Jump straight into options chains.", icon: "🧾", group: "Trading deck" },
    ],
  },
  {
    id: "studio",
    eyebrow: "CREATIVE",
    title: "Studio flow",
    actions: [
      { id: "studio", title: "Studio Home", panelId: "Books", description: "Enter the creative engine.", icon: "🎬", group: "Studio flow" },
      { id: "builder", title: "Builder", panelId: "Builder", description: "Shape scenes, layouts, and concepts.", icon: "🧱", group: "Studio flow" },
      { id: "entertainment", title: "Entertainment", panelId: "Entertainment", description: "Open family night and inspiration.", icon: "🎵", group: "Studio flow" },
    ],
  },
];

export function flattenCrossOSActions() {
  return CROSS_OS_ACTION_GROUPS.flatMap((group) => group.actions);
}
