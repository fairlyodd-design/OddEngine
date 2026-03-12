export type PackageTier = "Starter" | "Core" | "Premium" | "Custom";
export type SignoffState = "Pending" | "Ready to invoice" | "Signed off";

export type DeliveryChecklist = {
  briefApproved: boolean;
  scopeLocked: boolean;
  assetsPrepared: boolean;
  renderComplete: boolean;
  packetPrepared: boolean;
  deliveredToClient: boolean;
  invoicePrepared: boolean;
};

export type QuoteState = {
  tier: PackageTier;
  estimateLow: number;
  estimateHigh: number;
  currency: string;
  depositPercent: number;
  turnaroundDays: number;
  deliverables: string[];
  notes: string;
  deliveryChecklist: DeliveryChecklist;
  signoffState: SignoffState;
};

const BASE_CHECKLIST: DeliveryChecklist = {
  briefApproved: false,
  scopeLocked: false,
  assetsPrepared: false,
  renderComplete: false,
  packetPrepared: false,
  deliveredToClient: false,
  invoicePrepared: false,
};

function preset(projectType: string, tier: PackageTier) {
  const type = String(projectType || "other").toLowerCase();
  const base = {
    currency: "USD",
    depositPercent: 50,
    turnaroundDays: 7,
    deliverables: ["Creative brief", "Working copy", "Final packet"],
    notes: "Scope and revisions may adjust final delivery timing.",
  };

  if (tier === "Custom") {
    return {
      ...base,
      estimateLow: 0,
      estimateHigh: 0,
      turnaroundDays: 14,
      deliverables: [...base.deliverables, "Custom scope estimate"],
    };
  }

  if (type === "song") {
    if (tier === "Starter") return { ...base, estimateLow: 250, estimateHigh: 500, turnaroundDays: 5, deliverables: ["Lyrics draft", "Song direction", "Release packet"] };
    if (tier === "Core") return { ...base, estimateLow: 600, estimateHigh: 1200, turnaroundDays: 10, deliverables: ["Lyrics + structure", "Music direction", "Render handoff", "Release packet"] };
    return { ...base, estimateLow: 1500, estimateHigh: 3000, turnaroundDays: 21, deliverables: ["Full song packet", "Music video direction", "Render handoff", "Delivery packet"] };
  }

  if (type === "book") {
    if (tier === "Starter") return { ...base, estimateLow: 400, estimateHigh: 900, turnaroundDays: 10, deliverables: ["Concept brief", "Chapter outline", "Pitch packet"] };
    if (tier === "Core") return { ...base, estimateLow: 1200, estimateHigh: 2500, turnaroundDays: 21, deliverables: ["Creative brief", "Outline", "Draft packet", "Pitch-ready packet"] };
    return { ...base, estimateLow: 3000, estimateHigh: 6500, turnaroundDays: 35, deliverables: ["Full manuscript workflow", "Director notes", "Packaging packet", "Delivery packet"] };
  }

  if (type === "cartoon" || type === "music video" || type === "video") {
    if (tier === "Starter") return { ...base, estimateLow: 500, estimateHigh: 1200, turnaroundDays: 7, deliverables: ["Creative brief", "Shot ideas", "Render handoff"] };
    if (tier === "Core") return { ...base, estimateLow: 1500, estimateHigh: 3500, turnaroundDays: 14, deliverables: ["Storyboard", "Shot list", "Render handoff", "Review packet"] };
    return { ...base, estimateLow: 4000, estimateHigh: 9000, turnaroundDays: 30, deliverables: ["Full production packet", "Render lane", "Publish prep", "Delivery packet"] };
  }

  if (tier === "Starter") return { ...base, estimateLow: 300, estimateHigh: 700 };
  if (tier === "Core") return { ...base, estimateLow: 900, estimateHigh: 2000, turnaroundDays: 12, deliverables: [...base.deliverables, "Render handoff"] };
  return { ...base, estimateLow: 2200, estimateHigh: 5000, turnaroundDays: 24, deliverables: [...base.deliverables, "Render handoff", "Release packet"] };
}

