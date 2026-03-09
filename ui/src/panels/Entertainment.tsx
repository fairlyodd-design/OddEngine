import React, { useMemo, useState } from "react";
import ActionMenu from "../components/ActionMenu";
import { PanelHeader } from "../components/PanelHeader";
import { loadJSON, saveJSON } from "../lib/storage";
import { isDesktop, oddApi } from "../lib/odd";
import { logActivity } from "../lib/brain";

type Service = {
  id: string;
  name: string;
  url: string;
  kind: "music" | "movie" | "video";
  openMode: "window" | "external";
};

type NowPlaying = {
  serviceId: string;
  startedAt: string;
  note: string;
};

type FamilyNightPreset = {
  serviceId: string;
  openMode: Service["openMode"];
};

const KEY = "oddengine:entertainment:v1";
const ENT_EVENT = "oddengine:entertainment-changed";

const DEFAULTS: Service[] = [
  { id: "spotify", name: "Spotify Web Player", url: "https://open.spotify.com/", kind: "music", openMode: "window" },
  { id: "ytmusic", name: "YouTube Music", url: "https://music.youtube.com/", kind: "music", openMode: "window" },
  { id: "youtube", name: "YouTube", url: "https://www.youtube.com/", kind: "video", openMode: "window" },
  // Many DRM streaming services may not play inside embedded webviews depending on platform codecs.
  // Default these to external so the user gets a working playback path.
  { id: "netflix", name: "Netflix", url: "https://www.netflix.com/", kind: "movie", openMode: "external" },
  { id: "prime", name: "Prime Video", url: "https://www.primevideo.com/", kind: "movie", openMode: "external" },
  { id: "disney", name: "Disney+", url: "https://www.disneyplus.com/", kind: "movie", openMode: "external" },
  { id: "hulu", name: "Hulu", url: "https://www.hulu.com/", kind: "movie", openMode: "external" },
];

