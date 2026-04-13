import { buildActionQueue, buildPanelHealth, buildTopPriorities, getPanelMeta, normalizePanelId, runQuickAction } from "./brain";
import { listUpcoming, type CalEvent } from "./calendarStore";
import { loadJSON } from "./storage";

export type OperatorBrainDecision = {
  panelId: string;
  title: string;
  text: string;
  actionId?: string;
  actionLabel?: string;
};

export type OperatorBrainSnapshot = {
  generatedAt: number;
  whatMattersNow: OperatorBrainDecision;
  whereToGo: OperatorBrainDecision;
  whatToDoNext: OperatorBrainDecision;
  familyLane: OperatorBrainDecision;
  operatorLane: OperatorBrainDecision;
  todayTasks: Array<{ id: string; title: string; when: string; panelId: string }>;
  priorities: any[];
  actionQueue: any[];
  panelHealth: any[];
};

function todayKey() {
  const d = new Date();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseEventDate(ev: CalEvent) {
  const base = new Date(`${ev.date}T00:00:00`);
  if (ev.time && /^\d{2}:\d{2}$/.test(ev.time)) {
    const [hh, mm] = ev.time.split(":").map(Number);
    base.setHours(hh || 0, mm || 0, 0, 0);
  }
  return base;
}

function relWhen(ev: CalEvent) {
  const d = parseEventDate(ev);
  const now = new Date();
  const mins = Math.round((d.getTime() - now.getTime()) / 60000);
  const day = ev.date === todayKey() ? "Today" : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const time = ev.time ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Anytime";
  const hint = mins >= 0 && mins <= 180 ? ` • in ~${Math.max(0, mins)}m` : "";
  return `${day} • ${time}${hint}`;
}

function chooseFamilyLane(): OperatorBrainDecision {
  const today = todayKey();
  const upcoming = listUpcoming({ limit: 30 });
  const familyPanels = new Set(["FamilyBudget", "GroceryMeals", "DailyChores", "FamilyHealth", "Entertainment", "Calendar"]);
  const familyEvent = upcoming.find((ev) => familyPanels.has(normalizePanelId(ev.panelId || "")) || /(family|grocery|meal|doctor|appointment|budget|bill|chores|movie|game night)/i.test(ev.title || ""));
  if (familyEvent) {
    const pid = normalizePanelId(familyEvent.panelId || "Calendar");
    return {
      panelId: pid,
      title: familyEvent.title || `Open ${getPanelMeta(pid).title}`,
      text: relWhen(familyEvent),
    };
  }

  const budget = loadJSON<any>("oddengine:familyBudget:v2", null);
  const recurring = Array.isArray(budget?.recurring) ? [...budget.recurring] : [];
  recurring.sort((a: any, b: any) => String(a.nextDue || today).localeCompare(String(b.nextDue || today)));
  if (recurring.length) {
    const next = recurring[0];
    return {
      panelId: "FamilyBudget",
      title: `Upcoming bill: ${next.name}`,
      text: `${next.nextDue || today} • ${next.category || "Bill"}`,
    };
  }

  const grocery = loadJSON<any>("oddengine:groceryMeals:v1", {});
  const dealCount = Number(grocery?.couponMatches?.length || grocery?.couponFeed?.length || 0);
  if (dealCount > 0) {
    return {
      panelId: "GroceryMeals",
      title: `${dealCount} grocery deal${dealCount === 1 ? "" : "s"} waiting`,
      text: grocery?.couponMatches?.[0]?.title || grocery?.couponFeed?.[0]?.title || "Open Grocery Meals and save money first.",
    };
  }

  return {
    panelId: "Home",
    title: "Family front door is clear",
    text: "No urgent family item is stored right now. Start from Home and set today’s tasks.",
  };
}

function chooseOperatorLane(priorities: any[], panelHealth: any[]): OperatorBrainDecision {
  const preferred = priorities.find((item) => ["Trading", "Security", "Grow", "Money", "OptionsSaaS", "FamilyBudget"].includes(normalizePanelId(item.panelId || "")));
  if (preferred) {
    const meta = getPanelMeta(preferred.panelId);
    return {
      panelId: meta.id,
      title: `${meta.title} needs attention`,
      text: preferred.text || preferred.title || `Open ${meta.title}.`,
      actionId: preferred.actionId,
      actionLabel: preferred.actionLabel,
    };
  }
  const weakest = (panelHealth || [])[0];
  if (weakest) {
    return {
      panelId: weakest.panelId,
      title: `${weakest.title} is the weakest lane`,
      text: weakest.headline || `Open ${weakest.title}.`,
      actionId: weakest.nextActionId,
      actionLabel: weakest.nextActionLabel,
    };
  }
  return {
    panelId: "OddBrain",
    title: "Operator lanes are calm",
    text: "Use OddBrain to review the next move stack.",
  };
}

export function getOperatorBrainSnapshot(): OperatorBrainSnapshot {
  const priorities = buildTopPriorities(6);
  const actionQueue = buildActionQueue(6);
  const panelHealth = buildPanelHealth(["Trading", "FamilyBudget", "Grow", "News", "FamilyHealth", "GroceryMeals", "Security", "Money", "OptionsSaaS"]);
  const primary = priorities[0] || actionQueue[0] || null;
  const primaryPanelId = normalizePanelId(primary?.panelId || actionQueue[0]?.panelId || "Home");
  const primaryMeta = getPanelMeta(primaryPanelId);
  const familyLane = chooseFamilyLane();
  const operatorLane = chooseOperatorLane(priorities, panelHealth);
  const nextAction = actionQueue[0]
    ? {
        panelId: normalizePanelId(actionQueue[0].panelId || primaryPanelId),
        title: actionQueue[0].title || `Open ${primaryMeta.title}`,
        text: actionQueue[0].body || primary?.text || `Open ${primaryMeta.title}.`,
        actionId: actionQueue[0].actionId,
        actionLabel: actionQueue[0].actionLabel,
      }
    : {
        panelId: primaryPanelId,
        title: primary?.title || `Open ${primaryMeta.title}`,
        text: primary?.text || `Open ${primaryMeta.title}.`,
        actionId: primary?.actionId,
        actionLabel: primary?.actionLabel,
      };

  const whereToGo = nextAction.actionId
    ? nextAction
    : operatorLane.actionId
      ? operatorLane
      : familyLane;

  const todayTasks = listUpcoming({ limit: 20 })
    .filter((ev) => ev.date === todayKey())
    .slice(0, 5)
    .map((ev) => ({
      id: ev.id,
      title: ev.title || "Untitled task",
      when: relWhen(ev),
      panelId: normalizePanelId(ev.panelId || "Calendar"),
    }));

  return {
    generatedAt: Date.now(),
    whatMattersNow: {
      panelId: primaryPanelId,
      title: primary?.title || `${primaryMeta.title} matters now`,
      text: primary?.text || `Open ${primaryMeta.title}.`,
      actionId: primary?.actionId,
      actionLabel: primary?.actionLabel,
    },
    whereToGo: {
      panelId: normalizePanelId(whereToGo.panelId || primaryPanelId),
      title: getPanelMeta(normalizePanelId(whereToGo.panelId || primaryPanelId)).title,
      text: whereToGo.text,
      actionId: whereToGo.actionId,
      actionLabel: whereToGo.actionLabel,
    },
    whatToDoNext: nextAction,
    familyLane,
    operatorLane,
    todayTasks,
    priorities,
    actionQueue,
    panelHealth,
  };
}

export function runOperatorBrainNextAction() {
  const snapshot = getOperatorBrainSnapshot();
  if (snapshot.whatToDoNext.actionId) {
    return runQuickAction(snapshot.whatToDoNext.actionId);
  }
  return {
    ok: true,
    message: `Open ${getPanelMeta(snapshot.whatToDoNext.panelId).title}.`,
    panelId: snapshot.whatToDoNext.panelId,
  };
}
