import { loadJSON } from "./storage";
import { buildGroceryBudgetSnapshot, type GroceryBudgetSnapshot } from "./groceryBudgetBridge";

export type OpsHealth = "good" | "warn" | "bad";

export type HouseholdOpsSummary = {
  householdReadiness: number;
  status: OpsHealth;
  headline: string;
  detail: string;
  nextBestAction: string;
  grocery: GroceryBudgetSnapshot;
  choresOpenCount: number;
  calendarUpcomingCount: number;
  familyHealthMembers: number;
  blockerList: string[];
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function getDailyChoresOpenCount() {
  const state: any = loadJSON("oddengine:dailyChores:v1", {});
  const tasks = Array.isArray(state?.tasks) ? state.tasks : [];
  return tasks.filter((task: any) => !task?.done).length;
}

function getCalendarUpcomingCount() {
  const events: any[] = loadJSON("oddengine:calendarStore:v1", []);
  const now = Date.now();
  return (Array.isArray(events) ? events : []).filter((event) => {
    const ts = Date.parse(String(event?.date || event?.start || ""));
    return Number.isFinite(ts) && ts >= now;
  }).length;
}

function getFamilyHealthMemberCount() {
  const state: any = loadJSON("oddengine:familyHealth:v1", { members: [] });
  return Array.isArray(state?.members) ? state.members.length : 0;
}

export function buildHouseholdOpsSummary(): HouseholdOpsSummary {
  const grocery = buildGroceryBudgetSnapshot();
  const choresOpenCount = getDailyChoresOpenCount();
  const calendarUpcomingCount = getCalendarUpcomingCount();
  const familyHealthMembers = getFamilyHealthMemberCount();

  const blockerList: string[] = [];
  if (!grocery.ready) blockerList.push("Finish Grocery / FamilyBudget integration.");
  if (choresOpenCount > 12) blockerList.push("Daily Chores has a high open-task load.");
  if (!calendarUpcomingCount) blockerList.push("Calendar has no upcoming household checkpoints.");
  if (!familyHealthMembers) blockerList.push("Family Health has no tracked members.");

  const positiveSignals =
    (grocery.ready ? 1 : 0) +
    (choresOpenCount <= 8 ? 1 : 0) +
    (calendarUpcomingCount > 0 ? 1 : 0) +
    (familyHealthMembers > 0 ? 1 : 0);

  const readiness = clamp(Math.round((positiveSignals / 4) * 100));
  const status: OpsHealth = readiness >= 75 ? "good" : readiness >= 45 ? "warn" : "bad";

  let nextBestAction = "Open Home and review the household ops board.";
  if (!grocery.ready) {
    nextBestAction = "Open Grocery Meals and confirm a live grocery budget snapshot.";
  } else if (choresOpenCount > 8) {
    nextBestAction = "Open Daily Chores and knock out the top household tasks.";
  } else if (!calendarUpcomingCount) {
    nextBestAction = "Open Calendar and add the next grocery / family ops checkpoint.";
  } else if (!familyHealthMembers) {
    nextBestAction = "Open Family Health and add at least one family member record.";
  }

  const headline =
    status === "good"
      ? "Household ops lane is healthy."
      : status === "warn"
      ? "Household ops lane is partially ready."
      : "Household ops lane needs attention.";

  const detail = [
    `${grocery.ready ? "Grocery budget bridge is ready" : "Grocery budget bridge is not ready"}`,
    `${choresOpenCount} open chores`,
    `${calendarUpcomingCount} upcoming household events`,
    `${familyHealthMembers} family health member records`,
  ].join(" • ");

  return {
    householdReadiness: readiness,
    status,
    headline,
    detail,
    nextBestAction,
    grocery,
    choresOpenCount,
    calendarUpcomingCount,
    familyHealthMembers,
    blockerList,
  };
}

export function buildHouseholdOpsMarkdown(summary: HouseholdOpsSummary) {
  return [
    "# Household Ops Summary",
    "",
    `Readiness: ${summary.householdReadiness}%`,
    `Status: ${summary.status}`,
    `Headline: ${summary.headline}`,
    "",
    "## Current Signals",
    `- Grocery ready: ${summary.grocery.ready ? "yes" : "no"}`,
    `- Grocery planned spend: ${summary.grocery.plannedLabel}`,
    `- Grocery actual spend: ${summary.grocery.actualLabel}`,
    `- Grocery estimated savings: ${summary.grocery.savingsLabel}`,
    `- Open chores: ${summary.choresOpenCount}`,
    `- Upcoming calendar items: ${summary.calendarUpcomingCount}`,
    `- Family health members: ${summary.familyHealthMembers}`,
    "",
    "## Next Best Action",
    summary.nextBestAction,
    "",
    "## Blockers",
    ...(summary.blockerList.length ? summary.blockerList.map((b) => `- ${b}`) : ["- None"]),
  ].join("\n");
}
