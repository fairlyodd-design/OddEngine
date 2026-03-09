export type WorkflowStep = {
  id: string;
  label: string;
  status: "done" | "active" | "queued";
  detail: string;
  since: string;
};

export function buildSniperWorkflow(args: {
  symbol: string;
  expiration: string;
  contractLabel: string;
  score: number;
  templateName?: string;
}) {
  const { symbol, expiration, contractLabel, score, templateName } = args;

  const sizeTier = score >= 72 ? "A-grade" : score >= 62 ? "B-grade" : "watch-only";

  return [
    {
      id: "watch",
      label: "Load watchlist",
      status: "done",
      detail: `${symbol} is live in the Phoenix lane`,
      since: "2m ago",
    },
    {
      id: "chain",
      label: "Pick expiration + chain",
      status: "done",
      detail: `${expiration} selected with ranked greeks + liquidity`,
      since: "90s ago",
    },
    {
      id: "contract",
      label: "Select contract",
      status: "active",
      detail: `${contractLabel} · score ${score} · ${sizeTier}`,
      since: "just now",
    },
    {
      id: "ticket",
      label: "Build ticket",
      status: "queued",
      detail: templateName ? `Apply ${templateName} template and stage exits` : "Set entry, stop, ladder, OCO block",
      since: "waiting",
    },
  ] as WorkflowStep[];
}
