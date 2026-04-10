export type OptionSide = "call" | "put";

export type PublicGreeks = {
  delta?: number | null;
  gamma?: number | null;
  theta?: number | null;
  vega?: number | null;
  rho?: number | null;
  impliedVolatility?: number | null;
};

export type PublicContract = {
  key: string;
  symbol: string;
  side: OptionSide;
  strike: number;
  ask: number | null;
  bid?: number | null;
  last?: number | null;
  volume?: number | null;
  expiration?: string | null;
  osiSymbol?: string | null;
  breakeven: number | null;
  toBreakevenPct: number | null;
  dayChangePct: number | null;
  openInterest: number | null;
  score: number;
  sourceUrl: string;
  greeks?: PublicGreeks | null;
};

export type PublicExpiryLink = {
  label: string;
  href: string;
};

export type PublicChainData = {
  symbol: string;
  sourceUrl: string;
  sourceMode: "public_website_delayed" | "public_api";
  companyName: string | null;
  title: string;
  spot: number | null;
  feedUpdated: string | null;
  expirationLabel: string | null;
  expirations: PublicExpiryLink[];
  calls: PublicContract[];
  puts: PublicContract[];
};

function cleanText(v: string | null | undefined): string {
  return String(v || "").replace(/\s+/g, " ").trim();
}

