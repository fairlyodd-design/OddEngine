import { oddApi } from "./odd";

export type FeedItem = {
  id: string;
  title: string;
  link: string;
  source?: string;
  publishedAt?: string;
  summary?: string;
};

export type WeatherSnapshot = {
  location: string;
  tempF: string;
  feelsLikeF: string;
  humidity: string;
  description: string;
  windMph: string;
  updatedAt: number;
};

function uid(prefix = "item") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export async function fetchUrlText(url: string, timeoutMs = 12000): Promise<string> {
  const api = oddApi();
  if (api?.fetchText) {
    const r = await api.fetchText({ url, timeoutMs, maxBytes: 1024 * 1024 * 2 });
    if (r?.ok && typeof r.text === "string") return r.text;
  }

  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);

  function isAbortError(err: any) {
    const name = String(err?.name || "");
    const msg = String(err?.message || err || "");
    const hay = (name + " " + msg).toLowerCase();
    return name === "AbortError" || hay.includes("aborted") || hay.includes("abort");
  }

  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err: any) {
    if (isAbortError(err)) {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw err;
  } finally {
    window.clearTimeout(t);
  }
}

export async function fetchUrlJson<T = any>(url: string, timeoutMs = 12000): Promise<T> {
  const text = await fetchUrlText(url, timeoutMs);
  return JSON.parse(text) as T;
}

function firstText(el: Element | null, selector: string) {
  return el?.querySelector(selector)?.textContent?.trim() || "";
}

function stripHtml(text: string) {
  const div = document.createElement("div");
  div.innerHTML = text || "";
  return div.textContent?.trim() || "";
}

export function parseRss(xml: string, source?: string): FeedItem[] {
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const items = Array.from(doc.querySelectorAll("item"));
    return items.slice(0, 12).map((item) => ({
      id: uid("feed"),
      title: firstText(item, "title"),
      link: firstText(item, "link"),
      source: source || firstText(item, "source") || firstText(doc.querySelector("channel"), "title"),
      publishedAt: firstText(item, "pubDate"),
      summary: stripHtml(firstText(item, "description")),
    })).filter((item) => item.title && item.link);
  } catch {
    return [];
  }
}

export async function fetchNewsFeed(url: string, source?: string) {
  const xml = await fetchUrlText(url);
  return parseRss(xml, source);
}

export async function fetchWeather(location: string) {
  const cacheKey = "oddengine:weather:last";
  const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;
  const tryOnce = async () => {
    const data = await fetchUrlJson<any>(url, 20000);
    const current = data?.current_condition?.[0] || {};
    const area = data?.nearest_area?.[0] || {};
    const snap = {
      location: area?.areaName?.[0]?.value || location,
      tempF: String(current?.temp_F ?? "?"),
      feelsLikeF: String(current?.FeelsLikeF ?? "?"),
      humidity: String(current?.humidity ?? "?"),
      description: current?.weatherDesc?.[0]?.value || "Unknown",
      windMph: String(current?.windspeedMiles ?? "?"),
      updatedAt: Date.now(),
    } satisfies WeatherSnapshot;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(snap));
    } catch {
      // ignore
    }
    return snap;
  };

  try {
    return await tryOnce();
  } catch (e1) {
    // quick retry (wttr can be flaky)
    try {
      return await tryOnce();
    } catch {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached) as WeatherSnapshot;
      } catch {
        // ignore
      }
      throw e1;
    }
  }
}

export async function fetchPubMed(term: string, limit = 5): Promise<FeedItem[]> {
  const search = await fetchUrlJson<any>(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${limit}&term=${encodeURIComponent(term)}`);
  const ids = (search?.esearchresult?.idlist || []).slice(0, limit);
  if (!ids.length) return [];
  const summary = await fetchUrlJson<any>(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`);
  return ids.map((id: string) => {
    const row = summary?.result?.[id] || {};
    return {
      id: `pubmed_${id}`,
      title: String(row?.title || `PubMed ${id}`),
      link: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      source: "PubMed",
      publishedAt: row?.pubdate || row?.sortpubdate || "",
      summary: Array.isArray(row?.authors) ? `${row.authors.slice(0, 4).map((a: any) => a.name).join(", ")}` : "",
    } satisfies FeedItem;
  });
}

export async function openExternalLink(url: string) {
  const api = oddApi();
  if (api?.openExternal) return api.openExternal(url);
  window.open(url, "_blank", "noopener,noreferrer");
  return { ok: true };
}

export const DEFAULT_NEWS_FEEDS = {
  local: { label: "Local", url: "https://news.google.com/rss/search?q=Las+Vegas&hl=en-US&gl=US&ceid=US:en" },
  world: { label: "World", url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en" },
  economics: { label: "Economics", url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en" },
};

export const TRUSTED_HEALTH_LINKS = [
  { label: "Johns Hopkins", url: "https://www.hopkinsmedicine.org/health" },
  { label: "MedlinePlus", url: "https://medlineplus.gov/" },
  { label: "Mayo Clinic", url: "https://www.mayoclinic.org/patient-care-and-health-information" },
  { label: "Cleveland Clinic", url: "https://my.clevelandclinic.org/health" },
  { label: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov/" },
];

export const DEFAULT_COUPON_LINKS = [
  { label: "Target weekly ad", url: "https://weeklyad.target.com/" },
  { label: "Walmart deals", url: "https://www.walmart.com/shop/deals" },
  { label: "Albertsons weekly ad", url: "https://local.albertsons.com/weeklyad" },
  { label: "Kroger weekly ad", url: "https://www.kroger.com/weeklyad" },
  { label: "Slickdeals grocery", url: "https://slickdeals.net/newsearch.php?q=grocery&searcharea=deals&searchin=first&rss=1" },
];
