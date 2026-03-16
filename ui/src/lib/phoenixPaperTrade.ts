export type PaperSide = "LONG" | "SHORT";

export type PhoenixPaperTrade = {
  id: string;
  createdAt: string;
  status: "open" | "closed";
  side: PaperSide;
  setupName: string;
  timeframeFocus: string;
  entry: number;
  stop: number;
  targets: number[];
  sizeUsd: number;
  leverage: number;
  pnlUsd: number;
  pnlPct: number;
  closePrice?: number;
  closeReason?: string;
  notes?: string;
};

export type PhoenixPaperBook = {
  trades: PhoenixPaperTrade[];
};

export const PHOENIX_PAPER_STORAGE_KEY = "oddengine:phoenix:paper:v1";

export function safeLoadPaperBook(): PhoenixPaperBook {
  if (typeof window === "undefined") return { trades: [] };
  try {
    const raw = window.localStorage.getItem(PHOENIX_PAPER_STORAGE_KEY);
    if (!raw) return { trades: [] };
    const parsed = JSON.parse(raw);
    return { trades: Array.isArray(parsed?.trades) ? parsed.trades : [] };
  } catch {
    return { trades: [] };
  }
}

export function safeSavePaperBook(book: PhoenixPaperBook) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PHOENIX_PAPER_STORAGE_KEY, JSON.stringify(book));
  } catch {}
}

export function computePaperPnl(side: PaperSide, entry: number, exit: number, sizeUsd: number, leverage: number) {
  const direction = side === "LONG" ? 1 : -1;
  const movePct = ((exit - entry) / Math.max(entry, 0.000001)) * direction;
  const leveragedPct = movePct * leverage * 100;
  const pnlUsd = sizeUsd * movePct * leverage;
  return { pnlUsd: round(pnlUsd, 2), pnlPct: round(leveragedPct, 2) };
}

export function createPaperTrade(input: {
  side: PaperSide;
  setupName: string;
  timeframeFocus: string;
  entry: number;
  stop: number;
  targets: number[];
  sizeUsd: number;
  leverage: number;
  notes?: string;
}): PhoenixPaperTrade {
  return {
    id: `phoenix-paper-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    createdAt: new Date().toLocaleString(),
    status: "open",
    side: input.side,
    setupName: input.setupName,
    timeframeFocus: input.timeframeFocus,
    entry: round(input.entry, 1),
    stop: round(input.stop, 1),
    targets: input.targets.map((value) => round(value, 1)),
    sizeUsd: input.sizeUsd,
    leverage: input.leverage,
    pnlUsd: 0,
    pnlPct: 0,
    notes: input.notes || "",
  };
}

export function closePaperTrade(trade: PhoenixPaperTrade, closePrice: number, reason: string): PhoenixPaperTrade {
  const pnl = computePaperPnl(trade.side, trade.entry, closePrice, trade.sizeUsd, trade.leverage);
  return {
    ...trade,
    status: "closed",
    closePrice: round(closePrice, 1),
    closeReason: reason,
    pnlUsd: pnl.pnlUsd,
    pnlPct: pnl.pnlPct,
  };
}

export function updateOpenTradeMark(trade: PhoenixPaperTrade, markPrice: number): PhoenixPaperTrade {
  if (trade.status !== "open") return trade;
  const pnl = computePaperPnl(trade.side, trade.entry, markPrice, trade.sizeUsd, trade.leverage);
  return { ...trade, pnlUsd: pnl.pnlUsd, pnlPct: pnl.pnlPct };
}

export function summarizePaperBook(book: PhoenixPaperBook) {
  const closed = book.trades.filter((trade) => trade.status === "closed");
  const open = book.trades.filter((trade) => trade.status === "open");
  const wins = closed.filter((trade) => trade.pnlUsd > 0).length;
  const losses = closed.filter((trade) => trade.pnlUsd <= 0).length;
  const netUsd = round(closed.reduce((sum, trade) => sum + trade.pnlUsd, 0), 2);
  const avgPct = closed.length ? round(closed.reduce((sum, trade) => sum + trade.pnlPct, 0) / closed.length, 2) : 0;
  return { openCount: open.length, closedCount: closed.length, wins, losses, netUsd, avgPct };
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