function parseDollar(v: string | null | undefined): number | null {
  const s = cleanText(v).replace(/,/g, "");
  const m = s.match(/-?\$?([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function parsePercent(v: string | null | undefined): number | null {
  const s = cleanText(v)
    .replace(/[−–—]/g, "-")
    .replace(/,/g, "")
    .replace(/%/g, "");
  const m = s.match(/-?[0-9]+(?:\.[0-9]+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function parseIntegerLoose(v: string | null | undefined): number | null {
  const s = cleanText(v).replace(/,/g, "");
  const m = s.match(/-?[0-9]+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function inferSideFromRow(row: Element): OptionSide | null {
  let el: Element | null = row;
  while (el) {
    let prev: Element | null = el.previousElementSibling;
    while (prev) {
      const t = cleanText(prev.textContent).toLowerCase();
      if (t.includes("put options")) return "put";
      if (t.includes("call options")) return "call";
      prev = prev.previousElementSibling;
    }
    el = el.parentElement;
  }
  return null;
}

function scoreContractBase(contract: Omit<PublicContract, "score">): number {
  let score = 0;
  if (contract.openInterest !== null) score += Math.min(contract.openInterest, 2500) / 80;
  if (contract.toBreakevenPct !== null) score += Math.max(0, 14 - Math.min(Math.abs(contract.toBreakevenPct), 28) / 2);
  if (contract.dayChangePct !== null) score += Math.max(-4, Math.min(contract.dayChangePct, 20) / 4);
  if (contract.ask !== null) score += Math.max(0, 8 - Math.min(contract.ask, 8));
  if (contract.volume !== null && contract.volume !== undefined) score += Math.min(contract.volume, 1500) / 300;
  return Math.round(score * 10) / 10;
}

function dedupeContracts(contracts: PublicContract[]): PublicContract[] {
  const seen = new Set<string>();
  const out: PublicContract[] = [];
  for (const c of contracts) {
    const key = c.osiSymbol || `${c.side}:${c.strike}:${c.breakeven ?? "na"}:${c.ask ?? "na"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.sort((a, b) => a.strike - b.strike);
}

function findCompanyName(doc: Document, symbol: string): string | null {
  const title = cleanText(doc.title);
  const fromTitle = title.match(/^Buy\s+(.+?)\s+\([A-Z.\-]+\)\s+Call and Put Options/i);
  if (fromTitle) return cleanText(fromTitle[1]);

  const headings = Array.from(doc.querySelectorAll("h1,h2,h3")).map((n) => cleanText(n.textContent));
  for (const h of headings) {
    if (new RegExp(`\\(${symbol}\\)`, "i").test(h)) {
      const stripped = h.replace(/^Buy\s+/i, "").replace(/\s+Call and Put Options.*$/i, "").trim();
      return stripped || null;
    }
  }
  return null;
}

function findSpot(doc: Document): number | null {
  const candidates: string[] = [];
  const headingText = Array.from(doc.querySelectorAll("h1,h2,h3,p,span"))
    .slice(0, 80)
    .map((n) => cleanText(n.textContent))
    .join(" ");
  candidates.push(headingText);
  candidates.push(cleanText(doc.body.textContent).slice(0, 2200));

  for (const block of candidates) {
    const matches = [...block.matchAll(/\$([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/g)];
    for (const m of matches) {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n >= 0.5 && n <= 10000) return n;
    }
  }
  return null;
}

function findFeedUpdated(text: string): string | null {
  const m = text.match(/Feed last updated:\s*([\s\S]{0,120}?)(?:Performance data shown|This page displays|Bid, ask, and last trade|Options can be risky|$)/i);
  return m ? cleanText(m[1]) : null;
}

function findExpirationLinks(doc: Document, sourceUrl: string): PublicExpiryLink[] {
  const out: PublicExpiryLink[] = [];
  const seen = new Set<string>();
  const anchors = Array.from(doc.querySelectorAll("a[href*='options-chain']"));
  for (const a of anchors) {
    const hrefRaw = a.getAttribute("href");
    if (!hrefRaw) continue;
    let href = hrefRaw;
    try {
      href = new URL(hrefRaw, sourceUrl).toString();
    } catch {
      // ignore URL failures
    }
    const label = cleanText(a.textContent);
    if (!label) continue;
    if (!/[A-Za-z]{3}|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}/.test(label)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ label, href });
  }
  return out.slice(0, 18);
}

function parseTableContracts(doc: Document, symbol: string, sourceUrl: string): PublicContract[] {
  const rows = Array.from(doc.querySelectorAll("tr"));
  const contracts: PublicContract[] = [];

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll("th,td")).map((c) => cleanText(c.textContent));
    if (cells.length < 5) continue;
    const strike = parseDollar(cells[0]);
    const ask = parseDollar(cells[1]);
    const breakeven = parseDollar(cells[2]);
    if (strike === null || ask === null || breakeven === null) continue;

    const side = inferSideFromRow(row);
    if (!side) continue;

    const toBreakevenPct = parsePercent(cells[3]);
    const dayChangePct = parsePercent(cells[4]);
    const openInterest = parseIntegerLoose(cells[5]);

    const base = {
      key: `${symbol}:${side}:${strike}:${breakeven}:${ask}`,
      symbol,
      side,
      strike,
      ask,
      bid: null,
      last: null,
      volume: null,
      expiration: null,
      osiSymbol: null,
      breakeven,
      toBreakevenPct,
      dayChangePct,
      openInterest,
      sourceUrl,
      greeks: null,
    } satisfies Omit<PublicContract, "score">;
    contracts.push({ ...base, score: scoreContractBase(base) });
  }

  return dedupeContracts(contracts);
}

export function slugForSymbol(symbol: string): string {
  return cleanText(symbol).toLowerCase();
}

export function buildPublicChainUrl(symbol: string): string {
  return `https://public.com/stocks/${slugForSymbol(symbol)}/options-chain`;
}

export function parsePublicOptionsHtml(html: string, symbol: string, sourceUrl: string): PublicChainData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const bodyText = cleanText(doc.body.textContent);
  const contracts = parseTableContracts(doc, symbol.toUpperCase(), sourceUrl);
  const calls = contracts.filter((c) => c.side === "call");
  const puts = contracts.filter((c) => c.side === "put");
  const expirations = findExpirationLinks(doc, sourceUrl);
  const expirationLabel = expirations[0]?.label ?? null;

  return {
    symbol: symbol.toUpperCase(),
    sourceUrl,
    sourceMode: "public_website_delayed",
    companyName: findCompanyName(doc, symbol.toUpperCase()),
    title: cleanText(doc.title) || `${symbol.toUpperCase()} Options Chain`,
    spot: findSpot(doc),
    feedUpdated: findFeedUpdated(bodyText),
    expirationLabel,
    expirations,
    calls,
    puts,
  };
}

export function formatMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `$${v.toFixed(v >= 100 ? 0 : 2)}`;
}

export function formatPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function scanContractScore(contract: PublicContract, cfg: { maxAsk: number; minOi: number; targetSide: "call" | "put" | "all"; }): number {
  let score = contract.score;
  if (cfg.targetSide !== "all" && contract.side === cfg.targetSide) score += 5;
  if (contract.openInterest !== null) {
    if (contract.openInterest >= cfg.minOi) score += 5;
    else score -= 6;
  }
  if (contract.ask !== null) {
    if (contract.ask <= cfg.maxAsk) score += 4;
    else score -= Math.min(10, contract.ask - cfg.maxAsk);
  }
  if (contract.greeks?.delta !== null && contract.greeks?.delta !== undefined) {
    const delta = Math.abs(contract.greeks.delta);
    if (delta >= 0.2 && delta <= 0.65) score += 3;
  }
  if (contract.greeks?.impliedVolatility !== null && contract.greeks?.impliedVolatility !== undefined) {
    const iv = contract.greeks.impliedVolatility;
    if (iv <= 1.25) score += 2;
  }
  return Math.round(score * 10) / 10;
}
