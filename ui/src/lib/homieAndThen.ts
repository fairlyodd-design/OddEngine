export type AndThenStep = { label: string; panelId: string; reason: string };
export type AndThenPlan = { lead: string; vibe: string; nextSteps: AndThenStep[]; easter?: string | null };
const RECENT_KEY = "oddengine:homie:recent-panels:v1";
function normalize(input: string) { return String(input || "").trim() || "Home"; }
export function trackHomieRoom(panelId: string) {
  try {
    const id = normalize(panelId);
    const raw = localStorage.getItem(RECENT_KEY);
    const prev = raw ? JSON.parse(raw) : [];
    const next = [id, ...prev.filter((x: string) => x !== id)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    return next;
  } catch { return [normalize(panelId)]; }
}
export function recentHomieRooms(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const prev = raw ? JSON.parse(raw) : [];
    return Array.isArray(prev) ? prev.slice(0, 8).map((x) => normalize(String(x))) : [];
  } catch { return []; }
}
export function getAndThenPlan(panelId: string): AndThenPlan {
  const id = normalize(panelId);
  const hour = new Date().getHours();
  const late = hour >= 22 || hour < 6;
  const calm = late ? "Keep it simple tonight." : "Keep the momentum, not the chaos.";
  switch (id) {
    case 'Trading':
    case 'TradingPanel':
    case 'OptionsSniperTerminal':
    case 'MarketGraphPanel':
      return {
        lead: 'Trading is hot. And then? Tighten the chart, check the chain, and stay disciplined.',
        vibe: calm,
        nextSteps: [
          { label: 'Charts + Graphs', panelId: 'MarketGraphPanel', reason: 'Read structure before you click anything.' },
          { label: 'Options Chains', panelId: 'OptionsSniperTerminal', reason: 'Check liquidity, spread, and freshness.' },
          { label: 'Trading Home', panelId: 'TradingPanel', reason: 'Reset the thesis and next action.' },
        ],
        easter: Math.random() < 0.12 ? 'And then? We do the obvious smart thing, not the chaotic thing.' : null,
      };
    case 'Books':
      return {
        lead: 'Studio is open. And then? Turn the spark into something shippable.',
        vibe: late ? 'Ship one small creative win.' : 'Move the project one room forward.',
        nextSteps: [
          { label: 'Studio', panelId: 'Books', reason: 'Keep the creative pipeline moving.' },
          { label: 'Home', panelId: 'Home', reason: 'Check the rest of the OS pulse before a deep dive.' },
          { label: 'Homie', panelId: 'Homie', reason: 'Use Homie for a calm next-step nudge.' },
        ],
        easter: Math.random() < 0.08 ? 'Creative chaos is allowed. Messy direction changes are not.' : null,
      };
    case 'GroceryMeals':
    case 'FamilyBudget':
    case 'DailyChores':
    case 'Calendar':
      return {
        lead: 'Family lane is live. And then? Handle the next practical thing and clear space in the house.',
        vibe: 'Small clean wins add up fast here.',
        nextSteps: [
          { label: 'Daily Chores', panelId: 'DailyChores', reason: 'Knock out the easy visible wins.' },
          { label: 'Calendar', panelId: 'Calendar', reason: 'Check timing before adding more.' },
          { label: 'Family Budget', panelId: 'FamilyBudget', reason: 'Keep the household pulse grounded.' },
        ],
        easter: Math.random() < 0.08 ? 'And then? We make future-us happy.' : null,
      };
    case 'Homie':
      return {
        lead: 'I’m here. And then? Pick the next lane and I’ll keep it steady.',
        vibe: late ? 'Low pressure. Clear next move.' : 'You do not need ten next steps. You need one good one.',
        nextSteps: [
          { label: 'Home', panelId: 'Home', reason: 'Mission control first.' },
          { label: 'Trading Home', panelId: 'TradingPanel', reason: 'If money mode is active, start disciplined.' },
          { label: 'Studio', panelId: 'Books', reason: 'If the idea is alive, move it forward.' },
        ],
        easter: Math.random() < 0.1 ? 'And then? We keep the vibe weird, warm, and useful.' : null,
      };
    default:
      return {
        lead: 'And then? Take the clean next step and keep the OS flowing.',
        vibe: calm,
        nextSteps: [
          { label: 'Home', panelId: 'Home', reason: 'See the whole board.' },
          { label: 'Homie', panelId: 'Homie', reason: 'Get a calm nudge.' },
          { label: 'Trading Home', panelId: 'TradingPanel', reason: 'If focus is high, use the workstation.' },
        ],
        easter: Math.random() < 0.06 ? 'Zoltan. Kidding. Mostly.' : null,
      };
  }
}