function safeId(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function Entertainment() {
  const [state, setState] = useState<{ services: Service[]; favorites?: string[]; nowPlaying?: NowPlaying | null; familyNightPreset?: FamilyNightPreset | null }>(() =>
    loadJSON(KEY, { services: DEFAULTS, favorites: ["spotify", "youtube"], nowPlaying: null, familyNightPreset: null })
  );
  const [draft, setDraft] = useState<{ name: string; url: string; kind: Service["kind"]; openMode: Service["openMode"] }>({
    name: "",
    url: "",
    kind: "movie",
    openMode: "window",
  });

  // Kodi-style layout controls
  const [view, setView] = useState<"browse" | "manage">("browse");
  const [category, setCategory] = useState<"Movies" | "TV" | "Videos" | "Music" | "Favorites">("Movies");
  const [selectedId, setSelectedId] = useState<string>("spotify");
  const now = new Date();

  const services = useMemo(() => state.services || DEFAULTS, [state.services]);
  const favorites = useMemo(() => new Set((state.favorites || []) as string[]), [state.favorites]);
  const browseList = useMemo(() => {
    return services.filter((s) => {
      if (category === "Favorites") return favorites.has(s.id);
      if (category === "Music") return s.kind === "music";
      if (category === "Videos") return s.kind === "video";
      if (category === "Movies") return s.kind === "movie";
      if (category === "TV") return s.kind === "movie" || s.kind === "video";
      return true;
    });
  }, [services, favorites, category]);

  const selected = useMemo(() => {
    const hit = browseList.find((s) => s.id === selectedId);
    return hit || browseList[0] || null;
  }, [browseList, selectedId]);

  // Keep selection valid when category/list changes.
  React.useEffect(() => {
    if (!browseList.length) return;
    if (!browseList.some((s) => s.id === selectedId)) setSelectedId(browseList[0].id);
  }, [category, browseList, selectedId]);

  const nowPlaying = state.nowPlaying || null;
  const familyNightPreset = state.familyNightPreset || null;

  const persist = (next: { services: Service[]; favorites?: string[]; nowPlaying?: NowPlaying | null; familyNightPreset?: FamilyNightPreset | null }) => {
    setState(next);
    saveJSON(KEY, next);
    try {
      window.dispatchEvent(new CustomEvent(ENT_EVENT, { detail: { ts: Date.now() } }));
    } catch {
      // ignore
    }
  };

  const setFamilyNight = (enabled: boolean) => {
    window.dispatchEvent(new CustomEvent("oddengine:family-night", { detail: { enabled } }));
  };

  const openService = async (svc: Service) => {
    const api = oddApi();
    const url = svc.url;
    if (svc.openMode === "external") {
      // Best-effort: openExternal uses Electron shell when available.
      await api.openExternal?.(url);
      return;
    }
    // "window" mode: open a separate window (Electron BrowserWindow in desktop mode, popup in web mode).
    const title = `Entertainment — ${svc.name}`;
    if (isDesktop()) {
      // Dedicated player window remembers size/position across sessions.
      if (api.openEntertainmentPlayer) {
        const res = await api.openEntertainmentPlayer({ url, title, serviceId: svc.id });
        if (!res?.ok) {
          // If the player window fails for any reason, fall back to external.
          await api.openExternal?.(url);
          window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "warn", text: res?.error ? `Player window failed: ${res.error}` : "Player window failed. Opened external." } }));
        }
      } else {
        const res = await api.openWindow?.({ url, title, width: 1200, height: 760 });
        if (!res?.ok) {
          await api.openExternal?.(url);
          window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "warn", text: res?.error ? `Window failed: ${res.error}` : "Window failed. Opened external." } }));
        }
      }
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }

    const nextNP: NowPlaying = { serviceId: svc.id, startedAt: new Date().toISOString(), note: nowPlaying?.serviceId === svc.id ? (nowPlaying?.note || "") : "" };
    persist({ services, favorites: Array.from(favorites), nowPlaying: nextNP, familyNightPreset });

    try {
      logActivity({ kind: "visit", panelId: "Entertainment", title: `Now Playing — ${svc.name}`, body: `Opened ${svc.openMode} • ${svc.url}` });
    } catch {
      // ignore
    }
  };

  const toggleFavorite = (id: string) => {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persist({ services, favorites: Array.from(next), nowPlaying, familyNightPreset });
  };

  const updateNowPlayingNote = (note: string) => {
    if (!nowPlaying) return;
    persist({ services, favorites: Array.from(favorites), nowPlaying: { ...nowPlaying, note }, familyNightPreset });
  };

  const focusPlayer = async () => {
    const api = oddApi();
    const res = await api.focusEntertainmentPlayer?.();
    if (!res?.ok) {
      window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "warn", text: res?.error ? `Focus failed: ${res.error}` : "No player window found." } }));
      return;
    }
    if (!res.shown) {
      window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "info", text: "No player window open yet." } }));
    }
  };

  const openLast = async () => {
    const api = oddApi();
    if (!isDesktop()) {
      if (nowPlaying) {
        const svc = services.find((s) => s.id === nowPlaying.serviceId);
        if (svc) window.open(svc.url, "_blank", "noopener,noreferrer");
      }
      return;
    }
    const last = await api.getEntertainmentLast?.();
    const l = (last as any)?.last;
    if (l?.url) {
      await api.openEntertainmentPlayer?.({ url: String(l.url), title: String(l.title || "Entertainment Player") });
      return;
    }
    if (nowPlaying) {
      const svc = services.find((s) => s.id === nowPlaying.serviceId);
      if (svc) await openService(svc);
      else window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "info", text: "No last playback yet." } }));
    } else {
      window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "info", text: "No last playback yet." } }));
    }
  };

  const saveFamilyNightPreset = () => {
    const svcId = nowPlaying?.serviceId;
    if (!svcId) {
      window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "info", text: "Start something first (Now Playing), then save preset." } }));
      return;
    }
    const svc = services.find((s) => s.id === svcId);
    if (!svc) return;
    const preset: FamilyNightPreset = { serviceId: svc.id, openMode: svc.openMode };
    persist({ services, favorites: Array.from(favorites), nowPlaying, familyNightPreset: preset });
    window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind: "ok", text: `Saved Family Night preset: ${svc.name}` } }));
  };

  const runFamilyNight = async () => {
    // If a preset exists, use it. Otherwise: first favorite movie service, else first movie.
    const presetSvc = familyNightPreset ? services.find((s) => s.id === familyNightPreset.serviceId) : null;
    const favMovie = services.find((s) => s.kind === "movie" && favorites.has(s.id));
    const anyMovie = services.find((s) => s.kind === "movie");
    const svc = presetSvc || favMovie || anyMovie || services[0];
    if (!svc) return;
    setFamilyNight(true);
    await openService({ ...svc, openMode: svc.openMode === "external" ? "external" : "window" });
  };

  const toggleMode = (id: string) => {
    const next = services.map((svc) => (svc.id === id ? { ...svc, openMode: svc.openMode === "window" ? "external" : "window" } : svc));
    // If preset uses this service, keep it but update openMode.
    const preset = familyNightPreset && familyNightPreset.serviceId === id ? { ...familyNightPreset, openMode: next.find((s) => s.id === id)?.openMode || familyNightPreset.openMode } : familyNightPreset;
    persist({ services: next, favorites: Array.from(favorites), nowPlaying, familyNightPreset: preset });
  };

  const remove = (id: string) => {
    const next = services.filter((svc) => svc.id !== id);
    const favNext = new Set(favorites);
    favNext.delete(id);
    const npNext = nowPlaying && nowPlaying.serviceId === id ? null : nowPlaying;
    const presetNext = familyNightPreset && familyNightPreset.serviceId === id ? null : familyNightPreset;
    persist({ services: next, favorites: Array.from(favNext), nowPlaying: npNext, familyNightPreset: presetNext });
  };

  const add = () => {
    const name = draft.name.trim();
    const url = draft.url.trim();
    if (!name || !url) return;
    const id = safeId(name);
    const next: Service = { id, name, url, kind: draft.kind, openMode: draft.openMode };
    persist({ services: [next, ...services.filter((s) => s.id !== id)], favorites: Array.from(favorites), nowPlaying, familyNightPreset });
    setDraft({ name: "", url: "", kind: draft.kind, openMode: draft.openMode });
  };

  return (
    <div className="panelRoot">
      <PanelHeader
        panelId="Entertainment"
        title="Family Entertainment"
        subtitle="KODI-STYLE LAUNCHER • MOVIES • TV • MUSIC"
        storagePrefix="oddengine:entertainment"
      />

      <div className="creativeHeroBand entertainmentHeroBand">
        <div className="creativeHeroCard">
          <div className="small shellEyebrow">WORLD / ENTERTAINMENT</div>
          <div className="creativeHeroTitle">Family Entertainment Deck</div>
          <div className="creativeHeroSub">Launch music, movies, TV, and favorites from one living-room command surface.</div>
        </div>
        <div className="creativeMetricStrip">
          <div className="creativeMetricCard"><div className="small shellEyebrow">CATEGORY</div><div className="h">{category === "TV" ? "TV" : category}</div></div>
          <div className="creativeMetricCard"><div className="small shellEyebrow">ITEMS</div><div className="h">{browseList.length}</div></div>
          <div className="creativeMetricCard"><div className="small shellEyebrow">FAVORITES</div><div className="h">{favorites.size}</div></div>
          <div className="creativeMetricCard"><div className="small shellEyebrow">NOW PLAYING</div><div className="h">{nowPlaying ? (services.find((s) => s.id === nowPlaying.serviceId)?.name || "Live") : "Idle"}</div></div>
        </div>
      </div>

      <div className="entShell">
        <div className="entNav">
          <div className="entClock">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="entNavGroup">
            {(["Movies", "TV", "Videos", "Music", "Favorites"] as const).map((c) => (
              <button key={c} className={"entNavItem " + (category === c && view === "browse" ? "active" : "")} onClick={() => { setView("browse"); setCategory(c); }}>
                {c === "Movies" ? "🎬" : c === "TV" ? "📺" : c === "Videos" ? "▶️" : c === "Music" ? "🎵" : "★"} {c === "TV" ? "TV shows" : c}
              </button>
            ))}
          </div>
          <div className="entNavGroup mt-4">
            <button className={"entNavItem " + (view === "manage" ? "active" : "")} onClick={() => setView("manage")}>⚙️ Manage services</button>
            <button className="entNavItem" onClick={runFamilyNight}>✨ Family Night</button>
            <button className="entNavItem" onClick={() => setFamilyNight(false)}>🌙 Exit Family Night</button>
          </div>
        </div>

        <div className="entMain">
          {view === "browse" ? (
            <>
              <div className="entKodi">
                <div className="entDetail">
                  <div className="small" style={{ opacity: 0.85 }}>Selected</div>
                  <div className="entHeroTitle">{selected ? selected.name : (category === "TV" ? "TV shows" : category)}</div>
                  <div className="entHeroSub">
                    {selected ? (
                      <>Mode: <b>{selected.openMode === "window" ? "Window" : "External"}</b> • {selected.url}</>
                    ) : (
                      <>Add services in <b>Manage services</b> to build your family launcher.</>
                    )}
                  </div>

                  <div className="entPoster" aria-hidden="true">
                    <div className="entPosterBadge">{selected ? (selected.kind === "music" ? "🎵" : selected.kind === "movie" ? "🎬" : "▶️") : "🎬"}</div>
                    <div className="entPosterTitle">{category === "TV" ? "TV shows" : category}</div>
                  </div>

                  <div className="cluster wrap mt-4">
                    <button className="tabBtn" disabled={!selected} onClick={() => selected && openService(selected)}>Open</button>
                    <button className="tabBtn" disabled={!selected} onClick={() => selected && toggleFavorite(selected.id)}>{selected && favorites.has(selected.id) ? "★ Favorited" : "☆ Favorite"}</button>
                    <ActionMenu
                      label="Actions ▾"
                      title="More actions"
                      items={[
                        {
                          label: selected?.openMode === "window" ? "Open mode: Window" : "Open mode: External",
                          onClick: () => selected && toggleMode(selected.id),
                          disabled: !selected,
                        },
                        { label: "Focus player", onClick: focusPlayer },
                        { label: "Open last", onClick: openLast },
                        { label: "Save preset", onClick: saveFamilyNightPreset },
                      ]}
                    />
                  </div>

                  {nowPlaying && (
                    <div className="entNowMini mt-5">
                      <div className="entNowTitle">Now Playing</div>
                      <div style={{ fontWeight: 950 }}>{services.find((s) => s.id === nowPlaying.serviceId)?.name || nowPlaying.serviceId}</div>
                      <div className="small" style={{ opacity: 0.8 }}>Started {new Date(nowPlaying.startedAt).toLocaleString()}</div>
                      <div className="mt-3">
                        <input className="input" value={nowPlaying.note || ""} onChange={(e) => updateNowPlayingNote(e.target.value)} placeholder="Notes (episode, playlist, kid-friendly…)" />
                      </div>
                    </div>
                  )}

                  {familyNightPreset && (
                    <div className="small mt-4" style={{ opacity: 0.9 }}>
                      Family Night preset: <b>{services.find((s) => s.id === familyNightPreset.serviceId)?.name || familyNightPreset.serviceId}</b>
                    </div>
                  )}
                </div>

                <div className="entListPane">
                  <div className="cluster spread">
                    <div className="entRowTitle">{category === "TV" ? "TV shows" : category}</div>
                    <div className="small" style={{ opacity: 0.8 }}>{browseList.length} items</div>
                  </div>
                  {!browseList.length ? (
                    <div className="card mt-4">
                      <div className="sub">No items here yet. Add services in <b>Manage services</b>.</div>
                    </div>
                  ) : (
                    <div className="entList mt-4">
                      {browseList.map((svc) => (
                        <button
                          key={svc.id}
                          className={"entListItem " + (selected?.id === svc.id ? "active" : "")}
                          onClick={() => setSelectedId(svc.id)}
                          onDoubleClick={() => openService(svc)}
                          title="Double-click to open"
                        >
                          <span className="entListIcon">{svc.kind === "music" ? "🎵" : svc.kind === "movie" ? "🎬" : "▶️"}</span>
                          <span className="entListText">
                            <span className="entListName">{svc.name}</span>
                            <span className="entListSub">{svc.openMode === "window" ? "Window" : "External"}{favorites.has(svc.id) ? " • ★" : ""}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="entRowTitle mt-6">Quick tiles</div>
                  <div className="entRow">
                    {browseList.slice(0, 10).map((svc) => (
                      <div key={svc.id} className="entTile" onClick={() => openService(svc)} role="button" tabIndex={0}>
                        <div className="entTileArt">
                          <div className="entTileBadge">{svc.kind === "music" ? "🎵" : svc.kind === "movie" ? "🎬" : "▶️"}</div>
                          <div className="entTileBrand">{svc.name.split(" ").slice(0, 2).join(" ")}</div>
                        </div>
                        <div className="entTileMeta">
                          <div className="entTileName">{svc.name}</div>
                          <div className="entTileSub">Mode: {svc.openMode === "window" ? "Window" : "External"}</div>
                          <div className="entTileActions">
                            <button className="tabBtn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(svc.id); }} title="Favorite">{favorites.has(svc.id) ? "★" : "☆"}</button>
                            <button className="tabBtn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMode(svc.id); }} title="Toggle mode">{svc.openMode === "window" ? "🪟" : "↗"}</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="entManage">
              <div className="grid2" style={{ alignItems: "start" }}>
                <div className="card softCard">
                  <div className="h">Services</div>
                  <div className="sub">Keep your launchpad clean. Favorites show up as a category.</div>
                  <div className="stack mt-5">
                    {services.map((svc) => (
                      <div key={svc.id} className="cluster wrap spread">
                        <div style={{ minWidth: 240 }}>
                          <div className="h" style={{ fontSize: 16 }}>
                            {svc.kind === "music" ? "🎵" : svc.kind === "movie" ? "🎬" : "▶️"} {svc.name}
                            <button className={`btn ghost`} style={{ marginLeft: 8, padding: "4px 8px" }} onClick={() => toggleFavorite(svc.id)} title="Toggle favorite">{favorites.has(svc.id) ? "★" : "☆"}</button>
                          </div>
                          <div className="small" style={{ opacity: 0.8 }}>{svc.url}</div>
                        </div>
                        <div className="cluster wrap">
                          <button className="btn" onClick={() => openService(svc)}>Open</button>
                          <button className="btn ghost" onClick={() => toggleMode(svc.id)}>Mode: {svc.openMode === "window" ? "Window" : "External"}</button>
                          <button className="btn ghost" onClick={() => remove(svc.id)}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card softCard">
                  <div className="h">Add a service</div>
                  <div className="sub">Drop in any streaming URL (music, movies, sports, etc.).</div>
                  <div className="stack mt-5">
                    <label className="small">Name</label>
                    <input className="input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g., Apple Music" />
                    <label className="small">URL</label>
                    <input className="input" value={draft.url} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} placeholder="https://..." />
                    <div className="cluster wrap">
                      <button className={`btn ${draft.kind === "music" ? "" : "ghost"}`} onClick={() => setDraft((d) => ({ ...d, kind: "music" }))}>Music</button>
                      <button className={`btn ${draft.kind === "movie" ? "" : "ghost"}`} onClick={() => setDraft((d) => ({ ...d, kind: "movie" }))}>Movies</button>
                      <button className={`btn ${draft.kind === "video" ? "" : "ghost"}`} onClick={() => setDraft((d) => ({ ...d, kind: "video" }))}>Video</button>
                    </div>
                    <div className="cluster wrap">
                      <button className={`btn ${draft.openMode === "window" ? "" : "ghost"}`} onClick={() => setDraft((d) => ({ ...d, openMode: "window" }))}>Open in window</button>
                      <button className={`btn ${draft.openMode === "external" ? "" : "ghost"}`} onClick={() => setDraft((d) => ({ ...d, openMode: "external" }))}>Open external</button>
                    </div>
                    <button className="btn" onClick={add}>Add service</button>
                    <div className="note mt-4">
                      <b>Heads-up:</b> DRM services may not play inside embedded windows depending on platform codecs. If it fails, switch to <b>External</b>.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
