import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { oddApi } from "../lib/odd";
import { acknowledgePanelAction, getPanelActions, PANEL_ACTION_EVENT, rememberActionOutcome, type PanelActionEnvelope } from "../lib/brain";
import { PanelHeader } from "../components/PanelHeader";

const STORAGE_KEY = "oddengine:familyBudget:v2";
const LEGACY_STORAGE_KEY = "oddengine:familyBudget:v1";
const TAB_KEY = "oddengine:familyBudget:tab";
const PAYOFF_KEY = "oddengine:familyBudget:payoffStrategy:v1";

const BUDGET_TABS = [
  "Overview",
  "Accounts",
  "Transactions",
  "Budget",
  "Goals",
  "Recurring",
  "Reports",
  "Plan",
  "Payoff",
  "Settings"
] as const;

type BudgetTab = (typeof BUDGET_TABS)[number];
type AccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "INVESTMENT"
  | "CRYPTO"
  | "PROPERTY"
  | "VEHICLE"
  | "LOAN";
type ConnectionStatus = "ACTIVE" | "PENDING" | "OFFLINE";
type PayoffStrategy = "AVALANCHE" | "SNOWBALL";
type CsvPresetName = "Plaid_Generic" | "Chase" | "BankOfAmerica" | "WellsFargo" | "AppleCard";
type CsvField = "date" | "merchant" | "amount" | "category";

type Account = {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  provider?: string;
  note?: string;
  apr?: number;
  minPayment?: number;
};

type Transaction = {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  accountId: string;
  note?: string;
};

type Goal = {
  id: string;
  name: string;
  target: number;
  current: number;
  monthly: number;
  note?: string;
};

type RecurringItem = {
  id: string;
  name: string;
  amount: number;
  nextDue: string;
  type: "bill" | "subscription";
  category: string;
};

type BudgetLine = {
  id: string;
  label: string;
  planned: number;
  category: string;
  bucket: "FIXED" | "FLEXIBLE" | "SAVINGS" | "NON_MONTHLY";
};

type Connection = {
  id: string;
  provider: string;
  displayName: string;
  status: ConnectionStatus;
  lastSync: string;
};

type PlanMonth = {
  month: string;
  expectedIncome: number;
  fixedExpenses: number;
  flexibleExpenses: number;
  nonMonthlyExpenses: number;
  savingsGoal: number;
};

type SyncBridgeState = {
  enabled: boolean;
  baseUrl: string;
  routePrefix: string;
  householdId: string;
  bearerToken: string;
  lastHealthISO?: string;
  lastPullISO?: string;
  lastPushISO?: string;
  lastStatus?: string;
  lastError?: string;
};

type FamilyBudgetState = {
  household: { name: string; currency: string; members: string[] };
  accounts: Account[];
  transactions: Transaction[];
  goals: Goal[];
  recurring: RecurringItem[];
  budgetLines: BudgetLine[];
  connections: Connection[];
  netWorthHistory: { date: string; value: number }[];
  annualPlan: PlanMonth[];
  syncBridge: SyncBridgeState;
};

type QuickTxDraft = {
  date: string;
  merchant: string;
  amount: string;
  category: string;
  accountId: string;
  note: string;
};

type AccountDraft = {
  id?: string;
  name: string;
  type: AccountType;
  provider: string;
  amount: string;
  liability: boolean;
  apr: string;
  minPayment: string;
  note: string;
};

type CsvMapper = Record<CsvField, string>;
type CsvPreviewRow = Record<string, string>;

type ParsedCsv = {
  headers: string[];
  rows: CsvPreviewRow[];
};

type PayoffMonth = {
  month: number;
  totalBalance: number;
  totalInterest: number;
  totalPayment: number;
  targetName: string;
};

type PayoffResult = {
  monthsToPayoff: number | null;
  totalInterest: number;
  isPaidOff: boolean;
  schedule: PayoffMonth[];
};

const CSV_PRESETS: Record<CsvPresetName, Record<CsvField, string[]>> = {
  Plaid_Generic: {
    date: ["date", "transaction date", "posted date", "posting date"],
    merchant: ["name", "merchant", "description", "original description"],
    amount: ["amount", "amount (usd)", "value"],
    category: ["category", "personal finance category", "detailed category"]
  },
  Chase: {
    date: ["transaction date", "post date", "posting date", "date"],
    merchant: ["description", "details", "merchant"],
    amount: ["amount", "transaction amount"],
    category: ["type", "category"]
  },
  BankOfAmerica: {
    date: ["date", "posted date"],
    merchant: ["description", "merchant", "original description"],
    amount: ["amount", "value"],
    category: ["category", "simple description"]
  },
  WellsFargo: {
    date: ["date", "posted date", "transaction date"],
    merchant: ["description", "merchant"],
    amount: ["amount", "transaction amount"],
    category: ["category", "type"]
  },
  AppleCard: {
    date: ["transaction date", "date"],
    merchant: ["merchant", "description", "name"],
    amount: ["amount (usd)", "amount", "debit", "credit"],
    category: ["category", "transaction type"]
  }
};

const DEFAULT_SYNC_BRIDGE: SyncBridgeState = {
  enabled: false,
  baseUrl: "http://localhost:8787",
  routePrefix: "/api",
  householdId: "fairly-odd-household",
  bearerToken: "",
  lastStatus: "Not configured"
};

function money(n: number, currency = "USD") {
  return Number(n || 0).toLocaleString(undefined, { style: "currency", currency, maximumFractionDigits: 2 });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoMonth(date: string) {
  return date.slice(0, 7);
}

function normalizeHeader(text: string) {
  return text.trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");
}

function normalizeDateValue(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const slash = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slash) {
    const mm = Number(slash[1]);
    const dd = Number(slash[2]);
    let yyyy = Number(slash[3]);
    if (yyyy < 100) yyyy += yyyy >= 70 ? 1900 : 2000;
    return `${yyyy.toString().padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

function parseAmountValue(raw: string) {
  const source = raw.trim();
  if (!source) return null;
  let negative = false;
  if (source.startsWith("(") && source.endsWith(")")) negative = true;
  if (source.includes("-")) negative = true;
  const cleaned = source.replace(/[(),$\s]/g, "").replace(/^[+-]/, "").replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function parseCsvLine(line: string) {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((cell) => cell.trim());
}

function parseCsv(text: string): ParsedCsv {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: CsvPreviewRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    return row;
  });
  return { headers, rows };
}

function findMappedHeader(headers: string[], aliases: string[]) {
  const wanted = aliases.map((a) => normalizeHeader(a));
  return headers.find((header) => wanted.includes(normalizeHeader(header))) || "";
}

function buildPresetMapper(headers: string[], preset: CsvPresetName): CsvMapper {
  const config = CSV_PRESETS[preset];
  return {
    date: findMappedHeader(headers, config.date),
    merchant: findMappedHeader(headers, config.merchant),
    amount: findMappedHeader(headers, config.amount),
    category: findMappedHeader(headers, config.category)
  };
}

function detectCsvPreset(headers: string[]): CsvPresetName | "" {
  const presets = Object.keys(CSV_PRESETS) as CsvPresetName[];
  for (const preset of presets) {
    const mapper = buildPresetMapper(headers, preset);
    if (mapper.date && mapper.merchant && mapper.amount) return preset;
  }
  return "";
}

function trimSlashes(text: string) {
  return text.trim().replace(/\/+$/, "");
}

function ensureLeadingSlash(text: string) {
  const value = text.trim();
  if (!value) return "";
  return value.startsWith("/") ? value : `/${value}`;
}

function buildSyncUrl(sync: SyncBridgeState, path: string) {
  const base = trimSlashes(sync.baseUrl || DEFAULT_SYNC_BRIDGE.baseUrl);
  const prefix = ensureLeadingSlash(sync.routePrefix || DEFAULT_SYNC_BRIDGE.routePrefix);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${prefix}${cleanPath}`;
}

function summarizeHealthPayload(payload: unknown) {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    const maybe = payload as Record<string, unknown>;
    return String(maybe.status || maybe.message || "Health OK");
  }
  return "Health OK";
}

function dedupeTransactions(current: Transaction[], incoming: Transaction[]) {
  const seen = new Set(
    current.map((tx) => `${tx.date}|${tx.accountId}|${tx.merchant.trim().toLowerCase()}|${tx.amount.toFixed(2)}`)
  );
  const accepted: Transaction[] = [];
  let duplicates = 0;
  for (const tx of incoming) {
    const key = `${tx.date}|${tx.accountId}|${tx.merchant.trim().toLowerCase()}|${tx.amount.toFixed(2)}`;
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    accepted.push(tx);
  }
  return { accepted, duplicates };
}

