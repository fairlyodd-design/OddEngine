import { buildGodModeDecisionSnapshot, type DecisionCandidate } from "./godModeDecisionEngine";
import { buildUnifiedOperatorSnapshot } from "./unifiedOperatorDashboard";

export type OpportunityBucket = "doNow" | "watch" | "later" | "ignore";

export type OpportunityRadarItem = {
  id: string;
  title: string;
  body: string;
  panelId: string;
  domain: string;
  source: "decision" | "operator";
  bucket: OpportunityBucket;
  predictiveScore: number;
  urgency: number;
  momentum: number;
  energyCost: number;
  successProbability: number;
  profitPotential: number;
  timeToCashMinutes: number;
  timeToCashLabel: string;
  note: string;
  actionLabel: string;
};

export type OpportunityRadarSnapshot = {
  generatedAt: number;
  headline: string;
  operatorLine: string;
  fastestCashLane: OpportunityRadarItem | null;
  heatingUp: OpportunityRadarItem | null;
  emerging: OpportunityRadarItem[];
  buckets: Record<OpportunityBucket, OpportunityRadarItem[]>;
  stats: {
    doNow: number;
    watch: number;
    later: number;
    ignore: number;
    avgTimeToCashMinutes: number;
  };
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
}

function dedupeById(items: OpportunityRadarItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function sortByPredictiveScore(a: OpportunityRadarItem, b: OpportunityRadarItem) {
  if (b.predictiveScore !== a.predictiveScore) return b.predictiveScore - a.predictiveScore;
  return a.timeToCashMinutes - b.timeToCashMinutes;
}

function labelMinutes(totalMinutes: number) {
  const mins = Math.max(1, Math.round(totalMinutes));
  if (mins < 60) return `${mins}m`;
  const hours = mins / 60;
  if (hours < 24) return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
  const days = hours / 24;
  return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
}

function domainMomentum(domain: string) {
  switch (domain) {
    case "trading": return 82;
    case "money": return 78;
    case "studio": return 70;
    case "homie": return 58;
    default: return 54;
  }
}

function timeToCashMinutesFor(candidate: DecisionCandidate) {
  const base = Math.max(5, Number(candidate.etaMin || 15));
  if (candidate.state === "done") return 10;
  switch (candidate.domain) {
    case "money": return base * 2.5;
    case "trading": return base * 1.8;
    case "studio": return base * 8;
    case "homie": return base * 4;
    default: return base * 5;
  }
}

function bucketFor(score: number, blocked: boolean, done: boolean) {
  if (blocked) return "ignore" as OpportunityBucket;
  if (done) return "watch" as OpportunityBucket;
  if (score >= 76) return "doNow" as OpportunityBucket;
  if (score >= 58) return "watch" as OpportunityBucket;
  if (score >= 38) return "later" as OpportunityBucket;
  return "ignore" as OpportunityBucket;
}

function decisionToRadar(candidate: DecisionCandidate): OpportunityRadarItem {
  const timeToCashMinutes = timeToCashMinutesFor(candidate);
  const urgency = clamp(
    candidate.view === "quickCash"
      ? 92
      : candidate.view === "now"
      ? 84
      : candidate.view === "today"
      ? 66
      : candidate.view === "queued"
      ? 52
      : candidate.view === "blocked"
      ? 20
      : 44,
  );
  const momentum = clamp(
    domainMomentum(candidate.domain) +
      (candidate.state === "active" ? 10 : 0) +
      (candidate.state === "done" ? 6 : 0) +
      (candidate.view === "quickCash" ? 6 : 0) -
      (candidate.state === "blocked" ? 26 : 0),
  );
  const predictiveScore = Math.round(
    clamp(candidate.profitPotential) * 0.24 +
    clamp(candidate.successProbability) * 0.18 +
    clamp(momentum) * 0.18 +
    clamp(urgency) * 0.16 +
    clamp(100 - candidate.effortRequired) * 0.12 +
    clamp(100 - Math.min(100, timeToCashMinutes / 6)) * 0.12,
  );
  const bucket = bucketFor(predictiveScore, candidate.state === "blocked", candidate.state === "done");
  const note = candidate.state === "blocked"
    ? candidate.blockedReason || "Needs input before it becomes real."
    : bucket === "doNow"
    ? `Fastest realistic lane: about ${labelMinutes(timeToCashMinutes)} to first result.`
    : bucket === "watch"
    ? `Signal is warming up. Keep this on deck for the next ${labelMinutes(timeToCashMinutes)}.`
    : bucket === "later"
    ? `Worth parking for later once the faster lanes are handled.`
    : `Low-quality lane right now. Ignore unless context changes.`;
  return {
    id: `radar-${candidate.id}`,
    title: candidate.title,
    body: candidate.body,
    panelId: candidate.panelId,
    domain: candidate.domain,
    source: "decision",
    bucket,
    predictiveScore,
    urgency,
    momentum,
    energyCost: clamp(candidate.effortRequired),
    successProbability: clamp(candidate.successProbability),
    profitPotential: clamp(candidate.profitPotential),
    timeToCashMinutes,
    timeToCashLabel: labelMinutes(timeToCashMinutes),
    note,
    actionLabel: bucket === "doNow" ? "Run now" : bucket === "watch" ? "Watch lane" : "Open lane",
  };
}

export async function buildOpportunityRadarSnapshot(activePanelId: string): Promise<OpportunityRadarSnapshot> {
  const [decision, operator] = await Promise.all([
    buildGodModeDecisionSnapshot(activePanelId || "Brain"),
    buildUnifiedOperatorSnapshot(activePanelId || "Brain"),
  ]);

  const candidates = dedupeById([
    ...decision.views.quickCash,
    ...decision.views.now,
    ...decision.views.today,
    ...decision.views.queued,
    ...decision.views.blocked,
    ...(decision.bestNow ? [decision.bestNow] : []),
    ...(decision.bestToday ? [decision.bestToday] : []),
    ...(decision.passive ? [decision.passive] : []),
  ].map(decisionToRadar)).sort(sortByPredictiveScore);

  const buckets: Record<OpportunityBucket, OpportunityRadarItem[]> = {
    doNow: [],
    watch: [],
    later: [],
    ignore: [],
  };
  candidates.forEach((item) => buckets[item.bucket].push(item));
  (Object.keys(buckets) as OpportunityBucket[]).forEach((key) => {
    buckets[key] = buckets[key].sort(sortByPredictiveScore).slice(0, key === "ignore" ? 8 : 10);
  });

  const nonIgnore = [...buckets.doNow, ...buckets.watch, ...buckets.later].sort(sortByPredictiveScore);
  const fastestCashLane = [...nonIgnore].sort((a, b) => a.timeToCashMinutes - b.timeToCashMinutes || b.predictiveScore - a.predictiveScore)[0] || null;
  const heatingUp = [...buckets.watch, ...buckets.doNow].sort((a, b) => b.momentum - a.momentum || b.predictiveScore - a.predictiveScore)[0] || null;
  const emerging = nonIgnore.slice(0, 5);
  const avgTime = nonIgnore.length ? Math.round(nonIgnore.reduce((sum, item) => sum + item.timeToCashMinutes, 0) / nonIgnore.length) : 0;

  return {
    generatedAt: Date.now(),
    headline: fastestCashLane
      ? `Opportunity Radar says ${fastestCashLane.title} is your fastest cash lane.`
      : operator.headline,
    operatorLine: heatingUp
      ? `${heatingUp.title} is heating up. ${heatingUp.note}`
      : decision.operatorLine,
    fastestCashLane,
    heatingUp,
    emerging,
    buckets,
    stats: {
      doNow: buckets.doNow.length,
      watch: buckets.watch.length,
      later: buckets.later.length,
      ignore: buckets.ignore.length,
      avgTimeToCashMinutes: avgTime,
    },
  };
}
