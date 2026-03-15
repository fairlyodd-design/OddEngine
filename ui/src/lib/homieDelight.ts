import { normalizePanelId } from "./brain";

const PANEL_DELIGHT: Record<string, string[]> = {
  Home: [
    "Heartbeat looks steady. Want the next easy win?",
    "Home is calm right now. Good time to pick one lane and move.",
  ],
  Trading: [
    "Trading is live. Stay selective, not busy.",
    "One good setup beats ten noisy clicks.",
  ],
  TradingPanel: [
    "Desk is ready. Protect your focus first.",
    "Command deck looks clean. Want the sharpest next move?",
  ],
  MarketGraphPanel: [
    "Charts are up. Read the story before the trade.",
    "Graph first, trigger second.",
  ],
  OptionsSniperTerminal: [
    "Options chains are open. Quality over adrenaline.",
    "Check spread, freshness, and edge before you fire.",
  ],
  Books: [
    "Studio is open. Tiny progress still counts.",
    "Creative lane is warm. Want to keep momentum going?",
  ],
  FamilyBudget: [
    "Budget looks like a check-in lane, not a panic lane.",
    "One clean money move helps the whole house.",
  ],
  GroceryMeals: [
    "Meals lane is open. Planning now saves stress later.",
    "Small grocery clarity goes a long way.",
  ],
  DailyChores: [
    "Chores don’t need drama. Just the next small win.",
    "Quick household momentum beats perfection.",
  ],
  Calendar: [
    "Calendar is your future self asking for backup.",
    "A little timing clarity changes the whole day.",
  ],
  Homie: [
    "I’m here with you. We can keep it simple.",
    "No chaos goblins. Just the next solid step.",
  ],
};

const IDLE = [
  "System’s looking steadier. Nice.",
  "We can keep this simple and smooth.",
  "Tiny wins still count. Keep going.",
  "No rush. One clean move at a time.",
  "We’re in a good groove right now.",
];

function pick(arr: string[], seed: number) {
  if (!arr.length) return "";
  return arr[Math.abs(seed) % arr.length] || arr[0] || "";
}

export function getHomiePanelDelight(panelId: string, seed = Date.now()) {
  const id = normalizePanelId(panelId);
  return pick(PANEL_DELIGHT[id] || [], seed) || "I’ve got you. Want the next best move?";
}

export function getHomieIdleDelight(seed = Date.now()) {
  return pick(IDLE, seed);
}