function mergeRemoteSnapshot(localState: FamilyBudgetState, remoteState: FamilyBudgetState) {
  const mergedAccounts = new Map<string, Account>();
  [...localState.accounts, ...remoteState.accounts].forEach((account) => mergedAccounts.set(account.id, account));

  const mergedGoals = new Map<string, Goal>();
  [...localState.goals, ...remoteState.goals].forEach((goal) => mergedGoals.set(goal.id, goal));

  const mergedRecurring = new Map<string, RecurringItem>();
  [...localState.recurring, ...remoteState.recurring].forEach((item) => mergedRecurring.set(item.id, item));

  const mergedBudget = new Map<string, BudgetLine>();
  [...localState.budgetLines, ...remoteState.budgetLines].forEach((item) => mergedBudget.set(item.id, item));

  const mergedConnections = new Map<string, Connection>();
  [...localState.connections, ...remoteState.connections].forEach((item) => mergedConnections.set(item.id, item));

  const mergedNetWorth = new Map<string, { date: string; value: number }>();
  [...localState.netWorthHistory, ...remoteState.netWorthHistory].forEach((item) => mergedNetWorth.set(item.date, item));

  const mergedPlan = new Map<string, PlanMonth>();
  [...localState.annualPlan, ...remoteState.annualPlan].forEach((item) => mergedPlan.set(item.month, item));

  const txMap = new Map<string, Transaction>();
  [...localState.transactions, ...remoteState.transactions].forEach((tx) => {
    const key = tx.id || `${tx.date}|${tx.accountId}|${tx.merchant}|${tx.amount}`;
    txMap.set(key, tx);
  });

  return normalizeState({
    household: remoteState.household?.name ? remoteState.household : localState.household,
    accounts: Array.from(mergedAccounts.values()),
    transactions: Array.from(txMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
    goals: Array.from(mergedGoals.values()),
    recurring: Array.from(mergedRecurring.values()),
    budgetLines: Array.from(mergedBudget.values()),
    connections: Array.from(mergedConnections.values()),
    netWorthHistory: Array.from(mergedNetWorth.values()).sort((a, b) => a.date.localeCompare(b.date)),
    annualPlan: Array.from(mergedPlan.values()).sort((a, b) => a.month.localeCompare(b.month)),
    syncBridge: { ...localState.syncBridge, ...remoteState.syncBridge }
  });
}

function lineColorByAmount(amount: number) {
  return amount >= 0 ? "var(--good)" : "var(--fg)";
}

function makeDemoState(): FamilyBudgetState {
  const year = new Date().getFullYear();
  return normalizeState({
    household: {
      name: "Fairly Odd Household",
      currency: "USD",
      members: ["Homie", "Mama", "Family"]
    },
    accounts: [
      { id: "acc_checking", name: "Checking", type: "CHECKING", balance: 5342.3, provider: "Plaid" },
      { id: "acc_savings", name: "Savings", type: "SAVINGS", balance: 18250, provider: "Plaid" },
      { id: "acc_credit", name: "Credit Card", type: "CREDIT_CARD", balance: -2828.99, provider: "Plaid", apr: 24.99, minPayment: 95 },
      { id: "acc_broker", name: "Brokerage", type: "INVESTMENT", balance: 542301.55, provider: "Brokerage" },
      { id: "acc_crypto", name: "Coinbase", type: "CRYPTO", balance: 41250.15, provider: "Coinbase" },
      { id: "acc_property", name: "Primary Home", type: "PROPERTY", balance: 300625.05, provider: "Zillow" },
      { id: "acc_vehicle", name: "Vehicle", type: "VEHICLE", balance: 20739.77, provider: "KBB" },
      { id: "acc_loan", name: "Mortgage / Loan", type: "LOAN", balance: -239137.89, provider: "Plaid", apr: 6.5, minPayment: 1800 }
    ],
    transactions: [
      { id: "tx1", date: todayIso(), merchant: "Employer Payroll", amount: 2450, category: "Income", accountId: "acc_checking" },
      { id: "tx2", date: plusDays(-2), merchant: "Mortgage", amount: -1800, category: "Housing", accountId: "acc_checking" },
      { id: "tx3", date: plusDays(-3), merchant: "Whole Foods", amount: -92.41, category: "Groceries", accountId: "acc_credit" },
      { id: "tx4", date: plusDays(-4), merchant: "Chipotle", amount: -34.12, category: "Dining", accountId: "acc_credit" },
      { id: "tx5", date: plusDays(-5), merchant: "Electric Co", amount: -120.5, category: "Utilities", accountId: "acc_checking" },
      { id: "tx6", date: plusDays(-6), merchant: "Netflix", amount: -19.99, category: "Subscriptions", accountId: "acc_checking" },
      { id: "tx7", date: plusDays(-7), merchant: "Brokerage Transfer", amount: -300, category: "Investing", accountId: "acc_checking" },
      { id: "tx8", date: plusDays(-8), merchant: "Chevron", amount: -58.33, category: "Transport", accountId: "acc_checking" },
      { id: "tx9", date: plusDays(-12), merchant: "Employer Payroll", amount: 2450, category: "Income", accountId: "acc_checking" },
      { id: "tx10", date: plusDays(-15), merchant: "Target", amount: -63.77, category: "Groceries", accountId: "acc_credit", note: "Split candidate" }
    ],
    goals: [
      { id: "goal1", name: "Emergency Fund", target: 10000, current: 2500, monthly: 250, note: "3–6 months of expenses" },
      { id: "goal2", name: "Vegas Buffer", target: 5000, current: 1100, monthly: 125, note: "Unexpected household hits" },
      { id: "goal3", name: "Family Trip", target: 3000, current: 950, monthly: 150, note: "Fun bucket" }
    ],
    recurring: [
      { id: "rec1", name: "Mortgage", amount: 1800, nextDue: plusDays(5), type: "bill", category: "Housing" },
      { id: "rec2", name: "Electric Co", amount: 120.5, nextDue: plusDays(10), type: "bill", category: "Utilities" },
      { id: "rec3", name: "Netflix", amount: 19.99, nextDue: plusDays(2), type: "subscription", category: "Subscriptions" }
    ],
    budgetLines: [
      { id: "bl1", label: "Housing", planned: 1800, category: "Housing", bucket: "FIXED" },
      { id: "bl2", label: "Utilities", planned: 160, category: "Utilities", bucket: "FIXED" },
      { id: "bl3", label: "Subscriptions", planned: 45, category: "Subscriptions", bucket: "FIXED" },
      { id: "bl4", label: "Groceries", planned: 500, category: "Groceries", bucket: "FLEXIBLE" },
      { id: "bl5", label: "Dining", planned: 250, category: "Dining", bucket: "FLEXIBLE" },
      { id: "bl6", label: "Transport", planned: 180, category: "Transport", bucket: "FLEXIBLE" },
      { id: "bl7", label: "Investing", planned: 300, category: "Investing", bucket: "SAVINGS" },
      { id: "bl8", label: "Non-monthly buffer", planned: 250, category: "Non-monthly", bucket: "NON_MONTHLY" }
    ],
    connections: [
      { id: "conn1", provider: "PLAID", displayName: "Chase via Plaid", status: "ACTIVE", lastSync: plusDays(0) },
      { id: "conn2", provider: "COINBASE", displayName: "Coinbase", status: "ACTIVE", lastSync: plusDays(0) },
      { id: "conn3", provider: "ZILLOW", displayName: "Zillow Zestimate", status: "ACTIVE", lastSync: plusDays(-2) },
      { id: "conn4", provider: "APPLE_CARD", displayName: "Apple Card import", status: "PENDING", lastSync: plusDays(-5) }
    ],
    netWorthHistory: [
      { date: `${year - 1}-04-01`, value: 648000 },
      { date: `${year - 1}-05-01`, value: 650500 },
      { date: `${year - 1}-06-01`, value: 653900 },
      { date: `${year - 1}-07-01`, value: 656500 },
      { date: `${year - 1}-08-01`, value: 660200 },
      { date: `${year - 1}-09-01`, value: 663000 },
      { date: `${year - 1}-10-01`, value: 666700 },
      { date: `${year - 1}-11-01`, value: 670300 },
      { date: `${year - 1}-12-01`, value: 675100 },
      { date: `${year}-01-01`, value: 679900 },
      { date: `${year}-02-01`, value: 684400 },
      { date: `${year}-03-01`, value: 689300 }
    ],
    annualPlan: [
      { month: `${year}-01`, expectedIncome: 6000, fixedExpenses: 3200, flexibleExpenses: 1400, nonMonthlyExpenses: 250, savingsGoal: 800 },
      { month: `${year}-02`, expectedIncome: 6000, fixedExpenses: 3200, flexibleExpenses: 1380, nonMonthlyExpenses: 250, savingsGoal: 850 },
      { month: `${year}-03`, expectedIncome: 6200, fixedExpenses: 3200, flexibleExpenses: 1450, nonMonthlyExpenses: 275, savingsGoal: 900 },
      { month: `${year}-04`, expectedIncome: 6100, fixedExpenses: 3200, flexibleExpenses: 1375, nonMonthlyExpenses: 260, savingsGoal: 825 },
      { month: `${year}-05`, expectedIncome: 6050, fixedExpenses: 3200, flexibleExpenses: 1420, nonMonthlyExpenses: 290, savingsGoal: 800 },
      { month: `${year}-06`, expectedIncome: 6150, fixedExpenses: 3200, flexibleExpenses: 1460, nonMonthlyExpenses: 300, savingsGoal: 850 },
      { month: `${year}-07`, expectedIncome: 6250, fixedExpenses: 3200, flexibleExpenses: 1480, nonMonthlyExpenses: 260, savingsGoal: 900 },
      { month: `${year}-08`, expectedIncome: 6200, fixedExpenses: 3200, flexibleExpenses: 1430, nonMonthlyExpenses: 250, savingsGoal: 900 },
      { month: `${year}-09`, expectedIncome: 6100, fixedExpenses: 3200, flexibleExpenses: 1400, nonMonthlyExpenses: 250, savingsGoal: 850 },
      { month: `${year}-10`, expectedIncome: 6150, fixedExpenses: 3200, flexibleExpenses: 1410, nonMonthlyExpenses: 275, savingsGoal: 850 },
      { month: `${year}-11`, expectedIncome: 6000, fixedExpenses: 3200, flexibleExpenses: 1380, nonMonthlyExpenses: 320, savingsGoal: 750 },
      { month: `${year}-12`, expectedIncome: 6400, fixedExpenses: 3200, flexibleExpenses: 1550, nonMonthlyExpenses: 350, savingsGoal: 1000 }
    ],
    syncBridge: DEFAULT_SYNC_BRIDGE
  });
}

function normalizeState(raw: FamilyBudgetState | null | undefined): FamilyBudgetState {
  const input = raw || makeDemoState();
  const syncBridge = {
    ...DEFAULT_SYNC_BRIDGE,
    ...(input as { syncBridge?: Partial<SyncBridgeState> }).syncBridge
  };
  return {
    household: input.household || makeDemoState().household,
    accounts: (input.accounts || []).map((account) => ({
      ...account,
      provider: account.provider || "Manual",
      apr: account.balance < 0 ? Number(account.apr ?? (account.type === "CREDIT_CARD" ? 24.99 : account.type === "LOAN" ? 6.5 : 0)) : account.apr,
      minPayment: account.balance < 0 ? Number(account.minPayment ?? (account.type === "CREDIT_CARD" ? 75 : account.type === "LOAN" ? 250 : 0)) : account.minPayment
    })),
    transactions: [...(input.transactions || [])],
    goals: [...(input.goals || [])],
    recurring: [...(input.recurring || [])],
    budgetLines: [...(input.budgetLines || [])],
    connections: [...(input.connections || [])],
    netWorthHistory: [...(input.netWorthHistory || [])],
    annualPlan: [...(input.annualPlan || [])],
    syncBridge
  };
}

function LineSvg({ points, stroke = "#60a5fa", height = 220 }: { points: { label: string; value: number }[]; stroke?: string; height?: number }) {
  const width = 760;
  const pad = 28;
  if (!points.length) return <div className="small">No chart data.</div>;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const path = points
    .map((p, i) => {
      const x = pad + i * stepX;
      const y = height - pad - ((p.value - min) / span) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
      <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="rgba(255,255,255,.08)" />
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="rgba(255,255,255,.08)" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => {
        const x = pad + i * stepX;
        const y = height - pad - ((p.value - min) / span) * (height - pad * 2);
        return <circle key={p.label + i} cx={x} cy={y} r="3.5" fill={stroke} />;
      })}
      <text x={pad} y={18} fill="rgba(255,255,255,.55)" fontSize="12">{money(min)}</text>
      <text x={width - pad} y={18} fill="rgba(255,255,255,.55)" fontSize="12" textAnchor="end">{money(max)}</text>
      <text x={pad} y={height - 8} fill="rgba(255,255,255,.55)" fontSize="12">{points[0]?.label}</text>
      <text x={width - pad} y={height - 8} fill="rgba(255,255,255,.55)" fontSize="12" textAnchor="end">{points[points.length - 1]?.label}</text>
    </svg>
  );
}

