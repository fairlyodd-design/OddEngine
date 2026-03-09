import React, { useEffect, useMemo, useState } from "react";
import { acknowledgePanelAction, getPanelActions, PANEL_ACTION_EVENT } from "../lib/brain";
import { loadJSON, saveJSON } from "../lib/storage";
import { DEFAULT_NEWS_FEEDS, FeedItem, WeatherSnapshot, fetchNewsFeed, fetchWeather, openExternalLink } from "../lib/webData";
import PluginMiniWidgets from "../components/PluginMiniWidgets";
import { UPGRADE_PACKS_EVENT, isUpgradePackInstalled } from "../lib/plugins";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import { addQuickEvent } from "../lib/calendarStore";

type NewsState = {
  briefingMode?: boolean;
  location: string;
  weather: WeatherSnapshot | null;
  feeds: Record<string, FeedItem[]>;
  topics: string;
  topicFeed: FeedItem[];
  bookmarks: FeedItem[];
  briefing: string;
  savedTopicPresets: string[];
  whyItMatters: string[];
  routeNote: string;
  lastUpdated?: number;
  lastError?: string;
};

const KEY = "oddengine:news:v1";
const defaultState: NewsState = {
  briefingMode: false,
  location: "Las Vegas",
  weather: null,
  feeds: { local: [], world: [], economics: [] },
  topics: "AI, markets, Las Vegas, family savings",
  topicFeed: [],
  bookmarks: [],
  briefing: "",
  savedTopicPresets: ["AI", "markets", "Las Vegas", "family savings"],
  whyItMatters: [],
  routeNote: "",
};

function computeImpact(feedSets: Record<string, FeedItem[]>, topicFeed: FeedItem[]) {
  const all = [...Object.values(feedSets).flat(), ...topicFeed];
  const joined = all.map((item) => `${item.title} ${item.summary || ""}`.toLowerCase());
  const hitCount = (terms: string[]) => joined.filter((line) => terms.some((term) => line.includes(term))).length;
  return {
    trading: hitCount(["market", "economy", "stocks", "fed", "inflation", "earnings", "tariff", "rates"]),
    budget: hitCount(["prices", "inflation", "housing", "rates", "jobs", "gas", "groceries"]),
    family: hitCount(["health", "storm", "school", "safety", "outbreak", "air quality"]),
    grow: hitCount(["weather", "heat", "humidity", "power", "water", "wind"]),
  };
}