export function tierOptions(projectType: string): PackageTier[] {
  void projectType;
  return ["Starter", "Core", "Premium", "Custom"];
}

export function createDefaultQuoteState(projectType: string) {
  const p = preset(projectType, "Core");
  return {
    tier: "Core" as PackageTier,
    estimateLow: p.estimateLow,
    estimateHigh: p.estimateHigh,
    currency: p.currency,
    depositPercent: p.depositPercent,
    turnaroundDays: p.turnaroundDays,
    deliverables: p.deliverables,
    notes: p.notes,
    deliveryChecklist: { ...BASE_CHECKLIST },
    signoffState: "Pending" as SignoffState,
  };
}

export function hydrateQuoteState(raw: any, projectType: string): QuoteState {
  const base = createDefaultQuoteState(projectType);
  return {
    ...base,
    ...(raw || {}),
    deliveryChecklist: {
      ...base.deliveryChecklist,
      ...(raw?.deliveryChecklist || {}),
    },
  };
}

export function applyTierPreset(current: QuoteState, projectType: string, tier: PackageTier): QuoteState {
  const p = preset(projectType, tier);
  return {
    ...current,
    tier,
    estimateLow: p.estimateLow,
    estimateHigh: p.estimateHigh,
    currency: p.currency,
    depositPercent: p.depositPercent,
    turnaroundDays: p.turnaroundDays,
    deliverables: p.deliverables,
    notes: current.notes || p.notes,
  };
}

export function checklistProgress(state: QuoteState): { done: number; total: number; percent: number } {
  const values = Object.values(state.deliveryChecklist || {});
  const done = values.filter(Boolean).length;
  const total = values.length || 1;
  return { done, total, percent: Math.round((done / total) * 100) };
}

export function isInvoiceReady(state: QuoteState): boolean {
  const c = state.deliveryChecklist;
  return Boolean(c.briefApproved && c.scopeLocked && c.packetPrepared && c.deliveredToClient && c.invoicePrepared);
}

export function buildInvoiceReadySummary(projectTitle: string, state: QuoteState, publishTitle: string, releaseTarget: string) {
  const range = `${state.currency} ${state.estimateLow.toLocaleString()} - ${state.estimateHigh.toLocaleString()}`;
  const deposit = `${state.depositPercent}%`;
  const progress = checklistProgress(state);
  return {
    projectTitle,
    publishTitle,
    tier: state.tier,
    estimateRange: range,
    deposit,
    turnaroundDays: state.turnaroundDays,
    releaseTarget,
    deliverables: state.deliverables,
    signoffState: state.signoffState,
    checklist: state.deliveryChecklist,
    readinessPercent: progress.percent,
    invoiceReady: isInvoiceReady(state),
    notes: state.notes,
  };
}

export function invoiceReadySummaryToMarkdown(summary: ReturnType<typeof buildInvoiceReadySummary>) {
  return [
    `# Invoice-ready summary — ${summary.publishTitle || summary.projectTitle}`,
    ``,
    `- Package tier: ${summary.tier}`,
    `- Estimate range: ${summary.estimateRange}`,
    `- Deposit: ${summary.deposit}`,
    `- Turnaround: ${summary.turnaroundDays} day(s)`,
    `- Release target: ${summary.releaseTarget}`,
    `- Signoff: ${summary.signoffState}`,
    `- Invoice ready: ${summary.invoiceReady ? "Yes" : "No"}`,
    `- Readiness: ${summary.readinessPercent}%`,
    ``,
    `## Deliverables`,
    ...summary.deliverables.map((item) => `- ${item}`),
    ``,
    `## Checklist`,
    ...Object.entries(summary.checklist).map(([key, value]) => `- ${key}: ${value ? "done" : "pending"}`),
    ``,
    `## Notes`,
    summary.notes || "None yet.",
  ].join("\n");
}
