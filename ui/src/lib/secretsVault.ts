
export type SecretEntry = { platform: string; apiKey?: string; accessToken?: string; refreshToken?: string; endpoint?: string; updatedAt: number };
const KEY = "oddengine:secrets:v1";
function load<T>(fallback: T): T { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function save(v: any) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} }
export function listSecrets(): SecretEntry[] { return load<SecretEntry[]>([]).sort((a,b)=>b.updatedAt-a.updatedAt); }
export function saveSecret(platform: string, patch: Partial<SecretEntry>) {
  const list = listSecrets();
  const next = { platform, apiKey: String(patch.apiKey || ''), accessToken: String(patch.accessToken || ''), refreshToken: String(patch.refreshToken || ''), endpoint: String(patch.endpoint || ''), updatedAt: Date.now() };
  const out = [next, ...list.filter(x => x.platform !== platform)];
  save(out);
  return next;
}
export function hasSecret(platform: string) {
  const item = listSecrets().find(x => x.platform === platform);
  return !!(item && (item.apiKey || item.accessToken || item.endpoint));
}
export function maskedSecret(value?: string) { const v = String(value || ''); return v ? `${v.slice(0,4)}••••${v.slice(-4)}` : ''; }
