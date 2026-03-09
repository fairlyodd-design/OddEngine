export type DealBreakdown = {
  value: number;
  clarity: number;
  restrictions: number;
  timeframe: number;
};

export type DealScore = {
  score: number;
  breakdown: DealBreakdown;
  valueSignals: string[];
  restrictionSignals: string[];
  timeframeSignals: string[];
  claritySignals: string[];
};

function clamp(n: number, lo: number, hi: number){
  return Math.max(lo, Math.min(hi, n));
}

function hasAny(text: string, words: string[]){
  const t = text.toLowerCase();
  return words.some(w => t.includes(w));
}

export function scoreDealBestOverall(textRaw: string): DealScore {
  const text = (textRaw || "").trim();
  const t = text.toLowerCase();

  const valueSignals: string[] = [];
  const restrictionSignals: string[] = [];
  const timeframeSignals: string[] = [];
  const claritySignals: string[] = [];

  // VALUE
  let value = 0;

  // Percent off
  const percents = Array.from(t.matchAll(/(\d{1,3})\s*%/g)).map(m => Number(m[1])).filter(n => n>0 && n<=100);
  if(percents.length){
    const p = Math.max(...percents);
    valueSignals.push(`${p}% off`);
    value += clamp(p * 0.45, 8, 36); // 10% -> 4.5 (clamped to 8), 50% -> 22.5, 80% -> 36
  }

  // Dollars off / price
  const dollars = Array.from(t.matchAll(/\$\s*(\d{1,4})(?:\.(\d{1,2}))?/g)).map(m => Number(m[1]));
  if(dollars.length){
    const dmax = Math.max(...dollars);
    // ambiguous: $10 off vs $10 item. Still counts as a signal.
    valueSignals.push(`mentions $${dmax}`);
    value += clamp(Math.log10(dmax + 1) * 8, 3, 12);
  }

  // BOGO / bundles / freebies
  if(hasAny(t, ["bogo", "buy 1 get 1", "buy one get one", "2 for 1", "2-for-1", "two for one"])){
    valueSignals.push("BOGO / bundle");
    value += 14;
  }
  if(hasAny(t, ["free", "gift", "bonus", "add-on", "add on", "included"])){
    valueSignals.push("freebie / bonus");
    value += 6;
  }
  if(hasAny(t, ["clearance", "doorbuster", "flash sale", "happy hour"])){
    valueSignals.push("limited-time sale");
    value += 4;
  }
  value = clamp(value, 0, 45);

  // RESTRICTIONS (we score the *lack* of restrictions higher)
  let restrictions = 20;
  const restrictionRules: Array<[string, string, number]> = [
    ["minimum", "minimum spend", 4],
    ["min purchase", "minimum purchase", 4],
    ["with purchase", "requires purchase", 3],
    ["limit", "limited quantity", 3],
    ["one per", "one per customer", 3],
    ["new customer", "new customers only", 3],
    ["first time", "first-time only", 3],
    ["select", "select items only", 2],
    ["exclud", "exclusions apply", 2],
    ["while supplies last", "while supplies last", 2],
    ["in-store only", "in-store only", 2],
    ["delivery only", "delivery only", 2],
    ["pickup only", "pickup only", 2],
    ["members", "members only", 2],
    ["medical only", "medical only", 2],
    ["rec only", "recreational only", 1],
  ];

  for (const [needle, label, pen] of restrictionRules){
    if(t.includes(needle)){
      restrictions -= pen;
      restrictionSignals.push(label);
    }
  }
  if(hasAny(t, ["up to", "as low as", "starting at", "may vary"])){
    restrictions -= 2;
    restrictionSignals.push("ambiguous terms (up to / starting at)");
  }
  restrictions = clamp(restrictions, 0, 20);

  // TIMEFRAME
  let timeframe = 0;
  if(hasAny(t, ["today", "tonight", "this weekend", "weekend", "expires", "ends", "until", "valid", "only on"])){
    timeframeSignals.push("mentions timeframe");
    timeframe += 5;
  }
  // day names
  if(hasAny(t, ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"])){
    timeframeSignals.push("day-specific");
    timeframe += 3;
  }
  // date patterns
  if(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/.test(t) || /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/.test(t)){
    timeframeSignals.push("date-specific");
    timeframe += 4;
  }
  timeframe = clamp(timeframe, 0, 10);

  // CLARITY
  let clarity = 8;
  if(text.length >= 40) clarity += 4;
  if(text.length >= 120) clarity += 2;
  if(percents.length || dollars.length) clarity += 4;
  if(valueSignals.length >= 2) clarity += 3;
  if(timeframe >= 5) clarity += 2;
  // category signals
  const cats = ["flower","pre-roll","preroll","vape","cartridge","edible","gummy","concentrate","wax","shatter","tincture","topical","cbd"];
  if(hasAny(t, cats)){
    clarity += 2;
    claritySignals.push("mentions product category");
  }
  if(hasAny(t, ["includ", "valid", "limit", "exclud", "while supplies last"])){
    clarity += 1;
    claritySignals.push("includes conditions");
  }
  if(hasAny(t, ["details", "see store", "ask", "tbd"])){
    clarity -= 2;
    claritySignals.push("missing specifics");
  }
  clarity = clamp(clarity, 0, 25);

  const score = clamp(Math.round(value + clarity + restrictions + timeframe), 0, 100);

  if(!text){
    return {
      score: 0,
      breakdown: { value:0, clarity:0, restrictions:0, timeframe:0 },
      valueSignals: [],
      restrictionSignals: [],
      timeframeSignals: [],
      claritySignals: []
    };
  }

  return {
    score,
    breakdown: { value, clarity, restrictions, timeframe },
    valueSignals,
    restrictionSignals,
    timeframeSignals,
    claritySignals
  };
}