function topicChips(text: string) {
  return text.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function inferPanelRoute(item: FeedItem) {
  const text = `${item.title} ${item.summary || ""}`.toLowerCase();
  if (["market", "stocks", "fed", "earnings", "economy", "rates", "inflation"].some((t) => text.includes(t))) return "Trading";
  if (["prices", "housing", "jobs", "gas", "grocer", "inflation"].some((t) => text.includes(t))) return "FamilyBudget";
  if (["health", "storm", "school", "safety", "outbreak", "family"].some((t) => text.includes(t))) return "FamilyHealth";
  if (["weather", "heat", "humidity", "power", "water"].some((t) => text.includes(t))) return "Grow";
  return "Brain";
}

function buildStoryReason(item: FeedItem) {
  const route = inferPanelRoute(item);
  const source = item.source || "headline lane";
  if (route === "Trading") return `${source} likely matters for sentiment, rates, or earnings expectations. Route this into Trading or Mission Control.`;
  if (route === "FamilyBudget") return `${source} looks relevant to cost pressure, bills, or savings planning. Route this into Budget or Grocery planning.`;
  if (route === "FamilyHealth") return `${source} may matter to household planning or care awareness. Route this into Family Health or Brain notes.`;
  if (route === "Grow") return `${source} may affect weather, power, or environment planning. Route this into Grow and Mission Control.`;
  return `${source} is broad context worth pinning in Brain if it affects multiple panels.`;
}

function buildWhyItMattersList(state: NewsState) {
  const leadStories = [state.feeds.local?.[0], state.feeds.economics?.[0], state.feeds.world?.[0], state.topicFeed?.[0]].filter(Boolean) as FeedItem[];
  return leadStories.slice(0, 4).map((item) => `${item.title} — ${buildStoryReason(item)}`);
}

function buildRouteNote(state: NewsState) {
  const top = state.feeds.economics?.[0] || state.feeds.local?.[0] || state.topicFeed?.[0];
  if (!top) return "No lead story yet. Refresh News to generate a route-ready note.";
  return `Route “${top.title}” into ${inferPanelRoute(top)} first, then pin the key takeaway in Brain.`;
}

export default function News({ onNavigate, onOpenHowTo }: { onNavigate?: (id: string) => void; onOpenHowTo?: () => void } = {}) {
  const [state, setState] = useState<NewsState>(() => ({ ...defaultState, ...loadJSON<NewsState>(KEY, defaultState) }));
  const [busy, setBusy] = useState(false);
  const [pluginTick, setPluginTick] = useState(0);
  const hasNewsPro = isUpgradePackInstalled("news-pro-pack");

  function persist(next: NewsState) {
    setState(next);
    saveJSON(KEY, next);
  }

  function buildBriefing(base = state) {
    const impact = computeImpact(base.feeds, base.topicFeed);
    const localLead = base.feeds.local[0]?.title || "No local lead story yet";
    const econLead = base.feeds.economics[0]?.title || "No economics lead story yet";
    const weatherLine = base.weather ? `Weather: ${base.weather.tempF}°F, ${base.weather.description}, wind ${base.weather.windMph} mph.` : "Weather pending.";
    const why = buildWhyItMattersList(base);
    const routeNote = buildRouteNote(base);
    const briefing = [
      `Morning brief for ${base.location}`,
      `Local lead: ${localLead}`,
      `Economics lead: ${econLead}`,
      `Impact radar → Trading ${impact.trading} • Budget ${impact.budget} • Family ${impact.family} • Grow ${impact.grow}`,
      weatherLine,
      routeNote,
      ...why.slice(0, 2).map((line) => `• ${line}`),
    ].join("\n");
    persist({ ...base, briefing, whyItMatters: why, routeNote, lastUpdated: Date.now() });
  }

  async function refreshAll(includeTopics = hasNewsPro) {
    setBusy(true);
    try {
      const topicQuery = topicChips(state.topics).slice(0, 4).join(" OR ");

      const tasks = [
        { label: "Weather", run: () => fetchWeather(state.location || "Las Vegas") },
        { label: "Local", run: () => fetchNewsFeed(DEFAULT_NEWS_FEEDS.local.url, DEFAULT_NEWS_FEEDS.local.label) },
        { label: "World", run: () => fetchNewsFeed(DEFAULT_NEWS_FEEDS.world.url, DEFAULT_NEWS_FEEDS.world.label) },
        { label: "Economics", run: () => fetchNewsFeed(DEFAULT_NEWS_FEEDS.economics.url, DEFAULT_NEWS_FEEDS.economics.label) },
        {
          label: "Topic Watch",
          run: () =>
            includeTopics && topicQuery
              ? fetchNewsFeed(
                  `https://news.google.com/rss/search?q=${encodeURIComponent(topicQuery)}&hl=en-US&gl=US&ceid=US:en`,
                  "Topic Watch",
                )
              : Promise.resolve([] as FeedItem[]),
        },
      ] as const;

      const results = await Promise.allSettled(tasks.map((t) => t.run()));

      const errors: string[] = [];
      const friendly = (label: string, reason: any) => {
        const msg = String(reason?.message || reason || "Unknown error");
        const lower = msg.toLowerCase();
        if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("aborted") || lower.includes("abort")) {
          return `${label} timed out`;
        }
        if (lower.includes("failed to fetch") || lower.includes("fetch failed")) {
          return `${label} fetch failed`;
        }
        return `${label}: ${msg}`;
      };

      const weather = results[0].status === "fulfilled" ? (results[0].value as any) : state.weather;
      const local = results[1].status === "fulfilled" ? (results[1].value as any) : state.feeds.local;
      const world = results[2].status === "fulfilled" ? (results[2].value as any) : state.feeds.world;
      const economics = results[3].status === "fulfilled" ? (results[3].value as any) : state.feeds.economics;
      const topicFeed = results[4].status === "fulfilled" ? (results[4].value as any) : state.topicFeed;

      results.forEach((res, idx) => {
        if (res.status === "rejected") errors.push(friendly(tasks[idx].label, res.reason));
      });

      const next = {
        ...state,
        weather,
        feeds: { local, world, economics },
        topicFeed,
        lastUpdated: Date.now(),
        lastError: errors.join(" • "),
      };
      persist(next);
      if (hasNewsPro) buildBriefing(next);
    } catch (e: any) {
      // Should be rare now (allSettled prevents hard-fail).
      persist({ ...state, lastError: e?.message || String(e), lastUpdated: Date.now() });
    } finally {
      setBusy(false);
    }
  }

  function bookmark(item: FeedItem) {
    if (!hasNewsPro) return;
    const bookmarks = [item, ...state.bookmarks.filter((entry) => entry.link !== item.link)].slice(0, 12);
    persist({ ...state, bookmarks, lastUpdated: Date.now() });
  }

  function saveCurrentTopics() {
    if (!hasNewsPro) return;
    const preset = topicChips(state.topics).join(", ");
    if (!preset) return;
    const savedTopicPresets = [preset, ...state.savedTopicPresets.filter((item) => item !== preset)].slice(0, 8);
    persist({ ...state, savedTopicPresets, lastUpdated: Date.now() });
  }

  function applyTopicPreset(preset: string) {
    persist({ ...state, topics: preset, lastUpdated: Date.now() });
  }

  function openRouteFor(item: FeedItem) {
    const panelId = inferPanelRoute(item);
    onNavigate?.(panelId);
  }

  function addStoryToCalendar(item: FeedItem) {
    const panelId = inferPanelRoute(item);
    const title = `News: ${item.title}`.slice(0, 110);
    addQuickEvent({ title, panelId, notes: item.link });
  }

  useEffect(() => {
    if (!state.lastUpdated) refreshAll();
  }, []);

  useEffect(() => {
    const pluginHandler = () => setPluginTick((v) => v + 1);
    window.addEventListener(UPGRADE_PACKS_EVENT, pluginHandler as EventListener);
    return () => window.removeEventListener(UPGRADE_PACKS_EVENT, pluginHandler as EventListener);
  }, []);

  useEffect(() => {
    const handler = () => {
      for (const action of getPanelActions("News")) {
        if (action.actionId === "news:refresh") refreshAll();
        if (action.actionId === "news:briefing") buildBriefing();
        if (action.actionId === "news:watch-topics") refreshAll(true);
        if (action.actionId === "news:why-it-matters") persist({ ...state, whyItMatters: buildWhyItMattersList(state), lastUpdated: Date.now() });
        if (action.actionId === "news:route-top-story") persist({ ...state, routeNote: buildRouteNote(state), lastUpdated: Date.now() });
        acknowledgePanelAction(action.id);
      }
    };
    handler();
    window.addEventListener(PANEL_ACTION_EVENT, handler as EventListener);
    return () => window.removeEventListener(PANEL_ACTION_EVENT, handler as EventListener);
  }, [state, hasNewsPro, pluginTick]);

  const sections = useMemo(() => ([{ key: "local", title: "Local" }, { key: "world", title: "World" }, { key: "economics", title: "Economics" }] as const), []);
  const impact = useMemo(() => computeImpact(state.feeds, state.topicFeed), [state.feeds, state.topicFeed]);
  const severeWeather = useMemo(() => {
    const desc = String(state.weather?.description || "").toLowerCase();
    return ["storm", "thunder", "snow", "extreme", "heavy", "warning", "high wind"].some((term) => desc.includes(term));
  }, [state.weather]);
  const leadStories = useMemo(() => [state.feeds.local?.[0], state.feeds.economics?.[0], state.feeds.world?.[0]].filter(Boolean) as FeedItem[], [state.feeds]);
  const priorityCards = useMemo(() => ([
    { title: "Trading lane", tone: impact.trading ? "warn" : "good", body: impact.trading ? "Macro and market chatter are elevated. Route the economics lead into Trading." : "No major market-heavy story cluster right now." },
    { title: "Budget lane", tone: impact.budget ? "warn" : "good", body: impact.budget ? "Price / rates / savings stories are active. Budget and Grocery deserve a pass." : "Budget pressure looks calmer from the current feed mix." },
    { title: "Family lane", tone: impact.family || severeWeather ? "warn" : "good", body: severeWeather ? "Weather risk is the top family-planning item right now." : impact.family ? "Family-health or safety headlines deserve a quick review." : "No obvious family-risk headline cluster right now." },
    { title: "Grow lane", tone: impact.grow || severeWeather ? "warn" : "good", body: impact.grow || severeWeather ? "Weather and utility context could matter to Grow operations." : "Grow-facing weather context looks mild." },
  ]), [impact, severeWeather]);

  return (
    <div className="page">
      <PanelHeader
        panelId="News"
        title="📰 News Desk"
        subtitle="Weather • local/world context • economics • route-ready notes"
        badges={[
          { label: state.lastUpdated ? `Updated ${new Date(state.lastUpdated).toLocaleTimeString()}` : "Needs refresh", tone: state.lastUpdated ? "good" : "warn" },
          { label: severeWeather ? "Weather risk" : "Weather calm", tone: severeWeather ? "warn" : "good" },
          { label: `Location: ${state.location || "—"}`, tone: "muted" },
          ...(hasNewsPro ? [{ label: `Bookmarks ${state.bookmarks.length}`, tone: "good" as const }] : []),
        ]}
        rightSlot={
          <ActionMenu
            items={[
              { label: busy ? "Refreshing…" : "Refresh news", onClick: () => refreshAll(), disabled: busy },
              ...(hasNewsPro ? [{ label: "Build briefing", onClick: () => buildBriefing(), disabled: busy }] : []),
              { label: state.briefingMode ? "Briefing mode: On" : "Briefing mode: Off", onClick: () => persist({ ...state, briefingMode: !state.briefingMode }), disabled: busy },
              { label: "Open Calendar", onClick: () => onNavigate?.("Calendar") },
              ...(onOpenHowTo ? [{ label: "How-To", onClick: () => onOpenHowTo?.() }] : []),
            ]}
          />
        }
      />

      <div className="card heroCard missionHero newsHeroCard">
        <div className="newsHeroTop">
          <div>
            <div className="small shellEyebrow">NEWS • WEATHER • WORLD • ECONOMICS</div>
            <div className="h">News Desk</div>
            <div className="sub">Refresh → skim → route the top story into Trading/Budget/Grow/Brain, then pin the takeaway.</div>
          </div>
          <div className="newsHeroStatus">
            <span className={`badge ${state.lastUpdated ? "good" : "warn"}`}>{state.lastUpdated ? `Updated ${new Date(state.lastUpdated).toLocaleTimeString()}` : "Needs refresh"}</span>
            <span className={`badge ${severeWeather ? "warn" : "good"}`}>{severeWeather ? "Weather risk" : "Weather calm"}</span>
            <span className="badge">Location {state.location || "—"}</span>
            {hasNewsPro && <span className="badge good">News Pro active</span>}
            {hasNewsPro && <span className="badge">{state.bookmarks.length} bookmarks</span>}
          </div>
        </div>

        <div className="newsHeroMetrics">
          <div className="card newsMetricCard">
            <div className="small shellEyebrow">LEAD ROUTE</div>
            <div className="newsMetricValue">{inferPanelRoute(leadStories?.[0] || ({ title: "" } as any))}</div>
            <div className="small">Best first lane for the current lead story.</div>
          </div>
          <div className="card newsMetricCard">
            <div className="small shellEyebrow">TRADING HEAT</div>
            <div className="newsMetricValue">{impact.trading}</div>
            <div className="small">Macro / rates / market-sensitive headlines right now.</div>
          </div>
          <div className="card newsMetricCard">
            <div className="small shellEyebrow">BUDGET PRESSURE</div>
            <div className="newsMetricValue">{impact.budget}</div>
            <div className="small">Stories that may matter to cost pressure and savings planning.</div>
          </div>
          <div className="card newsMetricCard">
            <div className="small shellEyebrow">WEATHER</div>
            <div className="newsMetricValue">{state.weather ? `${state.weather.tempF}°` : "—"}</div>
            <div className="small">{state.weather ? state.weather.description : "No weather snapshot yet."}</div>
          </div>
        </div>

        <div className="newsHeroControls row" style={{ marginTop: 12, gap: 10, flexWrap: "wrap" }}>
          <label className="field" style={{ flex: 1, minWidth: 220 }}>Weather location
            <input value={state.location} onChange={(e) => persist({ ...state, location: e.target.value })} placeholder="Las Vegas" />
          </label>
          <button onClick={() => refreshAll()} disabled={busy}>{busy ? "Refreshing…" : "Refresh news"}</button>
          {hasNewsPro && <button className="tabBtn active" onClick={() => buildBriefing()} disabled={busy}>Build briefing</button>}
          <button className={`tabBtn ${state.briefingMode ? "active" : ""}`} onClick={() => persist({ ...state, briefingMode: !state.briefingMode })} disabled={busy}>{state.briefingMode ? "Briefing mode: On" : "Briefing mode"}</button>
        </div>
        {state.lastError && <div className="small newsErrorLine">{state.lastError}</div>}
        {state.briefingMode && <div className="small newsModeHint">Briefing mode focuses the page on the mission note + key cards. Toggle it off to view full feeds.</div>}
      </div>

      <PluginMiniWidgets panelId="News" onNavigate={onNavigate} onOpenHowTo={onOpenHowTo} />

      <div className="grid2" style={{ alignItems: "start" }}>
        <PanelScheduleCard
          panelId="News"
          title="News schedule"
          subtitle="Quick-add: briefings + review windows."
          onNavigate={onNavigate}
          presets={[
            { label: "+ Morning brief", title: "Morning news brief", time: "08:20" },
            { label: "+ Midday skim", title: "Midday headlines skim", time: "12:10" },
            { label: "+ Evening wrap", title: "Evening news wrap", time: "18:30" },
          ]}
        />
        <div className="card softCard newsRadarCard">
          <div className="h">Impact radar</div>
          <div className="sub">How many headlines hit each lane.</div>
          <div className="newsRadarGrid">
            <div className={`newsRadarPill ${impact.trading ? "warn" : "good"}`}><span>Trading</span><strong>{impact.trading}</strong></div>
            <div className={`newsRadarPill ${impact.budget ? "warn" : "good"}`}><span>Budget</span><strong>{impact.budget}</strong></div>
            <div className={`newsRadarPill ${impact.family ? "warn" : "good"}`}><span>Family</span><strong>{impact.family}</strong></div>
            <div className={`newsRadarPill ${impact.grow ? "warn" : "good"}`}><span>Grow</span><strong>{impact.grow}</strong></div>
          </div>
          <div className="small newsRouteNote">{buildRouteNote(state)}</div>
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <button className="tabBtn" onClick={() => onNavigate?.(inferPanelRoute(leadStories?.[0] || ({ title: "" } as any)))}>Open suggested lane</button>
            <button className="tabBtn active" onClick={() => onNavigate?.("Calendar")}>Calendar</button>
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card softCard">
          <div className="h">Weather + priority</div>
          {state.weather ? (
            <div className="assistantStack" style={{ marginTop: 10 }}>
              <div className="timelineCard">
                <div style={{ fontWeight: 800 }}>{state.weather.location}</div>
                <div className="row" style={{ marginTop: 8, gap: 12, flexWrap: "wrap" }}>
                  <span className="badge good">{state.weather.tempF}°F</span>
                  <span className="badge">Feels {state.weather.feelsLikeF}°F</span>
                  <span className="badge">Humidity {state.weather.humidity}%</span>
                  <span className="badge">Wind {state.weather.windMph} mph</span>
                </div>
                <div className="small" style={{ marginTop: 8 }}>{state.weather.description}</div>
              </div>
              {priorityCards.slice(0, 2).map((card) => (
                <div key={card.title} className={`missionCard ${card.tone === "warn" ? "warn" : "good"}`}>
                  <div style={{ fontWeight: 800 }}>{card.title}</div>
                  <div className="small" style={{ marginTop: 6 }}>{card.body}</div>
                </div>
              ))}
            </div>
          ) : <div className="small" style={{ marginTop: 10 }}>No weather snapshot yet.</div>}
        </div>

        <div className="card softCard">
          <div className="h">Mission note</div>
          <div className="timelineCard" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
            {state.briefing || "Build a briefing after a refresh so Brain gets a route-ready morning summary."}
          </div>
          {hasNewsPro && (
            <>
              <div className="assistantSectionTitle" style={{ marginTop: 14 }}>Saved topic presets</div>
              <div className="assistantChipWrap" style={{ marginTop: 10 }}>
                {state.savedTopicPresets.map((preset) => (
                  <button key={preset} className="tabBtn" onClick={() => applyTopicPreset(preset)}>{preset}</button>
                ))}
                <button className="tabBtn active" onClick={saveCurrentTopics}>Save current topics</button>
              </div>
            </>
          )}
        </div>
      </div>

      {hasNewsPro && !state.briefingMode && (
        <div className="grid2">
          <div className="card softCard">
            <div className="h">News Pro watch topics</div>
            <label className="field" style={{ marginTop: 10 }}>Topics
              <input value={state.topics} onChange={(e) => persist({ ...state, topics: e.target.value })} placeholder="AI, markets, Las Vegas" />
            </label>
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={() => refreshAll(true)} disabled={busy}>Refresh topics</button>
              <button className="tabBtn" onClick={() => persist({ ...state, whyItMatters: buildWhyItMattersList(state), routeNote: buildRouteNote(state), lastUpdated: Date.now() })}>Why it matters</button>
            </div>
            <div className="assistantSectionTitle" style={{ marginTop: 14 }}>Route-ready note</div>
            <div className="timelineCard" style={{ marginTop: 10 }}>{state.routeNote || buildRouteNote(state)}</div>
          </div>
          <div className="card softCard">
            <div className="h">Impact radar</div>
            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              <span className={`badge ${impact.trading ? "warn" : "good"}`}>Trading {impact.trading}</span>
              <span className={`badge ${impact.budget ? "warn" : "good"}`}>Budget {impact.budget}</span>
              <span className={`badge ${impact.family ? "warn" : "good"}`}>Family {impact.family}</span>
              <span className={`badge ${impact.grow ? "warn" : "good"}`}>Grow {impact.grow}</span>
            </div>
            <div className="assistantStack" style={{ marginTop: 12 }}>
              {priorityCards.map((card) => (
                <div key={card.title} className={`timelineCard ${card.tone === "warn" ? "warn" : "good"}`}>
                  <div style={{ fontWeight: 800 }}>{card.title}</div>
                  <div className="small" style={{ marginTop: 6 }}>{card.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasNewsPro && !state.briefingMode && (
        <div className="grid2">
          <div className="card softCard">
            <div className="h">Why it matters</div>
            <div className="assistantStack" style={{ marginTop: 10 }}>
              {(state.whyItMatters.length ? state.whyItMatters : buildWhyItMattersList(state)).map((line, idx) => (
                <div key={idx} className="timelineCard">{line}</div>
              ))}
              {!leadStories.length && <div className="small">Refresh the feed to generate why-it-matters notes.</div>}
            </div>
          </div>
          <div className="card softCard">
            <div className="h">Bookmarks</div>
            <div className="assistantStack" style={{ marginTop: 10 }}>
              {state.bookmarks.map((item) => (
                <div key={item.id + item.link} className="timelineCard">
                  <div style={{ fontWeight: 800 }}>{item.title}</div>
                  <div className="small" style={{ marginTop: 6 }}>{buildStoryReason(item)}</div>
                  <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                    <button className="tabBtn" onClick={() => openExternalLink(item.link)}>Open</button>
                    <button className="tabBtn" onClick={() => addStoryToCalendar(item)}>+ Calendar</button>
                    <button className="tabBtn active" onClick={() => openRouteFor(item)}>Route panel</button>
                  </div>
                </div>
              ))}
              {!state.bookmarks.length && <div className="small">Bookmark any story that should flow into Brain, Trading, Budget, or Family planning.</div>}
            </div>
          </div>
        </div>
      )}

      {hasNewsPro && !state.briefingMode && !!state.topicFeed.length && (
        <div className="card softCard">
          <div className="h">Topic watch feed</div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {state.topicFeed.slice(0, 6).map((item) => (
              <div key={item.id} className="timelineCard newsStoryCard">
                <div className="small">{item.source || "Topic Watch"}{item.publishedAt ? ` • ${item.publishedAt}` : ""}</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{item.title}</div>
                {item.summary && <div className="small" style={{ marginTop: 6 }}>{item.summary.slice(0, 200)}{item.summary.length > 200 ? "…" : ""}</div>}
                <div className="small" style={{ marginTop: 6 }}>{buildStoryReason(item)}</div>
                <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                  <button className="tabBtn" onClick={() => openExternalLink(item.link)}>Open story</button>
                  <button className="tabBtn" onClick={() => addStoryToCalendar(item)}>+ Calendar</button>
                  <button className="tabBtn active" onClick={() => bookmark(item)}>Bookmark</button>
                  <button className="tabBtn" onClick={() => openRouteFor(item)}>Route panel</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!state.briefingMode && sections.map((section) => (
        <div key={section.key} className="card softCard">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div className="h">{section.title}</div>
              <div className="sub">Fresh headlines you can feed into Mission Control.</div>
            </div>
          </div>
          <div className="assistantStack" style={{ marginTop: 10 }}>
            {(state.feeds[section.key] || []).slice(0, 8).map((item) => (
              <div key={item.id} className="timelineCard newsStoryCard">
                <div className="small">{item.source || section.title}{item.publishedAt ? ` • ${item.publishedAt}` : ""}</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{item.title}</div>
                {item.summary && <div className="small" style={{ marginTop: 6 }}>{item.summary.slice(0, 220)}{item.summary.length > 220 ? "…" : ""}</div>}
                {hasNewsPro && <div className="small" style={{ marginTop: 6 }}>{buildStoryReason(item)}</div>}
                <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                  <button className="tabBtn" onClick={() => openExternalLink(item.link)}>Open story</button>
                  <button className="tabBtn" onClick={() => addStoryToCalendar(item)}>+ Calendar</button>
                  {hasNewsPro && <button className="tabBtn active" onClick={() => bookmark(item)}>Bookmark</button>}
                  {hasNewsPro && <button className="tabBtn" onClick={() => openRouteFor(item)}>Route panel</button>}
                </div>
              </div>
            ))}
            {!(state.feeds[section.key] || []).length && <div className="small">No stories loaded yet.</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
