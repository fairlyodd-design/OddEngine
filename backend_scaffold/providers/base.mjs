export function normalize(text = '') {
  return String(text).toLowerCase().trim();
}

export function scoreDeal(row, query = '', stores = []) {
  const q = normalize(query);
  const hay = normalize(`${row.title || ''} ${row.summary || ''} ${row.source || ''} ${row.store || ''}`);
  let score = Number(row.score || 50);
  if (q && hay.includes(q)) score += 20;
  for (const store of stores || []) {
    if (normalize(row.store || row.source).includes(normalize(store))) score += 12;
  }
  if (/coupon|digital|bogo|save|off|rollback|markdown/.test(hay)) score += 8;
  if (/freezer|prep|meal|family|bulk|protein|pantry/.test(hay)) score += 5;
  return Math.max(1, Math.min(100, score));
}

export function filterDeals(rows, query = '', stores = []) {
  const q = normalize(query);
  const wantedStores = (stores || []).map(normalize).filter(Boolean);
  const filtered = rows.filter((row) => {
    const hay = normalize(`${row.title || ''} ${row.summary || ''} ${row.source || ''} ${row.store || ''}`);
    const storeHay = normalize(`${row.source || ''} ${row.store || ''}`);
    const qOk = !q || hay.includes(q);
    const sOk = !wantedStores.length || wantedStores.some((s) => storeHay.includes(s));
    return qOk && sOk;
  }).map((row) => ({ ...row, score: scoreDeal(row, query, stores) }));

  return (filtered.length ? filtered : rows.map((row) => ({ ...row, score: scoreDeal(row, query, stores) })))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 24);
}
