import { evaluateExit } from "../exit/smartExitEngine";

export function monitorPosition(position: any) {
  const decision = evaluateExit(position) as { action: string; reason?: string };

  return {
    ticker: position.ticker,
    action: decision.action,
    reason: decision.reason ?? "Monitoring",
  };
}