function BarSvg({ items, color = "#34d399", height = 220 }: { items: { label: string; value: number }[]; color?: string; height?: number }) {
  const width = 760;
  const pad = 28;
  if (!items.length) return <div className="small">No bars yet.</div>;
  const max = Math.max(1, ...items.map((item) => item.value));
  const slot = (width - pad * 2) / items.length;
  const barW = Math.min(44, slot * 0.62);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }}>
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="rgba(255,255,255,.08)" />
      {items.map((item, idx) => {
        const h = ((height - pad * 2) * item.value) / max;
        const x = pad + idx * slot + (slot - barW) / 2;
        const y = height - pad - h;
        return (
          <g key={item.label}>
            <rect x={x} y={y} width={barW} height={h} rx={10} fill={color} opacity="0.9" />
            <text x={x + barW / 2} y={height - 8} fill="rgba(255,255,255,.55)" fontSize="12" textAnchor="middle">{item.label}</text>
          </g>
        );
      })}
      <text x={width - pad} y={18} fill="rgba(255,255,255,.55)" fontSize="12" textAnchor="end">max {money(max)}</text>
    </svg>
  );
}

function ProgressBar({ actual, planned, currency }: { actual: number; planned: number; currency: string }) {
  const pct = planned > 0 ? Math.min(1.25, actual / planned) : 0;
  const tone = pct > 1 ? "#fb7185" : pct > 0.85 ? "#fbbf24" : "#34d399";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <div className="small">{money(actual, currency)} / {money(planned, currency)}</div>
        <div className="small" style={{ color: tone }}>{(pct * 100).toFixed(0)}%</div>
      </div>
      <div style={{ height: 10, borderRadius: 999, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)" }}>
        <div style={{ width: `${Math.min(100, pct * 100)}%`, height: "100%", borderRadius: 999, background: tone }} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card" style={{ gridColumn: "span 3" }}>
      <div className="small">{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{value}</div>
      <div className="small" style={{ marginTop: 6 }}>{sub}</div>
    </div>
  );
}

export default function FamilyBudget({ onNavigate }: { onNavigate?: (id: string) => void } = {}) {
  const [tab, setTab] = useState<BudgetTab>(() => loadJSON<BudgetTab>(TAB_KEY, "Overview"));
  const [state, setState] = useState<FamilyBudgetState>(() => {
    const next = loadJSON<FamilyBudgetState | null>(STORAGE_KEY, null);
    if (next) return normalizeState(next);
    return normalizeState(loadJSON<FamilyBudgetState>(LEGACY_STORAGE_KEY, makeDemoState()));
  });
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvData, setCsvData] = useState<ParsedCsv>({ headers: [], rows: [] });
  const [csvPreset, setCsvPreset] = useState<CsvPresetName | "">("");
  const [csvMapper, setCsvMapper] = useState<CsvMapper>({ date: "", merchant: "", amount: "", category: "" });
  const [csvInvertAmountSign, setCsvInvertAmountSign] = useState(false);
  const [csvTargetAccountId, setCsvTargetAccountId] = useState("");
  const [payoffStrategy, setPayoffStrategy] = useState<PayoffStrategy>(() => loadJSON<PayoffStrategy>(PAYOFF_KEY, "AVALANCHE"));
  const [extraPaymentPerMonth, setExtraPaymentPerMonth] = useState("200");
  const [payoffMaxMonths, setPayoffMaxMonths] = useState("240");
  const [syncBusy, setSyncBusy] = useState<"" | "health" | "pull" | "push">("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const isUndocked = urlParams.get("undock") === "1";
  const forcedTab = (urlParams.get("tab") as BudgetTab | null) || null;

  useEffect(() => {
    if (forcedTab && BUDGET_TABS.includes(forcedTab)) setTab(forcedTab);
  }, [forcedTab]);

  useEffect(() => {
    saveJSON(STORAGE_KEY, state);
  }, [state]);

  useEffect(() => {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    saveJSON(TAB_KEY, tab);
  }, [tab]);

  useEffect(() => {
    saveJSON(PAYOFF_KEY, payoffStrategy);
  }, [payoffStrategy]);

  useEffect(() => {
    if (!csvTargetAccountId) {
      const defaultAccount = state.accounts.find((account) => account.type === "CHECKING")?.id || state.accounts[0]?.id || "";
      setCsvTargetAccountId(defaultAccount);
    }
  }, [csvTargetAccountId, state.accounts]);

  const currentMonth = todayIso().slice(0, 7);
  const sortedTx = useMemo(() => [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)), [state.transactions]);

  const filteredTx = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedTx;
    return sortedTx.filter((tx) =>
      tx.merchant.toLowerCase().includes(q) ||
      tx.category.toLowerCase().includes(q) ||
      tx.date.includes(q) ||
      (tx.note || "").toLowerCase().includes(q)
    );
  }, [query, sortedTx]);

  const totals = useMemo(() => {
    const assets = state.accounts.filter((a) => a.balance >= 0).reduce((sum, a) => sum + a.balance, 0);
    const liabilities = Math.abs(state.accounts.filter((a) => a.balance < 0).reduce((sum, a) => sum + a.balance, 0));
    const cash = state.accounts.filter((a) => a.type === "CHECKING" || a.type === "SAVINGS").reduce((sum, a) => sum + a.balance, 0);
    const investments = state.accounts.filter((a) => a.type === "INVESTMENT").reduce((sum, a) => sum + a.balance, 0);
    const crypto = state.accounts.filter((a) => a.type === "CRYPTO").reduce((sum, a) => sum + a.balance, 0);
    const realEstate = state.accounts.filter((a) => a.type === "PROPERTY").reduce((sum, a) => sum + a.balance, 0);
    const vehicles = state.accounts.filter((a) => a.type === "VEHICLE").reduce((sum, a) => sum + a.balance, 0);
    return { assets, liabilities, cash, investments, crypto, realEstate, vehicles, netWorth: assets - liabilities };
  }, [state.accounts]);

  const monthTx = useMemo(() => state.transactions.filter((tx) => isoMonth(tx.date) === currentMonth), [state.transactions, currentMonth]);
  const monthIncome = monthTx.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const monthSpending = Math.abs(monthTx.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + tx.amount, 0));

  const budgetProgress = useMemo(() => {
    return state.budgetLines.map((line) => {
      const actual = Math.abs(
        monthTx
          .filter((tx) => tx.category.toLowerCase() === line.category.toLowerCase())
          .reduce((sum, tx) => sum + (tx.amount < 0 ? tx.amount : 0), 0)
      );
      return { ...line, actual };
    }).sort((a, b) => b.actual - a.actual);
  }, [monthTx, state.budgetLines]);

  const monthlyPlanBars = useMemo(() => {
    return state.annualPlan.map((row) => ({
      label: row.month.slice(5),
      value: Math.max(0, row.expectedIncome - row.fixedExpenses - row.flexibleExpenses - row.nonMonthlyExpenses - row.savingsGoal)
    }));
  }, [state.annualPlan]);

  const categorySpend = useMemo(() => {
    const map = new Map<string, number>();
    monthTx.filter((tx) => tx.amount < 0).forEach((tx) => {
      map.set(tx.category, (map.get(tx.category) || 0) + Math.abs(tx.amount));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  }, [monthTx]);

  const topAssetAccounts = useMemo(() => {
    return [...state.accounts]
      .filter((account) => ["INVESTMENT", "CRYPTO", "PROPERTY"].includes(account.type))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 4);
  }, [state.accounts]);

  const liabilityAccounts = useMemo(() => {
    return state.accounts
      .filter((account) => account.balance < 0 || account.type === "CREDIT_CARD" || account.type === "LOAN")
      .map((account) => ({
        ...account,
        payoffBalance: Math.abs(account.balance),
        apr: Number(account.apr ?? 0),
        minPayment: Number(account.minPayment ?? 0)
      }))
      .filter((account) => account.payoffBalance > 0.009)
      .sort((a, b) => b.payoffBalance - a.payoffBalance);
  }, [state.accounts]);

  const upcomingRecurring = useMemo(() => [...state.recurring].sort((a, b) => a.nextDue.localeCompare(b.nextDue)).slice(0, 4), [state.recurring]);
  const budgetAnomalies = useMemo(() => budgetProgress.filter((line) => line.planned > 0 && line.actual > line.planned * 1.1).slice(0, 3), [budgetProgress]);
  const currentPlanRow = useMemo(() => state.annualPlan.find((row) => row.month === currentMonth) || state.annualPlan[0], [state.annualPlan, currentMonth]);
  const projectedFreeCash = useMemo(() => currentPlanRow ? currentPlanRow.expectedIncome - currentPlanRow.fixedExpenses - currentPlanRow.flexibleExpenses - currentPlanRow.nonMonthlyExpenses - currentPlanRow.savingsGoal : 0, [currentPlanRow]);
  const payoffFocus = useMemo(() => liabilityAccounts[0] || null, [liabilityAccounts]);
  const goalGap = useMemo(() => state.goals.reduce((sum, goal) => sum + Math.max(0, goal.target - goal.current), 0), [state.goals]);

  const csvPreviewRows = useMemo(() => csvData.rows.slice(0, 8), [csvData.rows]);

  const csvImportPreview = useMemo(() => {
    const out = csvPreviewRows.map((row) => {
      const rawAmount = csvMapper.amount ? row[csvMapper.amount] || "" : "";
      const parsedAmount = rawAmount ? parseAmountValue(rawAmount) : null;
      const amount = parsedAmount == null ? "" : String(csvInvertAmountSign ? -parsedAmount : parsedAmount);
      return {
        date: csvMapper.date ? normalizeDateValue(row[csvMapper.date] || "") : "",
        merchant: csvMapper.merchant ? (row[csvMapper.merchant] || "").trim() : "",
        amount,
        category: csvMapper.category ? (row[csvMapper.category] || "").trim() : "Imported"
      };
    });
    return out;
  }, [csvInvertAmountSign, csvMapper, csvPreviewRows]);

  const canImportCsv = Boolean(csvTargetAccountId && csvMapper.date && csvMapper.merchant && csvMapper.amount && csvData.rows.length);

  const payoffResult = useMemo<PayoffResult>(() => {
    const extra = Math.max(0, Number(extraPaymentPerMonth) || 0);
    const maxMonths = Math.max(1, Number(payoffMaxMonths) || 1);
    const working = liabilityAccounts.map((item) => ({
      id: item.id,
      name: item.name,
      balance: Math.max(0, item.payoffBalance),
      apr: Math.max(0, Number(item.apr) || 0),
      minPayment: Math.max(0, Number(item.minPayment) || 0)
    }));
    const schedule: PayoffMonth[] = [];
    let totalInterest = 0;
    let month = 0;

    const sortTargets = (items: typeof working) => {
      const live = items.filter((item) => item.balance > 0.009);
      if (payoffStrategy === "AVALANCHE") {
        return live.sort((a, b) => (b.apr - a.apr) || (a.balance - b.balance));
      }
      return live.sort((a, b) => (a.balance - b.balance) || (b.apr - a.apr));
    };

    if (!working.length) {
      return { monthsToPayoff: 0, totalInterest: 0, isPaidOff: true, schedule: [] };
    }

    while (month < maxMonths && working.some((item) => item.balance > 0.009)) {
      month += 1;
      let monthInterest = 0;
      let monthPayment = 0;
      const targetsBeforeExtra = sortTargets(working);
      const targetName = targetsBeforeExtra[0]?.name || "Done";

      working.forEach((item) => {
        if (item.balance <= 0.009) return;
        const interest = item.balance * (item.apr / 100 / 12);
        item.balance += interest;
        monthInterest += interest;
      });

      working.forEach((item) => {
        if (item.balance <= 0.009) return;
        const fallbackMin = Math.max(25, item.balance * 0.02);
        const minDue = Math.min(item.balance, item.minPayment > 0 ? item.minPayment : fallbackMin);
        item.balance -= minDue;
        monthPayment += minDue;
      });

      let extraLeft = extra;
      while (extraLeft > 0.009) {
        const target = sortTargets(working)[0];
        if (!target) break;
        const pay = Math.min(target.balance, extraLeft);
        target.balance -= pay;
        monthPayment += pay;
        extraLeft -= pay;
      }

      totalInterest += monthInterest;
      const totalBalance = working.reduce((sum, item) => sum + Math.max(0, item.balance), 0);
      schedule.push({ month, totalBalance, totalInterest: monthInterest, totalPayment: monthPayment, targetName });

      if (monthPayment <= 0.009 && totalBalance > 0.009) break;
    }

    const isPaidOff = working.every((item) => item.balance <= 0.009);
    return {
      monthsToPayoff: isPaidOff ? schedule.length : null,
      totalInterest,
      isPaidOff,
      schedule
    };
  }, [extraPaymentPerMonth, liabilityAccounts, payoffMaxMonths, payoffStrategy]);

  const undockTab = async (nextTab: BudgetTab) => {
    const api = oddApi();
    if (!api.openWindow) {
      setMessage("Undock not available in this mode.");
      return;
    }
    const title = `Family Budget — ${nextTab}`;
    const res = await api.openWindow({ panel: "FamilyBudget", title, width: 1280, height: 900, query: { tab: nextTab } });
    if (!res?.ok) setMessage(res?.error || "Undock failed");
  };

  const [quickTx, setQuickTx] = useState<QuickTxDraft>({
    date: todayIso(),
    merchant: "",
    amount: "",
    category: "Groceries",
    accountId: state.accounts.find((account) => account.type === "CHECKING")?.id || state.accounts[0]?.id || "",
    note: ""
  });

  const EMPTY_ACCT: AccountDraft = {
    name: "",
    type: "CHECKING",
    provider: "Manual",
    amount: "",
    liability: false,
    apr: "",
    minPayment: "",
    note: ""
  };
  const [acctDraft, setAcctDraft] = useState<AccountDraft>(EMPTY_ACCT);
  const [acctEditingId, setAcctEditingId] = useState<string | null>(null);

  function seedDemo() {
    const demo = makeDemoState();
    setState(demo);
    setQuickTx((prev) => ({ ...prev, accountId: demo.accounts.find((account) => account.type === "CHECKING")?.id || demo.accounts[0]?.id || "" }));
    setMessage("Demo household loaded.");
  }

  function resetPanel() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const demo = makeDemoState();
    setState(demo);
    setCsvData({ headers: [], rows: [] });
    setCsvFileName("");
    setCsvPreset("");
    setCsvMapper({ date: "", merchant: "", amount: "", category: "" });
    setMessage("Family Budget reset to demo data.");
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `family_budget_${todayIso()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("JSON exported.");
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = JSON.parse(String(reader.result)) as FamilyBudgetState;
        setState(normalizeState(next));
        setMessage("JSON imported.");
      } catch {
        setMessage("Import failed: invalid JSON.");
      }
    };
    reader.readAsText(file);
  }

  async function importCsvFile(file: File) {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.headers.length) {
        setMessage("CSV import failed: no headers found.");
        return;
      }
      const detectedPreset = detectCsvPreset(parsed.headers);
      const mapper = detectedPreset ? buildPresetMapper(parsed.headers, detectedPreset) : { date: parsed.headers[0] || "", merchant: parsed.headers[1] || "", amount: parsed.headers[2] || "", category: parsed.headers[3] || "" };
      setCsvFileName(file.name);
      setCsvData(parsed);
      setCsvPreset(detectedPreset);
      setCsvMapper(mapper);
      setMessage(detectedPreset ? `CSV loaded. Detected ${detectedPreset} mapping.` : "CSV loaded. Review the column mapper before importing.");
    } catch (err) {
      setMessage(`CSV import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function applyCsvPreset(preset: CsvPresetName | "") {
    setCsvPreset(preset);
    if (!preset) return;
    setCsvMapper(buildPresetMapper(csvData.headers, preset));
  }

  function addQuickTransaction() {
    const amount = Number(quickTx.amount);
    if (!quickTx.merchant.trim() || !quickTx.category.trim() || !quickTx.accountId || !Number.isFinite(amount) || amount === 0) {
      setMessage("Fill merchant, amount, category, and account first.");
      return;
    }
    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      date: quickTx.date || todayIso(),
      merchant: quickTx.merchant.trim(),
      amount,
      category: quickTx.category.trim(),
      accountId: quickTx.accountId,
      note: quickTx.note.trim() || undefined
    };
    setState((prev) => ({ ...prev, transactions: [tx, ...prev.transactions] }));
    setQuickTx({ ...quickTx, merchant: "", amount: "", note: "" });
    setMessage("Transaction added.");
  }

  function importMappedTransactions() {
    if (!canImportCsv) {
      setMessage("Pick a CSV, account, and the required Date / Merchant / Amount columns first.");
      return;
    }
    const incoming: Transaction[] = [];
    let skipped = 0;
    csvData.rows.forEach((row, idx) => {
      const rawDate = row[csvMapper.date] || "";
      const rawMerchant = row[csvMapper.merchant] || "";
      const rawAmount = row[csvMapper.amount] || "";
      const normalizedDate = normalizeDateValue(rawDate);
      const parsedAmount = parseAmountValue(rawAmount);
      const amount = parsedAmount == null ? null : (csvInvertAmountSign ? -parsedAmount : parsedAmount);
      if (!normalizedDate || !rawMerchant.trim() || amount == null || amount === 0) {
        skipped += 1;
        return;
      }
      incoming.push({
        id: `csv_${Date.now()}_${idx}`,
        date: normalizedDate,
        merchant: rawMerchant.trim(),
        amount,
        category: csvMapper.category ? (row[csvMapper.category] || "Imported").trim() || "Imported" : "Imported",
        accountId: csvTargetAccountId,
        note: `Imported from ${csvFileName || "CSV"}`
      });
    });

    const { accepted, duplicates } = dedupeTransactions(state.transactions, incoming);
    if (!accepted.length) {
      setMessage(`No new transactions imported. ${duplicates} duplicates, ${skipped} skipped.`);
      return;
    }
    setState((prev) => ({ ...prev, transactions: [...accepted, ...prev.transactions].sort((a, b) => b.date.localeCompare(a.date)) }));
    setMessage(`Imported ${accepted.length} transactions. ${duplicates} duplicates skipped, ${skipped} invalid rows skipped.`);
  }

  function updateBudgetLine(id: string, planned: number) {
    setState((prev) => ({
      ...prev,
      budgetLines: prev.budgetLines.map((line) => (line.id === id ? { ...line, planned } : line))
    }));
  }

  function contributeGoal(id: string) {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.map((goal) => (goal.id === id ? { ...goal, current: Math.min(goal.target, goal.current + goal.monthly) } : goal))
    }));
    setMessage("Goal contribution logged.");
  }

  function toggleConnection(id: string) {
    setState((prev) => ({
      ...prev,
      connections: prev.connections.map((conn) => {
        if (conn.id !== id) return conn;
        const status: ConnectionStatus = conn.status === "ACTIVE" ? "OFFLINE" : "ACTIVE";
        return { ...conn, status, lastSync: todayIso() };
      })
    }));
  }

  function saveHouseholdName(name: string) {
    setState((prev) => ({ ...prev, household: { ...prev.household, name } }));
  }

  function startEditAccount(account: Account) {
    setAcctEditingId(account.id);
    setAcctDraft({
      id: account.id,
      name: account.name,
      type: account.type,
      provider: account.provider || "Manual",
      amount: String(Math.abs(account.balance)),
      liability: account.balance < 0,
      apr: account.balance < 0 ? String(account.apr ?? 0) : "",
      minPayment: account.balance < 0 ? String(account.minPayment ?? 0) : "",
      note: account.note || ""
    });
  }

  function cancelEditAccount() {
    setAcctEditingId(null);
    setAcctDraft(EMPTY_ACCT);
  }

  function saveAccountDraft() {
    const amt = Number(acctDraft.amount);
    if (!acctDraft.name.trim() || !Number.isFinite(amt)) {
      setMessage("Account name + numeric amount required.");
      return;
    }
    const isLiability = acctDraft.liability || acctDraft.type === "CREDIT_CARD" || acctDraft.type === "LOAN";
    const balance = (isLiability ? -1 : 1) * Math.abs(amt);
    setState((prev) => {
      const id = acctEditingId || `acc_${Math.random().toString(16).slice(2)}`;
      const updated: Account = {
        id,
        name: acctDraft.name.trim(),
        type: acctDraft.type,
        balance,
        provider: acctDraft.provider || "Manual",
        note: acctDraft.note || undefined,
        apr: balance < 0 ? Number(acctDraft.apr || 0) : undefined,
        minPayment: balance < 0 ? Number(acctDraft.minPayment || 0) : undefined
      };
      const exists = prev.accounts.some((account) => account.id === id);
      return {
        ...prev,
        accounts: exists ? prev.accounts.map((account) => (account.id === id ? updated : account)) : [updated, ...prev.accounts]
      };
    });
    setMessage(acctEditingId ? "Account updated." : "Account added.");
    cancelEditAccount();
  }

  function deleteAccount(id: string) {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((account) => account.id !== id),
      transactions: prev.transactions.filter((tx) => tx.accountId !== id)
    }));
    if (acctEditingId === id) cancelEditAccount();
    setMessage("Account deleted (and its transactions removed).");
  }

  function updateLiabilityField(id: string, field: "apr" | "minPayment", value: string) {
    const numeric = Math.max(0, Number(value) || 0);
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) => (account.id === id ? { ...account, [field]: numeric } : account))
    }));
  }

  async function bridgeRequest(method: "GET" | "POST", url: string, body?: unknown) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (state.syncBridge.bearerToken.trim()) headers.Authorization = `Bearer ${state.syncBridge.bearerToken.trim()}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const api = oddApi();
    if (api.fetchText && api.isDesktop()) {
      const response = await api.fetchText({
        url,
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        timeoutMs: 15000,
        maxBytes: 5 * 1024 * 1024
      });
      if (!response.ok) throw new Error(response.error || "Request failed");
      const text = response.text || "";
      let parsed: unknown = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
      return { status: response.status || 200, payload: parsed };
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    if (!res.ok) throw new Error(typeof parsed === "string" && parsed ? parsed : `HTTP ${res.status}`);
    return { status: res.status, payload: parsed };
  }

  async function testHealth() {
    setSyncBusy("health");
    try {
      const url = buildSyncUrl(state.syncBridge, "/health");
      const result = await bridgeRequest("GET", url);
      const now = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        syncBridge: {
          ...prev.syncBridge,
          enabled: true,
          lastHealthISO: now,
          lastStatus: `Health OK (${result.status}) — ${summarizeHealthPayload(result.payload)}`,
          lastError: ""
        }
      }));
      setMessage("Backend health check passed.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, syncBridge: { ...prev.syncBridge, lastError: msg, lastStatus: "Health failed" } }));
      setMessage(`Health check failed: ${msg}`);
    } finally {
      setSyncBusy("");
    }
  }

  async function pullSnapshot() {
    setSyncBusy("pull");
    try {
      const url = buildSyncUrl(state.syncBridge, `/households/${encodeURIComponent(state.syncBridge.householdId)}/snapshot`);
      const result = await bridgeRequest("GET", url);
      const remote = normalizeState(result.payload as FamilyBudgetState);
      const merged = mergeRemoteSnapshot(state, remote);
      const now = new Date().toISOString();
      setState({
        ...merged,
        syncBridge: {
          ...merged.syncBridge,
          ...state.syncBridge,
          enabled: true,
          lastPullISO: now,
          lastStatus: `Pulled snapshot (${result.status})`,
          lastError: ""
        }
      });
      setMessage("Remote snapshot pulled into local state.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, syncBridge: { ...prev.syncBridge, lastError: msg, lastStatus: "Pull failed" } }));
      setMessage(`Pull failed: ${msg}`);
    } finally {
      setSyncBusy("");
    }
  }

  async function pushSnapshot() {
    setSyncBusy("push");
    try {
      const url = buildSyncUrl(state.syncBridge, `/households/${encodeURIComponent(state.syncBridge.householdId)}/snapshot`);
      const result = await bridgeRequest("POST", url, state);
      const now = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        syncBridge: {
          ...prev.syncBridge,
          enabled: true,
          lastPushISO: now,
          lastStatus: `Pushed snapshot (${result.status})`,
          lastError: ""
        }
      }));
      setMessage("Local snapshot pushed to backend.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, syncBridge: { ...prev.syncBridge, lastError: msg, lastStatus: "Push failed" } }));
      setMessage(`Push failed: ${msg}`);
    } finally {
      setSyncBusy("");
    }
  }

  function handlePanelAction(envelope: PanelActionEnvelope) {
    const finish = () => acknowledgePanelAction(envelope.id);
    if (envelope.actionId === "system:reload-from-storage") {
      setState(normalizeState(loadJSON<FamilyBudgetState>(STORAGE_KEY, makeDemoState())));
      setTab(loadJSON<BudgetTab>(TAB_KEY, "Overview"));
      setPayoffStrategy(loadJSON<PayoffStrategy>(PAYOFF_KEY, "AVALANCHE"));
      setMessage("Reloaded Family Budget from saved storage.");
      finish();
      return;
    }
    if (envelope.actionId === "budget:payoff-avalanche") {
      const prevTab = tab;
      const prevStrategy = payoffStrategy;
      setTab("Payoff");
      setPayoffStrategy("AVALANCHE");
      setMessage("AI opened the Avalanche payoff view.");
      rememberActionOutcome({ panelId: "FamilyBudget", actionId: envelope.actionId, title: "Opened Avalanche payoff", body: "Family Budget switched to the payoff planner with Avalanche selected.", status: "success", undoSteps: [{ kind: "storage", key: TAB_KEY, prev: prevTab }, { kind: "storage", key: PAYOFF_KEY, prev: prevStrategy }] });
      finish();
      return;
    }
    if (envelope.actionId === "budget:payoff-snowball") {
      const prevTab = tab;
      const prevStrategy = payoffStrategy;
      setTab("Payoff");
      setPayoffStrategy("SNOWBALL");
      setMessage("AI opened the Snowball payoff view.");
      rememberActionOutcome({ panelId: "FamilyBudget", actionId: envelope.actionId, title: "Opened Snowball payoff", body: "Family Budget switched to the payoff planner with Snowball selected.", status: "success", undoSteps: [{ kind: "storage", key: TAB_KEY, prev: prevTab }, { kind: "storage", key: PAYOFF_KEY, prev: prevStrategy }] });
      finish();
      return;
    }
    if (envelope.actionId === "budget:test-sync") {
      setTab("Settings");
      if (!state.syncBridge.baseUrl.trim() || !state.syncBridge.householdId.trim()) {
        setMessage("Fill Base URL and Household ID first, then rerun the AI sync test.");
        rememberActionOutcome({ panelId: "FamilyBudget", actionId: envelope.actionId, title: "Budget sync test blocked", body: "Base URL or Household ID is missing in Settings.", status: "warn" });
        finish();
        return;
      }
      void testHealth().then(() => rememberActionOutcome({ panelId: "FamilyBudget", actionId: envelope.actionId, title: "Ran budget sync test", body: "Health test completed against the backend sync bridge.", status: "success" })).catch((err) => rememberActionOutcome({ panelId: "FamilyBudget", actionId: envelope.actionId, title: "Budget sync test failed", body: err instanceof Error ? err.message : String(err), status: "error" })).finally(finish);
      return;
    }
    if (envelope.actionId === "budget:fund-goals") {
      if (!state.goals.length) {
        setTab("Goals");
        setMessage("No goals are saved yet. Add one first so the AI can fund it.");
        rememberActionOutcome({ panelId: "FamilyBudget", actionId: envelope.actionId, title: "Fund goals blocked", body: "No goals exist yet, so the AI could not apply monthly contributions.", status: "warn" });
        finish();
        return;
      }
      const prevState = state;
      setTab("Goals");
      setState((prev) => ({
        ...prev,
        goals: prev.goals.map((goal) => ({ ...goal, current: Math.min(goal.target, goal.current + goal.monthly) }))
      }));
      setMessage("AI applied one monthly contribution across all goals.");
      rememberActionOutcome({ panelId: "FamilyBudget", actionId: envelope.actionId, title: "Funded budget goals", body: `Applied one monthly contribution across ${state.goals.length} goal${state.goals.length === 1 ? "" : "s"}.`, status: "success", undoSteps: [{ kind: "storage", key: STORAGE_KEY, prev: prevState }, { kind: "storage", key: TAB_KEY, prev: tab }] });
      finish();
      return;
    }
    finish();
  }

  useEffect(() => {
    [...getPanelActions("FamilyBudget")].reverse().forEach(handlePanelAction);
    const onAction = (evt: Event) => {
      const detail = (evt as CustomEvent<PanelActionEnvelope>).detail;
      if (detail?.panelId === "FamilyBudget") handlePanelAction(detail);
    };
    window.addEventListener(PANEL_ACTION_EVENT, onAction as EventListener);
    return () => window.removeEventListener(PANEL_ACTION_EVENT, onAction as EventListener);
  }, [state.syncBridge.baseUrl, state.syncBridge.householdId, state.goals.length]);

  return (
    <div className="card familyBudgetRoot">
      <PanelHeader panelId="FamilyBudget" title="Family Budget" storagePrefix="oddengine:familyBudget" />

      <div className="familyBudgetHero">
        <div>
          <div className="small shellEyebrow">HOUSEHOLD COMMAND CENTER</div>
          <div className="familyBudgetHeroTitle">Family Budget</div>
          <div className="small familyBudgetHeroSub">Net worth, cashflow, bills, goals, and debt payoff all in one clean household desk.</div>
        </div>
        <div className="familyBudgetHeroBadges">
          <span className="badge">Net worth {money(totals.netWorth, state.household.currency)}</span>
          <span className={`badge ${projectedFreeCash >= 0 ? "good" : "bad"}`}>{projectedFreeCash >= 0 ? "Free cash positive" : "Free cash negative"}</span>
          <span className="badge">Goal gap {money(goalGap, state.household.currency)}</span>
          {payoffFocus && <span className="badge warn">Payoff focus {payoffFocus.name}</span>}
        </div>
      </div>

      <div className="card softCard familyCohesionCard familyBudgetCohesionCard">
        <div className="familyCohesionTop">
          <div>
            <div className="small shellEyebrow">FAMILY FLOW</div>
            <div className="familyCohesionTitle">Budget should steer meals, chores, and calendar rhythm</div>
            <div className="small familyCohesionSub">Treat grocery wins, recurring chores, and calendar routines as real household runway levers instead of isolated panels.</div>
          </div>
          <div className="familyRouteRow">
            <button className="tabBtn" onClick={() => onNavigate?.("Home")}>Open Home</button>
            <button className="tabBtn" onClick={() => onNavigate?.("GroceryMeals")}>Meals + Grocery</button>
            <button className="tabBtn" onClick={() => onNavigate?.("DailyChores")}>Chores</button>
            <button className="tabBtn" onClick={() => onNavigate?.("Calendar")}>Calendar</button>
          </div>
        </div>
      </div>

      <div className="familyBudgetMetricStrip">
        <div className="familyBudgetMetricCard">
          <div className="small shellEyebrow">THIS MONTH</div>
          <div className="familyBudgetMetricValue">{money(monthIncome - monthSpending, state.household.currency)}</div>
          <div className="small">{money(monthIncome, state.household.currency)} in • {money(monthSpending, state.household.currency)} out</div>
        </div>
        <div className="familyBudgetMetricCard">
          <div className="small shellEyebrow">RUNWAY</div>
          <div className="familyBudgetMetricValue">{money(projectedFreeCash, state.household.currency)}</div>
          <div className="small">Projected free cash after monthly plan</div>
        </div>
        <div className="familyBudgetMetricCard">
          <div className="small shellEyebrow">UPCOMING</div>
          <div className="familyBudgetMetricValue">{upcomingRecurring.length}</div>
          <div className="small">Bills or subscriptions due soon</div>
        </div>
        <div className="familyBudgetMetricCard">
          <div className="small shellEyebrow">ANOMALIES</div>
          <div className="familyBudgetMetricValue">{budgetAnomalies.length}</div>
          <div className="small">Budget buckets running above plan</div>
        </div>
      </div>

      <div className="familyBudgetWarRoomGrid">
        <div className="card softCard familyBudgetWarRoomCard">
          <div className="small shellEyebrow">SAVINGS WAR ROOM</div>
          <div style={{ fontWeight: 900, fontSize: 20, marginTop: 6 }}>Make grocery wins extend the household runway</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>
            Tie the Grocery command center directly into the budget. Treat weekly list discipline, coupon hits, and cheap-week planning as a real cashflow lever instead of an afterthought.
          </div>
          <div className="familyBudgetWarMetrics">
            <div className="card familyBudgetWarMini">
              <div className="small shellEyebrow">GROCERY LANE</div>
              <div className="familyBudgetMetricValue">{grocerySaveLane}</div>
              <div className="small">{groceryBudgetLine ? `${money(grocerySpendActual, state.household.currency)} vs ${money(grocerySpendPlanned, state.household.currency)}` : "Add a grocery budget line"}</div>
            </div>
            <div className="card familyBudgetWarMini">
              <div className="small shellEyebrow">RUNWAY MOVE</div>
              <div className="familyBudgetMetricValue">{money(Math.max(0, groceryWarRoomGap), state.household.currency)}</div>
              <div className="small">{groceryWarRoomGap >= 0 ? "Potential monthly breathing room" : `Need ${money(groceryTighten, state.household.currency)} back`}</div>
            </div>
            <div className="card familyBudgetWarMini">
              <div className="small shellEyebrow">PRIORITY</div>
              <div className="familyBudgetMetricValue" style={{ fontSize: 18 }}>{householdWarPriority}</div>
              <div className="small">Highest-impact household lever</div>
            </div>
          </div>
          <div className="assistantStack" style={{ marginTop: 12 }}>
            <div className="timelineCard">
              <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 800 }}>1. Stabilize grocery spend</div>
                <span className={`badge ${groceryWarRoomGap >= 0 ? "good" : "warn"}`}>{grocerySaveLane}</span>
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                {groceryBudgetLine ? `Aim to hold groceries near ${money(grocerySpendPlanned, state.household.currency)} and route every coupon/deal win into extra runway.` : "Create a groceries budget line so coupon wins show up in the household plan."}
              </div>
            </div>
            <div className="timelineCard">
              <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 800 }}>2. Protect monthly free cash</div>
                <span className={`badge ${projectedFreeCash >= 0 ? "good" : "bad"}`}>{money(projectedFreeCash, state.household.currency)}</span>
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                Grocery discipline is the fastest recurring lifestyle lever. Keep it tight so the month closes stronger without touching essentials.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="spotlightGrid familyBudgetFollowupGrid">
        <div className="card spotlightCard familyBudgetFollowupCard">
          <div className="small shellEyebrow">MONEY PLAYBOOK</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>{projectedFreeCash >= 0 ? "Protect positive cashflow" : "Stabilize the month"}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>{projectedFreeCash >= 0 ? `Keep the monthly edge intact, then point extra cash toward ${payoffFocus?.name || "your next goal"}.` : "Cut flexible spend first, review upcoming bills, and pause nonessential pushes until runway turns positive."}</div>
        </div>
        <div className="card spotlightCard familyBudgetFollowupCard">
          <div className="small shellEyebrow">NEXT LEVER</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>{budgetAnomalies[0]?.label || payoffFocus?.name || "Goal funding"}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>{budgetAnomalies.length ? `The cleanest savings move is tightening ${budgetAnomalies[0].label} back toward plan before the next close.` : payoffFocus ? `Once the month is stable, concentrate extra cash on ${payoffFocus.name} to shorten payoff time.` : "Once the base month is stable, route surplus toward the next household goal."}</div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {BUDGET_TABS.map((id) => (
            <button key={id} className={`tabBtn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{id}</button>
          ))}
        </div>
        <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          {!isUndocked && <button onClick={() => undockTab(tab)} title="Open this tab in a separate window">Undock tab</button>}
          {isUndocked && <button onClick={() => window.close()} title="Close this undocked window">Close window</button>}
        </div>
      </div>

      <div className="quickActionGrid" style={{ marginTop: 14 }}>
        <div className="card spotlightCard">
          <div className="small shellEyebrow">Forecast</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 4 }}>Cashflow runway</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.5 }}>{currentPlanRow ? `${currentPlanRow.month} is pacing for ${money(projectedFreeCash, state.household.currency)} after fixed, flexible, non-monthly, and savings goals.` : `Add an annual plan row to unlock forward cashflow forecasting.`}</div>
          <div className="assistantChipWrap">
            <span className={`badge ${projectedFreeCash >= 0 ? "good" : "bad"}`}>{money(projectedFreeCash, state.household.currency)} projected free cash</span>
            <span className="badge">Gap to goals {money(goalGap, state.household.currency)}</span>
          </div>
        </div>
        <div className="card spotlightCard">
          <div className="small shellEyebrow">Upcoming bills</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 4 }}>{upcomingRecurring[0] ? upcomingRecurring[0].name : "No recurring items saved"}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{upcomingRecurring.length ? upcomingRecurring.map((item) => `${item.nextDue} • ${item.name} • ${money(item.amount, state.household.currency)}`).join("\n") : `Add bills or subscriptions to create a bill calendar lane.`}</div>
          <div className="assistantChipWrap">
            <span className="badge warn">{upcomingRecurring.length} upcoming</span>
            <span className="badge">{state.recurring.filter((item) => item.type === "subscription").length} subscriptions</span>
          </div>
        </div>
        <div className="card spotlightCard">
          <div className="small shellEyebrow">Anomaly radar</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 4 }}>{budgetAnomalies[0] ? budgetAnomalies[0].label : "Budget is on plan"}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{budgetAnomalies.length ? budgetAnomalies.map((line) => `${line.label}: ${money(line.actual, state.household.currency)} vs ${money(line.planned, state.household.currency)} planned`).join("\n") : `No spending categories are running more than 10% above plan this month.`}</div>
          <div className="assistantChipWrap">
            <span className={`badge ${budgetAnomalies.length ? "warn" : "good"}`}>{budgetAnomalies.length ? `${budgetAnomalies.length} over-plan buckets` : "Clean month"}</span>
            {payoffFocus && <span className="badge bad">Payoff focus {payoffFocus.name}</span>}
          </div>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={seedDemo}>Seed demo household</button>
        <button onClick={exportJson}>Export JSON</button>
        <button onClick={() => fileInputRef.current?.click()}>Import JSON</button>
        <button onClick={resetPanel}>Reset panel</button>
        <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) importJson(file); e.currentTarget.value = ""; }} />
        {message && <span className="small">{message}</span>}
      </div>

      {tab === "Overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
          <MetricCard label="Net worth" value={money(totals.netWorth, state.household.currency)} sub={`Assets ${money(totals.assets, state.household.currency)} • Liabilities ${money(totals.liabilities, state.household.currency)}`} />
          <MetricCard label="Cash" value={money(totals.cash, state.household.currency)} sub="Checking + savings" />
          <MetricCard label="Investments" value={money(totals.investments + totals.crypto, state.household.currency)} sub="Brokerage + crypto" />
          <MetricCard label="This month" value={money(monthIncome - monthSpending, state.household.currency)} sub={`${money(monthIncome, state.household.currency)} in • ${money(monthSpending, state.household.currency)} out`} />

          <div className="card" style={{ gridColumn: "span 8" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Net worth over time</div>
            <div className="small" style={{ marginTop: 4 }}>Local-first net worth history with imports and sync ready when you want it.</div>
            <div style={{ marginTop: 12 }}>
              <LineSvg points={state.netWorthHistory.map((point) => ({ label: point.date.slice(5), value: point.value }))} />
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 4" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Top buckets this month</div>
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              {budgetProgress.slice(0, 5).map((line) => (
                <div key={line.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                    <div style={{ fontWeight: 800 }}>{line.label}</div>
                    <span className="badge">{line.bucket}</span>
                  </div>
                  <ProgressBar actual={line.actual} planned={line.planned} currency={state.household.currency} />
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 7" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Recent transactions</div>
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTx.slice(0, 8).map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.date}</td>
                      <td>{tx.merchant}</td>
                      <td><span className="badge">{tx.category}</span></td>
                      <td style={{ textAlign: "right", color: lineColorByAmount(tx.amount), fontWeight: 800 }}>{money(tx.amount, state.household.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 5" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Connection health</div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {state.connections.map((conn) => (
                <div key={conn.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{conn.displayName}</div>
                    <div className="small">{conn.provider} • last sync {conn.lastSync}</div>
                  </div>
                  <span className={`badge ${conn.status === "ACTIVE" ? "good" : conn.status === "PENDING" ? "warn" : "bad"}`}>{conn.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 8" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Household money flow</div>
            <div className="small" style={{ marginTop: 4 }}>Income after fixed + flexible + non-monthly planning.</div>
            <div style={{ marginTop: 12 }}>
              <BarSvg items={monthlyPlanBars} color="#60a5fa" />
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 4" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Top assets</div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {topAssetAccounts.map((account) => (
                <div key={account.id} className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 800 }}>{account.name}</div>
                  <div className="small">{account.type} • {account.provider}</div>
                  <div style={{ marginTop: 8, fontSize: 18, fontWeight: 900 }}>{money(account.balance, state.household.currency)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "Accounts" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
          <div className="card" style={{ gridColumn: "span 8" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Accounts</div>
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Provider</th>
                    <th style={{ textAlign: "right" }}>Balance</th>
                    <th style={{ textAlign: "right" }}>APR</th>
                    <th style={{ textAlign: "right" }}>Min pay</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.accounts.map((account) => (
                    <tr key={account.id}>
                      <td>{account.name}</td>
                      <td><span className="badge">{account.type}</span></td>
                      <td>{account.provider || "Manual"}</td>
                      <td style={{ textAlign: "right", color: account.balance < 0 ? "var(--bad)" : "var(--fg)", fontWeight: 800 }}>{money(account.balance, state.household.currency)}</td>
                      <td style={{ textAlign: "right" }}>{account.balance < 0 ? `${Number(account.apr || 0).toFixed(2)}%` : "—"}</td>
                      <td style={{ textAlign: "right" }}>{account.balance < 0 ? money(Number(account.minPayment || 0), state.household.currency) : "—"}</td>
                      <td>
                        <div className="row" style={{ flexWrap: "wrap" }}>
                          <button onClick={() => startEditAccount(account)}>Edit</button>
                          <button onClick={() => deleteAccount(account.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 4" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{acctEditingId ? "Edit account" : "Add account"}</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <input value={acctDraft.name} onChange={(e) => setAcctDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Account name" />
              <select value={acctDraft.type} onChange={(e) => setAcctDraft((prev) => ({ ...prev, type: e.target.value as AccountType }))}>
                <option value="CHECKING">Checking</option>
                <option value="SAVINGS">Savings</option>
                <option value="CREDIT_CARD">Credit card</option>
                <option value="INVESTMENT">Investment</option>
                <option value="CRYPTO">Crypto</option>
                <option value="PROPERTY">Property</option>
                <option value="VEHICLE">Vehicle</option>
                <option value="LOAN">Loan</option>
              </select>
              <input value={acctDraft.provider} onChange={(e) => setAcctDraft((prev) => ({ ...prev, provider: e.target.value }))} placeholder="Provider" />
              <input value={acctDraft.amount} onChange={(e) => setAcctDraft((prev) => ({ ...prev, amount: e.target.value }))} placeholder="Amount / balance" type="number" />
              <label className="row small"><input style={{ width: 16 }} type="checkbox" checked={acctDraft.liability} onChange={(e) => setAcctDraft((prev) => ({ ...prev, liability: e.target.checked }))} /> Treat as liability</label>
              {(acctDraft.liability || acctDraft.type === "CREDIT_CARD" || acctDraft.type === "LOAN") && (
                <>
                  <input value={acctDraft.apr} onChange={(e) => setAcctDraft((prev) => ({ ...prev, apr: e.target.value }))} placeholder="APR %" type="number" />
                  <input value={acctDraft.minPayment} onChange={(e) => setAcctDraft((prev) => ({ ...prev, minPayment: e.target.value }))} placeholder="Minimum payment" type="number" />
                </>
              )}
              <textarea value={acctDraft.note} onChange={(e) => setAcctDraft((prev) => ({ ...prev, note: e.target.value }))} placeholder="Note" rows={4} />
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button onClick={saveAccountDraft}>{acctEditingId ? "Save changes" : "Add account"}</button>
                {acctEditingId && <button onClick={cancelEditAccount}>Cancel</button>}
              </div>
            </div>
            <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
              <div className="badge">Cash {money(totals.cash, state.household.currency)}</div>
              <div className="badge">Investments {money(totals.investments, state.household.currency)}</div>
              <div className="badge">Crypto {money(totals.crypto, state.household.currency)}</div>
              <div className="badge">Real estate {money(totals.realEstate, state.household.currency)}</div>
              <div className="badge">Vehicles {money(totals.vehicles, state.household.currency)}</div>
              <div className="badge bad">Liabilities {money(totals.liabilities, state.household.currency)}</div>
            </div>
          </div>
        </div>
      )}

      {tab === "Transactions" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
          <div className="card" style={{ gridColumn: "span 8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Transactions</div>
                <div className="small" style={{ marginTop: 4 }}>Search local transactions or import new ones from CSV exports.</div>
              </div>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <input style={{ minWidth: 240 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search merchant / category / date" />
                <button onClick={() => csvInputRef.current?.click()}>Choose CSV</button>
                <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) importCsvFile(file); e.currentTarget.value = ""; }} />
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th>Account</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.slice(0, 200).map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.date}</td>
                      <td>
                        <div>{tx.merchant}</div>
                        {tx.note && <div className="small">{tx.note}</div>}
                      </td>
                      <td><span className="badge">{tx.category}</span></td>
                      <td>{state.accounts.find((account) => account.id === tx.accountId)?.name || tx.accountId}</td>
                      <td style={{ textAlign: "right", color: lineColorByAmount(tx.amount), fontWeight: 800 }}>{money(tx.amount, state.household.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 4" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Quick add</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <input value={quickTx.date} onChange={(e) => setQuickTx((prev) => ({ ...prev, date: e.target.value }))} type="date" />
              <input value={quickTx.merchant} onChange={(e) => setQuickTx((prev) => ({ ...prev, merchant: e.target.value }))} placeholder="Merchant" />
              <input value={quickTx.amount} onChange={(e) => setQuickTx((prev) => ({ ...prev, amount: e.target.value }))} placeholder="Amount (+income / -spend)" type="number" />
              <input value={quickTx.category} onChange={(e) => setQuickTx((prev) => ({ ...prev, category: e.target.value }))} placeholder="Category" />
              <select value={quickTx.accountId} onChange={(e) => setQuickTx((prev) => ({ ...prev, accountId: e.target.value }))}>
                {state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
              <textarea value={quickTx.note} onChange={(e) => setQuickTx((prev) => ({ ...prev, note: e.target.value }))} rows={3} placeholder="Note" />
              <button onClick={addQuickTransaction}>Add transaction</button>
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 12" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>CSV import mappings</div>
                <div className="small" style={{ marginTop: 4 }}>Preset detection + custom column mapper + preview + dedupe import.</div>
              </div>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <span className="badge">{csvFileName || "No CSV chosen"}</span>
                <span className="badge good">Rows {csvData.rows.length}</span>
                <span className="badge">Headers {csvData.headers.length}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
              <div className="card" style={{ gridColumn: "span 4" }}>
                <div style={{ fontWeight: 800 }}>Import setup</div>
                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <select value={csvTargetAccountId} onChange={(e) => setCsvTargetAccountId(e.target.value)}>
                    {state.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                  <select value={csvPreset} onChange={(e) => applyCsvPreset((e.target.value || "") as CsvPresetName | "") }>
                    <option value="">No preset / custom</option>
                    <option value="Plaid_Generic">Plaid_Generic</option>
                    <option value="Chase">Chase</option>
                    <option value="BankOfAmerica">BankOfAmerica</option>
                    <option value="WellsFargo">WellsFargo</option>
                    <option value="AppleCard">AppleCard</option>
                  </select>
                  <label className="small">Date column</label>
                  <select value={csvMapper.date} onChange={(e) => setCsvMapper((prev) => ({ ...prev, date: e.target.value }))}>
                    <option value="">Choose date column</option>
                    {csvData.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                  <label className="small">Merchant column</label>
                  <select value={csvMapper.merchant} onChange={(e) => setCsvMapper((prev) => ({ ...prev, merchant: e.target.value }))}>
                    <option value="">Choose merchant column</option>
                    {csvData.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                  <label className="small">Amount column</label>
                  <select value={csvMapper.amount} onChange={(e) => setCsvMapper((prev) => ({ ...prev, amount: e.target.value }))}>
                    <option value="">Choose amount column</option>
                    {csvData.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                  <label className="small">Category column (optional)</label>
                  <select value={csvMapper.category} onChange={(e) => setCsvMapper((prev) => ({ ...prev, category: e.target.value }))}>
                    <option value="">None / imported</option>
                    {csvData.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                  <label className="row small"><input style={{ width: 16 }} type="checkbox" checked={csvInvertAmountSign} onChange={(e) => setCsvInvertAmountSign(e.target.checked)} /> Invert amount sign</label>
                  <button disabled={!canImportCsv} onClick={importMappedTransactions}>Import with dedupe</button>
                </div>
              </div>

              <div className="card" style={{ gridColumn: "span 8" }}>
                <div style={{ fontWeight: 800 }}>Preview</div>
                <div className="small" style={{ marginTop: 4 }}>First rows after mapping. Deduping happens by date + merchant + amount + account.</div>
                <div style={{ overflowX: "auto", marginTop: 10 }}>
                  <table className="dataTable">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Merchant</th>
                        <th style={{ textAlign: "right" }}>Amount</th>
                        <th>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvImportPreview.length ? csvImportPreview.map((row, idx) => (
                        <tr key={`${row.date}-${row.merchant}-${idx}`}>
                          <td>{row.date || "—"}</td>
                          <td>{row.merchant || "—"}</td>
                          <td style={{ textAlign: "right" }}>{row.amount ? money(Number(row.amount), state.household.currency) : "—"}</td>
                          <td>{row.category || "Imported"}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="small">Choose a CSV to preview mapped rows.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "Budget" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
          <div className="card" style={{ gridColumn: "span 7" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Budget lines</div>
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              {budgetProgress.map((line) => (
                <div key={line.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{line.label}</div>
                      <div className="small">{line.bucket}</div>
                    </div>
                    <input style={{ maxWidth: 140 }} type="number" value={line.planned} onChange={(e) => updateBudgetLine(line.id, Number(e.target.value) || 0)} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <ProgressBar actual={line.actual} planned={line.planned} currency={state.household.currency} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 5" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Rules of the road</div>
            <div className="small" style={{ marginTop: 8 }}>Use this panel like a family control tower: plan the month, paper-trade changes, then decide what to apply in real life.</div>
            <ul className="small" style={{ marginTop: 12, paddingLeft: 18, lineHeight: 1.5 }}>
              <li>Fixed = autopay essentials you protect first.</li>
              <li>Flexible = the lifestyle knobs you can adjust quickly.</li>
              <li>Savings = goals/investing buckets you fund intentionally.</li>
              <li>Non-monthly = annual hits so they stop blindsiding you.</li>
            </ul>
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800 }}>This month snapshot</div>
              <div className="small" style={{ marginTop: 6 }}>Income {money(monthIncome, state.household.currency)}</div>
              <div className="small">Spending {money(monthSpending, state.household.currency)}</div>
              <div className="small">Available after spend {money(monthIncome - monthSpending, state.household.currency)}</div>
            </div>
          </div>
        </div>
      )}

      {tab === "Goals" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
          {state.goals.map((goal) => (
            <div key={goal.id} className="card" style={{ gridColumn: "span 4" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{goal.name}</div>
              <div className="small" style={{ marginTop: 4 }}>{goal.note ?? "No note"}</div>
              <div style={{ marginTop: 12, fontSize: 24, fontWeight: 900 }}>{money(goal.current, state.household.currency)}</div>
              <div className="small">Target {money(goal.target, state.household.currency)} • Monthly {money(goal.monthly, state.household.currency)}</div>
              <div style={{ marginTop: 12 }}>
                <ProgressBar actual={goal.current} planned={goal.target} currency={state.household.currency} />
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button onClick={() => contributeGoal(goal.id)}>Add monthly contribution</button>
                <span className="badge">{((goal.current / goal.target) * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "Recurring" && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Recurring bills + subscriptions</div>
          <div className="small" style={{ marginTop: 4 }}>Simple recurring tracker for monthly household planning.</div>
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Next due</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {state.recurring.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td><span className="badge">{item.type}</span></td>
                    <td>{item.category}</td>
                    <td>{item.nextDue}</td>
                    <td style={{ textAlign: "right", fontWeight: 800 }}>{money(item.amount, state.household.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Reports" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
          <div className="card" style={{ gridColumn: "span 6" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Top spending categories</div>
            <div style={{ marginTop: 12 }}>
              <BarSvg items={categorySpend.length ? categorySpend : [{ label: "None", value: 1 }]} color="#34d399" />
            </div>
          </div>
          <div className="card" style={{ gridColumn: "span 6" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Net worth trend</div>
            <div style={{ marginTop: 12 }}>
              <LineSvg points={state.netWorthHistory.map((point) => ({ label: point.date.slice(5), value: point.value }))} stroke="#fbbf24" />
            </div>
          </div>
        </div>
      )}

      {tab === "Plan" && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Annual plan</div>
          <div className="small" style={{ marginTop: 4 }}>Expected income, fixed, flexible, non-monthly, and savings goal by month.</div>
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Month</th>
                  <th style={{ textAlign: "right" }}>Income</th>
                  <th style={{ textAlign: "right" }}>Fixed</th>
                  <th style={{ textAlign: "right" }}>Flexible</th>
                  <th style={{ textAlign: "right" }}>Non-monthly</th>
                  <th style={{ textAlign: "right" }}>Savings</th>
                  <th style={{ textAlign: "right" }}>Left over</th>
                </tr>
              </thead>
              <tbody>
                {state.annualPlan.map((row) => {
                  const left = row.expectedIncome - row.fixedExpenses - row.flexibleExpenses - row.nonMonthlyExpenses - row.savingsGoal;
                  return (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td style={{ textAlign: "right" }}>{money(row.expectedIncome, state.household.currency)}</td>
                      <td style={{ textAlign: "right" }}>{money(row.fixedExpenses, state.household.currency)}</td>
                      <td style={{ textAlign: "right" }}>{money(row.flexibleExpenses, state.household.currency)}</td>
                      <td style={{ textAlign: "right" }}>{money(row.nonMonthlyExpenses, state.household.currency)}</td>
                      <td style={{ textAlign: "right" }}>{money(row.savingsGoal, state.household.currency)}</td>
                      <td style={{ textAlign: "right", color: left >= 0 ? "var(--good)" : "var(--bad)", fontWeight: 800 }}>{money(left, state.household.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "Payoff" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
          <div className="card" style={{ gridColumn: "span 8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Liabilities payoff planner</div>
                <div className="small" style={{ marginTop: 4 }}>Avalanche = highest APR first. Snowball = smallest balance first.</div>
              </div>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <span className="badge good">Months {payoffResult.monthsToPayoff ?? `>${payoffMaxMonths}`}</span>
                <span className="badge">Interest {money(payoffResult.totalInterest, state.household.currency)}</span>
                <span className={`badge ${payoffResult.isPaidOff ? "good" : "warn"}`}>{payoffResult.isPaidOff ? "Payoff reachable" : "Needs more time / payment"}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
              <div className="card" style={{ gridColumn: "span 4" }}>
                <div style={{ fontWeight: 800 }}>Scenario</div>
                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  <select value={payoffStrategy} onChange={(e) => setPayoffStrategy(e.target.value as PayoffStrategy)}>
                    <option value="AVALANCHE">Avalanche</option>
                    <option value="SNOWBALL">Snowball</option>
                  </select>
                  <input value={extraPaymentPerMonth} onChange={(e) => setExtraPaymentPerMonth(e.target.value)} type="number" placeholder="Extra payment per month" />
                  <input value={payoffMaxMonths} onChange={(e) => setPayoffMaxMonths(e.target.value)} type="number" placeholder="Max months" />
                  <div className="small">Planner uses current balances, APR, minimums, then applies extra payment to the chosen target order.</div>
                </div>
              </div>

              <div className="card" style={{ gridColumn: "span 8" }}>
                <div style={{ fontWeight: 800 }}>Remaining balance timeline</div>
                <div style={{ marginTop: 12 }}>
                  <LineSvg points={payoffResult.schedule.length ? payoffResult.schedule.map((row) => ({ label: `M${row.month}`, value: row.totalBalance })) : [{ label: "M0", value: liabilityAccounts.reduce((sum, item) => sum + item.payoffBalance, 0) || 0 }]} stroke="#34d399" />
                </div>
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Target</th>
                    <th style={{ textAlign: "right" }}>Payment</th>
                    <th style={{ textAlign: "right" }}>Interest</th>
                    <th style={{ textAlign: "right" }}>Remaining balance</th>
                  </tr>
                </thead>
                <tbody>
                  {payoffResult.schedule.length ? payoffResult.schedule.map((row) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td>{row.targetName}</td>
                      <td style={{ textAlign: "right" }}>{money(row.totalPayment, state.household.currency)}</td>
                      <td style={{ textAlign: "right" }}>{money(row.totalInterest, state.household.currency)}</td>
                      <td style={{ textAlign: "right", fontWeight: 800 }}>{money(row.totalBalance, state.household.currency)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="small">No liabilities found. Add a credit card or loan account to use the planner.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 4" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>APR + minimum payments</div>
            <div className="small" style={{ marginTop: 4 }}>Editable on the right so payoff scenarios update instantly.</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {liabilityAccounts.length ? liabilityAccounts.map((account) => (
                <div key={account.id} className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 800 }}>{account.name}</div>
                  <div className="small">Balance {money(account.payoffBalance, state.household.currency)}</div>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    <label className="small">APR %</label>
                    <input type="number" value={Number(account.apr || 0)} onChange={(e) => updateLiabilityField(account.id, "apr", e.target.value)} />
                    <label className="small">Minimum payment</label>
                    <input type="number" value={Number(account.minPayment || 0)} onChange={(e) => updateLiabilityField(account.id, "minPayment", e.target.value)} />
                  </div>
                </div>
              )) : <div className="small">No liabilities yet.</div>}
            </div>
          </div>
        </div>
      )}

      {tab === "Settings" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
          <div className="card" style={{ gridColumn: "span 5" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Household settings</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <input value={state.household.name} onChange={(e) => saveHouseholdName(e.target.value)} placeholder="Household name" />
              <input value={state.household.currency} onChange={(e) => setState((prev) => ({ ...prev, household: { ...prev.household, currency: e.target.value.toUpperCase() || "USD" } }))} placeholder="Currency" />
              <textarea value={state.household.members.join(", ")} onChange={(e) => setState((prev) => ({ ...prev, household: { ...prev.household, members: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } }))} rows={4} />
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 7" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Backend sync bridge</div>
            <div className="small" style={{ marginTop: 4 }}>Health test + pull snapshot + push snapshot with bearer token support.</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <input value={state.syncBridge.baseUrl} onChange={(e) => setState((prev) => ({ ...prev, syncBridge: { ...prev.syncBridge, baseUrl: e.target.value } }))} placeholder="Base URL" />
              <input value={state.syncBridge.routePrefix} onChange={(e) => setState((prev) => ({ ...prev, syncBridge: { ...prev.syncBridge, routePrefix: e.target.value } }))} placeholder="Route prefix" />
              <input value={state.syncBridge.householdId} onChange={(e) => setState((prev) => ({ ...prev, syncBridge: { ...prev.syncBridge, householdId: e.target.value } }))} placeholder="Household ID" />
              <input value={state.syncBridge.bearerToken} onChange={(e) => setState((prev) => ({ ...prev, syncBridge: { ...prev.syncBridge, bearerToken: e.target.value } }))} placeholder="Bearer token (optional)" />
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button disabled={syncBusy !== ""} onClick={testHealth}>{syncBusy === "health" ? "Testing..." : "Test health"}</button>
                <button disabled={syncBusy !== ""} onClick={pullSnapshot}>{syncBusy === "pull" ? "Pulling..." : "Pull snapshot"}</button>
                <button disabled={syncBusy !== ""} onClick={pushSnapshot}>{syncBusy === "push" ? "Pushing..." : "Push snapshot"}</button>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 800 }}>Status</div>
                <div className="small" style={{ marginTop: 6 }}>Last status: {state.syncBridge.lastStatus || "—"}</div>
                <div className="small">Last health: {state.syncBridge.lastHealthISO || "—"}</div>
                <div className="small">Last pull: {state.syncBridge.lastPullISO || "—"}</div>
                <div className="small">Last push: {state.syncBridge.lastPushISO || "—"}</div>
                <div className="small">Last error: {state.syncBridge.lastError || "—"}</div>
              </div>
              <div className="small">Routes used: <code>{buildSyncUrl(state.syncBridge, "/health")}</code> and <code>{buildSyncUrl(state.syncBridge, `/households/${encodeURIComponent(state.syncBridge.householdId || "id")}/snapshot`)}</code></div>
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 12" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Connections</div>
            <div className="small" style={{ marginTop: 4 }}>Toggle simulated connection health for local testing.</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {state.connections.map((conn) => (
                <div key={conn.id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{conn.displayName}</div>
                      <div className="small">{conn.provider} • last sync {conn.lastSync}</div>
                    </div>
                    <div className="row" style={{ flexWrap: "wrap" }}>
                      <span className={`badge ${conn.status === "ACTIVE" ? "good" : conn.status === "PENDING" ? "warn" : "bad"}`}>{conn.status}</span>
                      <button onClick={() => toggleConnection(conn.id)}>{conn.status === "ACTIVE" ? "Mark offline" : "Mark active"}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
