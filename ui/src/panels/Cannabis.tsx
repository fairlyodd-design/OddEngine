import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { pushNotif } from "../lib/notifs";
import { isDesktop, oddApi } from "../lib/odd";
import { loadPrefs } from "../lib/prefs";
import { scoreDealBestOverall } from "../lib/dealScore";
import { PanelHeader } from "../components/PanelHeader";

type Coords = { lat: number; lon: number };

type Fav = {
  id: string;
  name: string;
  url: string;
  address?: string;
  category?: string;
  priceTier?: string;
  tags?: string[];
  notes?: string;
  coords?: Coords;
  createdAt: number;
};

type Deal = {
  id: string;
  text: string;
  sourceUrl?: string;
  store?: string;
  category?: string;
  priceTier?: string;
  tags?: string[];
  score: number;
  breakdown: { value: number; clarity: number; restrictions: number; timeframe: number };
  signals: { value: string[]; restrictions: string[]; timeframe: string[]; clarity: string[] };
  createdAt: number;
};

type Note = { id: string; title: string; body: string; createdAt: number };

type Filters = {
  q: string;
  categories: string[];
  tiers: string[];
  minScore: number;
};

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

type State = {
  zip: string;
  categories: string[];
  priceTiers: string[];
  favorites: Fav[];
  deals: Deal[];
  notes: Note[];
  filters: Filters;
};

const KEY_V3 = "oddengine:cannabis:v3";
const KEY_V2 = "oddengine:cannabis:v2";


const VEGAS_FEATURED_DEALS = [
  {
    id: "planet13",
    name: "Planet 13 Las Vegas",
    area: "Las Vegas",
    notes: "$180 1/2oz Best in Vegas Tier Flower, plus rotating preroll / edible / vape promos.",
    url: "https://www.planet13lasvegas.com/deals/",
    tags: ["daily deals", "flower", "prerolls", "vapes"]
  },
  {
    id: "dispnv",
    name: "The Dispensary NV",
    area: "Las Vegas / Henderson",
    notes: "$89 and $99 ounce mix-and-match deals, members-only cart promos, plus first/second/third-visit discounts.",
    url: "https://thedispensarynv.com/",
    tags: ["ounce deals", "rewards", "new customer"]
  },
  {
    id: "nuwu",
    name: "NuWu",
    area: "Downtown Las Vegas",
    notes: "Secret Menu / loyalty specials, plus event-night penny promos and lounge offers.",
    url: "https://nuwu.vegas/news/",
    tags: ["lounge", "specials", "community"]
  },
  {
    id: "reef",
    name: "REEF / Curaleaf Las Vegas",
    area: "Las Vegas Strip",
    notes: "Online-order specials and value flower lanes that work well for comparison shopping.",
    url: "https://reefdispensaries.com/locations/las-vegas/order-now/",
    tags: ["pickup", "delivery", "flower value"]
  }
] as const;

const VEGAS_COMMUNITY_EVENTS = [
  {
    id: "tokin-trivia",
    title: "Tokin Trivia",
    when: "Mar 10, 2026 · 8:00 PM",
    venue: "NuWu Sky High Lounge",
    url: "https://nuwu.vegas/events/",
    tags: ["community", "games", "lounge"]
  },
  {
    id: "comedy-club",
    title: "NuWu Comedy Club",
    when: "Fridays · 8:30 PM",
    venue: "NuWu Sky High Lounge",
    url: "https://nuwu.vegas/events/?category=comedy",
    tags: ["comedy", "nightlife", "community"]
  },
  {
    id: "sunday-fundays",
    title: "Sunday Fundays",
    when: "Sundays · 12:00 PM–7:00 PM",
    venue: "NuWu Courtyard",
    url: "https://nuwu.vegas/events/events/sunday-fundays-2026-03-15/",
    tags: ["outdoor", "music", "weekly"]
  },
  {
    id: "paint-puff",
    title: "Paint & Puff",
    when: "Mar 21, 2026 · 6:00 PM–8:00 PM",
    venue: "NuWu Sky High Lounge",
    url: "https://nuwu.vegas/events/paint-and-puff-with-adrian-tom-off-the-rez-designs-las-vegas/",
    tags: ["art", "community", "special event"]
  },
  {
    id: "ladies-night",
    title: "Ladies Night",
    when: "Mar 26, 2026 · 8:00 PM–11:00 PM",
    venue: "NuWu Sky High Lounge",
    url: "https://nuwu.vegas/events/ladies-night-2026-03-26/",
    tags: ["specials", "nightlife", "event deals"]
  },
  {
    id: "mjbizcon",
    title: "MJBizCon 2026",
    when: "Dec 1–4, 2026",
    venue: "Las Vegas Convention Center",
    url: "https://mjbizconference.com/",
    tags: ["industry", "expo", "community"]
  }
] as const;

type LiveTrackerItem = {
  id: string;
  name: string;
  lane: string;
  notes: string;
  url: string;
  strength: number;
  tags: string[];
};

const VEGAS_LIVE_TRACKER: LiveTrackerItem[] = [
  {
    id: "planet13-live",
    name: "Planet 13 Las Vegas",
    lane: "Menu + specials",
    notes: "Live menu/specials lane with rotating flower, preroll, edible, and vape promos.",
    url: "https://www.planet13lasvegas.com/deals/",
    strength: 88,
    tags: ["daily specials", "menu", "tourist-friendly"]
  },
  {
    id: "dispnv-live",
    name: "The Dispensary NV",
    lane: "Daily menu deals",
    notes: "Strong daily deal rhythm with ounce lanes, vape/carts promos, and new-customer discount stack.",
    url: "https://thedispensarynv.com/shop-eastern/",
    strength: 91,
    tags: ["locals value", "daily deals", "rewards"]
  },
  {
    id: "nuwu-live",
    name: "NuWu",
    lane: "Events + secret menu",
    notes: "Best blend of specials, lounge/community energy, and event-night promo traffic.",
    url: "https://nuwu.vegas/news/",
    strength: 83,
    tags: ["community", "lounge", "events"]
  },
  {
    id: "reef-live",
    name: "REEF / Curaleaf",
    lane: "Value compare",
    notes: "Useful Strip-adjacent comparison lane when you want a quick online-order value check.",
    url: "https://reefdispensaries.com/locations/las-vegas/order-now/",
    strength: 76,
    tags: ["pickup", "online order", "value"]
  }
] as const;

function strengthLabel(score: number){
  if(score >= 88) return "🔥 strongest";
  if(score >= 80) return "⚡ hot lane";
  if(score >= 70) return "👀 watch lane";
  return "steady";
}


function uid(){
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function openUrl(url: string){
  try{ window.open(url, "_blank", "noopener,noreferrer"); }catch(e){}
}

function googleQuery(q: string){
  return "https://www.google.com/search?q=" + encodeURIComponent(q);
}

function scoreBadge(score: number){
  if(score >= 80) return "good";
  if(score >= 60) return "warn";
  return "bad";
}

function osmEmbedUrl(coords: Coords, zoomDelta = 0.015){
  const { lat, lon } = coords;
  const left = lon - zoomDelta;
  const right = lon + zoomDelta;
  const top = lat + zoomDelta;
  const bottom = lat - zoomDelta;
  const bbox = `${left}%2C${bottom}%2C${right}%2C${top}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
}

async function geocode(address: string): Promise<Coords | null>{
  const q = address.trim();
  if(!q) return null;
  try{
    const url = "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(q);
    const res = await fetch(url, { headers: { "Accept":"application/json" } });
    if(!res.ok) return null;
    const data:any[] = await res.json();
    if(!data?.length) return null;
    const lat = Number(data[0].lat);
    const lon = Number(data[0].lon);
    if(!isFinite(lat) || !isFinite(lon)) return null;
    return { lat, lon };
  }catch{
    return null;
  }
}

function migrateFromV2(): State | null {
  try{
    const raw:any = loadJSON(KEY_V2, null as any);
    if(!raw) return null;
    const prefs = loadPrefs();
    return {
      zip: String(raw.zip || prefs.cannabis.zip || ""),
      categories: prefs.cannabis.categories || [],
      priceTiers: prefs.cannabis.priceTiers || [],
      favorites: Array.isArray(raw.favorites) ? raw.favorites.map((f:any) => ({
        id: uid(),
        name: String(f.name || "Saved link"),
        url: String(f.url || ""),
        notes: f.notes ? String(f.notes) : "",
        createdAt: Date.now()
      })) : [],
      deals: [],
      notes: Array.isArray(raw.notes) ? raw.notes.map((n:any) => ({
        id: uid(),
        title: String(n.title || "Note"),
        body: String(n.body || ""),
        createdAt: Number(n.createdAt || Date.now())
      })) : [],
      filters: { q:"", categories:[], tiers:[], minScore: prefs.cannabis.minDealScore ?? 60 }
    };
  }catch{
    return null;
  }
}

function defaultState(): State{
  const prefs = loadPrefs();
  return {
    zip: prefs.cannabis.zip || "",
    categories: prefs.cannabis.categories || [],
    priceTiers: prefs.cannabis.priceTiers || [],
    favorites: [],
    deals: [],
    notes: [],
    filters: { q:"", categories:[], tiers:[], minScore: prefs.cannabis.minDealScore ?? 60 }
  };
}

export default function Cannabis(){
  const desktop = isDesktop();

  const [tab, setTab] = useState<"discover"|"deals"|"favorites"|"map"|"notes"|"assistant"|"settings">("discover");
  const [state, setState] = useState<State>(() => {
    const v3:any = loadJSON(KEY_V3, null as any);
    if(v3) return { ...defaultState(), ...v3, filters: { ...defaultState().filters, ...(v3.filters||{}) } } as State;
    const migrated = migrateFromV2();
    return migrated || defaultState();
  });

  // Persist
  useEffect(() => {
    saveJSON(KEY_V3, state);
  }, [state]);

  const services = useMemo(() => ([
    { id:"weedmaps", label:"Weedmaps", hint:"Directory / menus (opens browser)", q:(zip:string)=>`Weedmaps dispensary near ${zip}` },
    { id:"leafly", label:"Leafly", hint:"Strains + shops (opens browser)", q:(zip:string)=>`Leafly dispensary near ${zip}` },
    { id:"dutchie", label:"Dutchie", hint:"Menus (opens browser)", q:(zip:string)=>`Dutchie menu near ${zip}` },
    { id:"eaze", label:"Eaze", hint:"Delivery (opens browser)", q:(zip:string)=>`Eaze near ${zip}` },
    { id:"allbud", label:"AllBud", hint:"Strain info (opens browser)", q:(zip:string)=>`AllBud strains for ${zip}` },
  ]), []);

  // Filters
  const filteredDeals = useMemo(() => {
    const q = state.filters.q.trim().toLowerCase();
    return state.deals
      .filter(d => d.score >= (state.filters.minScore || 0))
      .filter(d => !state.filters.categories.length || (d.category && state.filters.categories.includes(d.category)))
      .filter(d => !state.filters.tiers.length || (d.priceTier && state.filters.tiers.includes(d.priceTier)))
      .filter(d => !q || [d.text, d.store||"", d.category||"", (d.tags||[]).join(" ")].join(" ").toLowerCase().includes(q))
      .sort((a,b) => b.createdAt - a.createdAt);
  }, [state.deals, state.filters]);

  const filteredFavs = useMemo(() => {
    const q = state.filters.q.trim().toLowerCase();
    return state.favorites
      .filter(f => !state.filters.categories.length || (f.category && state.filters.categories.includes(f.category)))
      .filter(f => !state.filters.tiers.length || (f.priceTier && state.filters.tiers.includes(f.priceTier)))
      .filter(f => !q || [f.name, f.url, f.address||"", f.category||"", (f.tags||[]).join(" ")].join(" ").toLowerCase().includes(q))
      .sort((a,b) => b.createdAt - a.createdAt);
  }, [state.favorites, state.filters]);

  const topDeal = useMemo(() => [...state.deals].sort((a,b) => b.score - a.score)[0] || null, [state.deals]);
  const mappedFavorites = useMemo(() => state.favorites.filter(f => !!f.coords).length, [state.favorites]);
  const savedVegasLinks = useMemo(() => state.favorites.filter(f => [f.url, f.name, f.address||""].join(" ").toLowerCase().includes("vegas") || [f.url, f.name].join(" ").toLowerCase().includes("planet 13") || [f.url, f.name].join(" ").toLowerCase().includes("nuwu")).length, [state.favorites]);
  const activeTabLabel = useMemo(() => {
    switch(tab){
      case "discover": return "Discovery";
      case "deals": return "Deal Lab";
      case "favorites": return "Favorites";
      case "map": return "Map";
      case "notes": return "Notes";
      case "assistant": return "Ask Homie";
      case "settings": return "Settings";
      default: return "Workspace";
    }
  }, [tab]);

  // Deal draft
  const [dealText, setDealText] = useState("");
  const [dealStore, setDealStore] = useState("");
  const [dealUrl, setDealUrl] = useState("");
  const [dealCategory, setDealCategory] = useState<string>("");
  const [dealTier, setDealTier] = useState<string>("");
  const [dealTags, setDealTags] = useState<string>("");

  const draftScore = useMemo(() => scoreDealBestOverall(dealText), [dealText]);

  function addDeal(){
    const text = dealText.trim();
    if(!text){
      pushNotif({ kind:"Error", title:"Paste a deal", detail:"Add the deal text first." });
      return;
    }
    const d: Deal = {
      id: uid(),
      text,
      sourceUrl: dealUrl.trim() || undefined,
      store: dealStore.trim() || undefined,
      category: dealCategory || undefined,
      priceTier: dealTier || undefined,
      tags: dealTags.split(",").map(s=>s.trim()).filter(Boolean),
      score: draftScore.score,
      breakdown: draftScore.breakdown,
      signals: {
        value: draftScore.valueSignals,
        restrictions: draftScore.restrictionSignals,
        timeframe: draftScore.timeframeSignals,
        clarity: draftScore.claritySignals
      },
      createdAt: Date.now()
    };
    setState(s => ({ ...s, deals: [d, ...s.deals] }));
    setDealText("");
    setDealStore("");
    setDealUrl("");
    setDealCategory("");
    setDealTier("");
    setDealTags("");
    pushNotif({ kind:"Persona", title:"Saved deal", detail:`Score ${d.score}/100` });
  }

  function deleteDeal(id: string){
    setState(s => ({ ...s, deals: s.deals.filter(d => d.id !== id) }));
  }

  function dealToNote(d: Deal){
    const title = `Deal — ${d.store || d.category || "Saved"}`;
    const body = [
      `Score: ${d.score}/100`,
      `Value: ${Math.round(d.breakdown.value)}  Clarity: ${Math.round(d.breakdown.clarity)}  Restrictions: ${Math.round(d.breakdown.restrictions)}  Timeframe: ${Math.round(d.breakdown.timeframe)}`,
      d.sourceUrl ? `Source: ${d.sourceUrl}` : "",
      "",
      d.text
    ].filter(Boolean).join("\n");
    const n: Note = { id: uid(), title, body, createdAt: Date.now() };
    setState(s => ({ ...s, notes: [n, ...s.notes] }));
    pushNotif({ kind:"Vault", title:"Saved to Notes", detail:title });
  }

  function copy(text: string){
    try{ navigator.clipboard.writeText(text); pushNotif({ kind:"Workspace", title:"Copied", detail:"Copied to clipboard." }); }catch(e){}
  }

  // Favorites
  const [favName, setFavName] = useState("");
  const [favUrl, setFavUrl] = useState("");
  const [favAddr, setFavAddr] = useState("");
  const [favCat, setFavCat] = useState("");
  const [favTier, setFavTier] = useState("");
  const [favTags, setFavTags] = useState("");

  function addFav(){
    const name = favName.trim();
    const url = favUrl.trim();
    if(!name || !url){
      pushNotif({ kind:"Error", title:"Missing fields", detail:"Name + URL are required." });
      return;
    }
    const f: Fav = {
      id: uid(),
      name,
      url,
      address: favAddr.trim() || undefined,
      category: favCat || undefined,
      priceTier: favTier || undefined,
      tags: favTags.split(",").map(s=>s.trim()).filter(Boolean),
      createdAt: Date.now()
    };
    setState(s => ({ ...s, favorites: [f, ...s.favorites] }));
    setFavName(""); setFavUrl(""); setFavAddr(""); setFavCat(""); setFavTier(""); setFavTags("");
    pushNotif({ kind:"Vault", title:"Saved", detail:"Favorite added." });
  }

  function deleteFav(id: string){
    setState(s => ({...s, favorites: s.favorites.filter(f => f.id !== id)}));
  }

  const [selectedFavId, setSelectedFavId] = useState<string | null>(null);
  const selectedFav = useMemo(() => state.favorites.find(f => f.id === selectedFavId) || state.favorites[0] || null, [state.favorites, selectedFavId]);

  async function lookupCoords(){
    if(!selectedFav) return;
    const addr = (selectedFav.address || "").trim();
    if(!addr){
      pushNotif({ kind:"Error", title:"Missing address", detail:"Add an address for this favorite first." });
      return;
    }
    pushNotif({ kind:"Workspace", title:"Looking up coords", detail:"Using OpenStreetMap geocoding…" });
    const coords = await geocode(addr);
    if(!coords){
      pushNotif({ kind:"Error", title:"Not found", detail:"Could not geocode that address." });
      return;
    }
    setState(s => ({
      ...s,
      favorites: s.favorites.map(f => f.id === selectedFav.id ? { ...f, coords } : f)
    }));
    pushNotif({ kind:"Workspace", title:"Pinned on map", detail:`${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}` });
  }

  // Notes
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  function addNote(){
    const title = noteTitle.trim() || "Note";
    const body = noteBody.trim();
    if(!body){
      pushNotif({ kind:"Error", title:"Empty note", detail:"Type something first." });
      return;
    }
    const n: Note = { id: uid(), title, body, createdAt: Date.now() };
    setState(s => ({ ...s, notes: [n, ...s.notes] }));
    setNoteTitle("");
    setNoteBody("");
    pushNotif({ kind:"Vault", title:"Saved", detail:title });
  }

  function deleteNote(id: string){
    setState(s => ({...s, notes: s.notes.filter(n => n.id !== id)}));
  }

  // Assistant (Desktop-only Homie)
  const [chat, setChat] = useState<ChatMsg[]>(() => ([
    { role:"system", content:
      "You are Homie👊 inside the Cannabis panel.\n" +
      "Rules:\n" +
      "1) You do NOT browse the web or fetch live menus/prices/deals.\n" +
      "2) You CAN help evaluate, compare, and organize deal text the user pasted/saved locally.\n" +
      "3) Focus on 'best overall': value + clarity + fewer restrictions.\n" +
      "4) Keep it practical, short, and respectful."
    }
  ]));
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chat.length]);

  async function send(){
    const msg = input.trim();
    if(!msg) return;
    setInput("");
    const context = {
      zip: state.zip,
      savedDeals: state.deals.slice(0, 8).map(d => ({
        score: d.score,
        store: d.store,
        category: d.category,
        priceTier: d.priceTier,
        tags: d.tags,
        text: d.text.slice(0, 700)
      }))
    };

    const userMsg: ChatMsg = { role:"user", content: msg + "\n\n(Local context: " + JSON.stringify(context) + ")" };
    const next = [...chat, userMsg];
    setChat(next);

    if(!desktop){
      setChat(c => [...c, { role:"assistant", content:"Homie AI runs in Desktop mode (local). For now: use the built-in Deal Scoring + filters." }]);
      return;
    }

    const res = await oddApi.homieChat({ messages: next });
    if(res?.ok && res.reply){
      setChat(c => [...c, { role:"assistant", content: res.reply || "" }]);
    }else{
      setChat(c => [...c, { role:"assistant", content: res?.error || "Homie is not available. (Check Dev Engine → Homie Health.)" }]);
    }
  }



  function saveFeaturedLink(name: string, url: string, category = "Deals", notes = ""){
    const f: Fav = {
      id: uid(),
      name,
      url,
      category,
      notes,
      address: category === "Event" ? "Las Vegas, NV" : undefined,
      tags: ["vegas", "curated"],
      createdAt: Date.now()
    };
    setState(st => ({ ...st, favorites: [f, ...st.favorites] }));
    pushNotif({ kind:"Vault", title:"Saved", detail:`${name} added to Favorites.` });
  }

  function askRankDeals(){
    setTab("assistant");
    setInput("Rank my saved deals and tell me which 1–2 are best overall and why.");
  }

  // Sync default categories/tiers from Preferences if state lists are empty (first run)
  useEffect(() => {
    if((state.categories?.length || 0) === 0 || (state.priceTiers?.length || 0) === 0){
      const prefs = loadPrefs();
      setState(s => ({
        ...s,
        categories: (s.categories?.length ? s.categories : prefs.cannabis.categories),
        priceTiers: (s.priceTiers?.length ? s.priceTiers : prefs.cannabis.priceTiers),
        filters: { ...s.filters, minScore: s.filters.minScore ?? prefs.cannabis.minDealScore }
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setZip(zip: string){
    setState(s => ({...s, zip}));
  }

  function setFilters(patch: Partial<Filters>){
    setState(s => ({...s, filters: { ...s.filters, ...patch }}));
  }

  function toggleFilterList(kind: "categories"|"tiers", value: string){
    setState(s => {
      const arr = kind === "categories" ? s.filters.categories : s.filters.tiers;
      const next = arr.includes(value) ? arr.filter(x=>x!==value) : [...arr, value];
      return { ...s, filters: { ...s.filters, [kind]: next } as any };
    });
  }

  return (
    <div className="page cannabisPanelRoot">
      <div className="card cannabisHeroCard">
        <PanelHeader panelId="Cannabis" title="Cannabis" storagePrefix="oddengine:cannabis" />

        <div className="row wrap" style={{gap:8, marginTop:10}}>
          <button className="tabBtn" onClick={() => setZip("89121")}>Use Vegas 89121</button>
          <button className="tabBtn" onClick={() => openUrl(googleQuery(`best cannabis deals Las Vegas ${state.zip || "89121"}`))}>Open Vegas deal search</button>
          <button className="tabBtn" onClick={() => openUrl(googleQuery(`cannabis community events Las Vegas March 2026`))}>Open community event search</button>
        </div>

        <div className="cannabisHeroTop" style={{marginTop: 10}}>
          <div>
            <div className="small shellEyebrow">CANNABIS OPS</div>
            <div className="cannabisHeroTitle">Cannabis Command Center</div>
            <div className="sub cannabisHeroSub">Track live Vegas deal lanes, menus, community events, favorites, notes, and Homie guidance in one clean local workspace.</div>
          </div>
          <div className="row wrap cannabisHeroBadges" style={{justifyContent:"flex-end"}}>
            <span className="badge">ZIP {state.zip || "Not set"}</span>
            <span className={`badge ${topDeal ? scoreBadge(topDeal.score) : "warn"}`}>{topDeal ? `Top deal ${topDeal.score}/100` : "No deals scored yet"}</span>
            <span className="badge">Mapped {mappedFavorites}</span>
            <span className="badge">Mode {activeTabLabel}</span>
          </div>
        </div>

        <div className="cannabisMetricStrip">
          <div className="card cannabisMetricCard">
            <div className="small shellEyebrow">SAVED DEALS</div>
            <div className="cannabisMetricValue">{state.deals.length}</div>
            <div className="small">Best overall deal lab for pasted menus and promos.</div>
          </div>
          <div className="card cannabisMetricCard">
            <div className="small shellEyebrow">FAVORITES</div>
            <div className="cannabisMetricValue">{state.favorites.length}</div>
            <div className="small">Saved shops, info links, and routing shortcuts.</div>
          </div>
          <div className="card cannabisMetricCard">
            <div className="small shellEyebrow">NOTES</div>
            <div className="cannabisMetricValue">{state.notes.length}</div>
            <div className="small">Keeper notes, restrictions, and shopping reminders.</div>
          </div>
          <div className="card cannabisMetricCard">
            <div className="small shellEyebrow">MAP READY</div>
            <div className="cannabisMetricValue">{mappedFavorites}</div>
            <div className="small">Favorites already pinned with coordinates.</div>
          </div>
          <div className="card cannabisMetricCard">
            <div className="small shellEyebrow">VEGAS LINKS</div>
            <div className="cannabisMetricValue">{savedVegasLinks}</div>
            <div className="small">Curated deals, events, and community links saved locally.</div>
          </div>
        </div>

        <div className="row" style={{gap:8, flexWrap:"wrap", marginTop:14}}>
          {[
            ["discover","Discover"],
            ["deals","Deals"],
            ["favorites","Favorites"],
            ["map","Map"],
            ["notes","Notes"],
            ["assistant","Ask Homie"],
            ["settings","Settings"]
          ].map(([id,label]) => (
            <button key={id} className={"tabBtn " + (tab===id ? "active" : "")} onClick={() => setTab(id as any)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Shared Filters (Deals + Favorites) */}
      {(tab==="deals" || tab==="favorites" || tab==="map") && (
        <div className="card cannabisSectionCard">
          <div className="row" style={{gap:10, flexWrap:"wrap", alignItems:"center"}}>
            <input style={{minWidth:220, flex:1}} value={state.filters.q} onChange={e => setFilters({ q: e.target.value })} placeholder="Search saved items…" />
            <div className="row" style={{gap:8, alignItems:"center"}}>
              <div className="sub">Min score</div>
              <input type="number" style={{width:90}} value={state.filters.minScore} onChange={e => setFilters({ minScore: Math.max(0, Math.min(100, Number(e.target.value)||0)) })} />
            </div>
          </div>

          <div className="row" style={{gap:8, flexWrap:"wrap", marginTop:10}}>
            {state.categories.map(c => (
              <button key={c} className={"tabBtn " + (state.filters.categories.includes(c) ? "active" : "")} onClick={() => toggleFilterList("categories", c)}>
                {c}
              </button>
            ))}
          </div>

          <div className="row" style={{gap:8, flexWrap:"wrap", marginTop:8}}>
            {state.priceTiers.map(t => (
              <button key={t} className={"tabBtn " + (state.filters.tiers.includes(t) ? "active" : "")} onClick={() => toggleFilterList("tiers", t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Discover */}
      {tab==="discover" && (
        <div className="card cannabisSectionCard">
          <div className="h">Vegas Deals + Community Radar</div>
          <div className="sub">Built for Las Vegas first: find strong dispensary deal lanes, save them locally, and keep a current cannabis-community radar in one place.</div>

          <div className="card cannabisMiniCard cannabisTrackerBoard" style={{marginTop:12}}>
            <div className="row" style={{justifyContent:"space-between", gap:10, alignItems:"baseline", flexWrap:"wrap"}}>
              <div>
                <div className="small shellEyebrow">LIVE MENU / DEAL TRACKER</div>
                <div style={{fontWeight:900}}>Best right-now Vegas dispensary lanes</div>
                <div className="sub">Use this board like a local strike list: strongest lane first, community/events as a second layer, then save the keepers into Favorites.</div>
              </div>
              <span className="badge">Updated from current public deal surfaces</span>
            </div>
            <div className="cannabisTrackerGrid" style={{marginTop:10}}>
              {VEGAS_LIVE_TRACKER.map(item => (
                <div key={item.id} className="card cannabisMiniCard cannabisTrackerCard" style={{padding:12}}>
                  <div className="row" style={{justifyContent:"space-between", gap:8, flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontWeight:900}}>{item.name}</div>
                      <div className="sub">{item.lane}</div>
                    </div>
                    <span className={"badge " + (item.strength >= 88 ? "good" : item.strength >= 80 ? "warn" : "")}>{strengthLabel(item.strength)}</span>
                  </div>
                  <div className="sub" style={{marginTop:8}}>{item.notes}</div>
                  <div className="cannabisTrackerMeter" style={{marginTop:10}}>
                    <div className="cannabisTrackerMeterFill" style={{width: `${item.strength}%`}} />
                  </div>
                  <div className="row" style={{justifyContent:"space-between", gap:8, marginTop:6, flexWrap:"wrap"}}>
                    <div className="small">Strength {item.strength}/100</div>
                    <div className="row" style={{gap:6, flexWrap:"wrap"}}>
                      {item.tags.map(tag => <span key={tag} className="badge">{tag}</span>)}
                    </div>
                  </div>
                  <div className="row" style={{gap:8, flexWrap:"wrap", marginTop:10}}>
                    <a href={item.url} target="_blank" rel="noreferrer">Open live lane</a>
                    <button onClick={() => saveFeaturedLink(item.name, item.url, "Live deal lane", item.notes)}>Save tracker</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid2 cannabisDiscoverGrid" style={{marginTop:12}}>
            <div className="card cannabisMiniCard">
              <div className="small shellEyebrow">BEST DEAL LANES</div>
              <div className="sub">Use these as your first stops for Las Vegas comparison shopping.</div>
              <div style={{marginTop:10, display:"grid", gap:10}}>
                {VEGAS_FEATURED_DEALS.map(item => (
                  <div key={item.id} className="card cannabisMiniCard" style={{padding:12}}>
                    <div className="row" style={{justifyContent:"space-between", gap:8, flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontWeight:900}}>{item.name}</div>
                        <div className="sub">{item.area}</div>
                      </div>
                      <span className="badge">Vegas deal lane</span>
                    </div>
                    <div className="sub" style={{marginTop:8}}>{item.notes}</div>
                    <div className="row" style={{gap:8, flexWrap:"wrap", marginTop:10}}>
                      {item.tags.map(tag => <span key={tag} className="badge">{tag}</span>)}
                    </div>
                    <div className="row" style={{gap:8, marginTop:10, flexWrap:"wrap"}}>
                      <a href={item.url} target="_blank" rel="noreferrer">Open deal lane</a>
                      <button onClick={() => saveFeaturedLink(item.name, item.url, "Deals", item.notes)}>Save lane</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card cannabisMiniCard">
              <div className="small shellEyebrow">COMMUNITY EVENTS</div>
              <div className="sub">Up-to-date cannabis-friendly hangs and larger Vegas community events to watch.</div>
              <div style={{marginTop:10, display:"grid", gap:10}}>
                {VEGAS_COMMUNITY_EVENTS.map(evt => (
                  <div key={evt.id} className="card cannabisMiniCard" style={{padding:12}}>
                    <div className="row" style={{justifyContent:"space-between", gap:8, flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontWeight:900}}>{evt.title}</div>
                        <div className="sub">{evt.when}</div>
                      </div>
                      <span className="badge">{evt.venue}</span>
                    </div>
                    <div className="row" style={{gap:8, flexWrap:"wrap", marginTop:10}}>
                      {evt.tags.map(tag => <span key={tag} className="badge">{tag}</span>)}
                    </div>
                    <div className="row" style={{gap:8, marginTop:10, flexWrap:"wrap"}}>
                      <a href={evt.url} target="_blank" rel="noreferrer">Open event</a>
                      <button onClick={() => saveFeaturedLink(evt.title, evt.url, "Event", `${evt.when} · ${evt.venue}`)}>Save event</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid2 cannabisDiscoverGrid" style={{marginTop:12}}>
            <div className="card cannabisMiniCard">
              <div style={{fontWeight:900}}>Open public sources near ZIP</div>
              <div className="sub">Browser-open sources for menus, strains, shops, and quick searches near your ZIP.</div>
              <div className="grid2" style={{marginTop:10}}>
                {services.map(s => (
                  <div key={s.id} className="card cannabisMiniCard">
                    <div style={{fontWeight:900}}>{s.label}</div>
                    <div className="sub">{s.hint}</div>
                    <div className="row" style={{gap:8, marginTop:10, flexWrap:"wrap"}}>
                      <button onClick={() => openUrl(googleQuery(s.q(state.zip || "89121")))}>Open search</button>
                      <button onClick={() => saveFeaturedLink(`${s.label} — ${state.zip || "89121"}`, googleQuery(s.q(state.zip || "89121")), "Info", s.hint)}>Save link</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card cannabisMiniCard">
              <div style={{fontWeight:900}}>Vegas action board</div>
              <div className="sub">Quick launch the strongest current research lanes.</div>
              <div className="row" style={{gap:8, flexWrap:"wrap", marginTop:8}}>
                <button onClick={() => openUrl(googleQuery(`best cannabis deals Las Vegas ${state.zip || "89121"}`))}>Vegas deals</button>
                <button onClick={() => openUrl(googleQuery(`site:nuwu.vegas/events cannabis Las Vegas March 2026`))}>NuWu events</button>
                <button onClick={() => openUrl(googleQuery(`site:planet13lasvegas.com/deals Las Vegas cannabis deals`))}>Planet 13 deals</button>
                <button onClick={() => openUrl(googleQuery(`site:thedispensarynv.com Las Vegas daily deals cannabis`))}>The Dispensary NV</button>
                <button onClick={() => openUrl(googleQuery(`cannabis community Las Vegas meetup March 2026`))}>Community search</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deals */}
      {tab==="deals" && (
        <>
          <div className="card cannabisSectionCard">
            <div className="h">Deal Lab</div>
            <div className="sub">Paste deal text from a source you trust. We score “best overall” (value + clarity + fewer restrictions).</div>

            <div className="grid2" style={{marginTop:10}}>
              <label className="field">Store / Source name (optional)
                <input value={dealStore} onChange={e=>setDealStore(e.target.value)} placeholder="Dispensary name" />
              </label>
              <label className="field">Source URL (optional)
                <input value={dealUrl} onChange={e=>setDealUrl(e.target.value)} placeholder="Paste page link" />
              </label>
              <label className="field">Category
                <select value={dealCategory} onChange={e=>setDealCategory(e.target.value)}>
                  <option value="">(none)</option>
                  {state.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="field">Price tier
                <select value={dealTier} onChange={e=>setDealTier(e.target.value)}>
                  <option value="">(none)</option>
                  {state.priceTiers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="field">Tags (comma-separated)
                <input value={dealTags} onChange={e=>setDealTags(e.target.value)} placeholder="e.g. flower, bogo, weekend" />
              </label>
            </div>

            <label className="field" style={{marginTop:10}}>Deal text
              <textarea value={dealText} onChange={e=>setDealText(e.target.value)} rows={6} placeholder="Paste the deal wording here…" />
            </label>

            <div className="row" style={{justifyContent:"space-between", alignItems:"center", marginTop:10, gap:10, flexWrap:"wrap"}}>
              <div className={"badge " + scoreBadge(draftScore.score)} style={{fontWeight:900}}>
                Score {draftScore.score}/100
              </div>
              <div className="row" style={{gap:8, flexWrap:"wrap"}}>
                <button onClick={() => copy(dealText || "")}>Copy raw</button>
                <button onClick={addDeal}>Save deal</button>
              </div>
            </div>

            <div className="sub" style={{marginTop:10}}>
              Signals: {[
                ...draftScore.valueSignals.map(s => `✅ ${s}`),
                ...draftScore.claritySignals.map(s => `🧠 ${s}`),
                ...draftScore.timeframeSignals.map(s => `⏱️ ${s}`),
                ...draftScore.restrictionSignals.map(s => `⚠️ ${s}`),
              ].slice(0,10).join(" · ") || "(paste text to analyze)"}
            </div>
          </div>

          <div className="card">
            <div className="row" style={{justifyContent:"space-between", alignItems:"baseline", flexWrap:"wrap", gap:10}}>
              <div>
                <div className="h">Saved Deals</div>
                <div className="sub">Filtered: {filteredDeals.length} / {state.deals.length}</div>
              </div>
              <div className="row" style={{gap:8, flexWrap:"wrap"}}>
                <button onClick={askRankDeals}>Ask Homie to rank</button>
                <button onClick={() => setState(s => ({...s, deals: []}))}>Clear all</button>
              </div>
            </div>

            {filteredDeals.length === 0 ? (
              <div className="sub" style={{marginTop:10}}>No saved deals yet. Paste one above.</div>
            ) : (
              <div style={{marginTop:10}}>
                {filteredDeals.map(d => (
                  <div key={d.id} className="card cannabisMiniCard">
                    <div className="row" style={{justifyContent:"space-between", alignItems:"baseline", gap:10, flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontWeight:900}}>{d.store || d.category || "Deal"}</div>
                        <div className="sub">{new Date(d.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="row" style={{gap:8, alignItems:"center", flexWrap:"wrap"}}>
                        <span className={"badge " + scoreBadge(d.score)} style={{fontWeight:900}}>Score {d.score}</span>
                        {d.priceTier ? <span className="badge">{d.priceTier}</span> : null}
                        {d.category ? <span className="badge">{d.category}</span> : null}
                      </div>
                    </div>

                    <div className="sub" style={{marginTop:8}}>
                      Value {Math.round(d.breakdown.value)} · Clarity {Math.round(d.breakdown.clarity)} · Restrictions {Math.round(d.breakdown.restrictions)} · Time {Math.round(d.breakdown.timeframe)}
                    </div>

                    <div style={{whiteSpace:"pre-wrap", marginTop:8}}>{d.text}</div>

                    {d.sourceUrl ? (
                      <div className="row" style={{gap:8, marginTop:8, flexWrap:"wrap"}}>
                        <a href={d.sourceUrl} target="_blank" rel="noreferrer">Open source</a>
                      </div>
                    ) : null}

                    <div className="row" style={{gap:8, marginTop:10, flexWrap:"wrap"}}>
                      <button onClick={() => copy(d.text)}>Copy</button>
                      <button onClick={() => dealToNote(d)}>Save to Notes</button>
                      <button onClick={() => deleteDeal(d.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Favorites */}
      {tab==="favorites" && (
        <>
          <div className="card">
            <div className="h">Add Favorite</div>
            <div className="grid2" style={{marginTop:10}}>
              <label className="field">Name
                <input value={favName} onChange={e=>setFavName(e.target.value)} placeholder="Dispensary / resource name" />
              </label>
              <label className="field">URL
                <input value={favUrl} onChange={e=>setFavUrl(e.target.value)} placeholder="Paste link" />
              </label>
              <label className="field">Address (optional, for map)
                <input value={favAddr} onChange={e=>setFavAddr(e.target.value)} placeholder="Street, City, State" />
              </label>
              <label className="field">Category
                <select value={favCat} onChange={e=>setFavCat(e.target.value)}>
                  <option value="">(none)</option>
                  {state.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="field">Price tier
                <select value={favTier} onChange={e=>setFavTier(e.target.value)}>
                  <option value="">(none)</option>
                  {state.priceTiers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="field">Tags (comma-separated)
                <input value={favTags} onChange={e=>setFavTags(e.target.value)} placeholder="e.g. grow, CBD, deals" />
              </label>
            </div>
            <div className="row" style={{gap:8, marginTop:10}}>
              <button onClick={addFav}>Save favorite</button>
            </div>
          </div>

          <div className="card">
            <div className="row" style={{justifyContent:"space-between", alignItems:"baseline", flexWrap:"wrap", gap:10}}>
              <div>
                <div className="h">Saved Favorites</div>
                <div className="sub">Filtered: {filteredFavs.length} / {state.favorites.length}</div>
              </div>
              <div className="row" style={{gap:8}}>
                <button onClick={() => setTab("map")}>View on Map</button>
              </div>
            </div>

            {filteredFavs.length === 0 ? (
              <div className="sub" style={{marginTop:10}}>No favorites yet.</div>
            ) : (
              <div style={{marginTop:10}}>
                {filteredFavs.map(f => (
                  <div key={f.id} className="card cannabisMiniCard">
                    <div className="row" style={{justifyContent:"space-between", alignItems:"baseline", gap:10, flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontWeight:900}}>{f.name}</div>
                        <div className="sub">{f.url}</div>
                      </div>
                      <div className="row" style={{gap:8, flexWrap:"wrap", alignItems:"center"}}>
                        {f.priceTier ? <span className="badge">{f.priceTier}</span> : null}
                        {f.category ? <span className="badge">{f.category}</span> : null}
                        {f.coords ? <span className="badge good">📍</span> : <span className="badge warn">no pin</span>}
                      </div>
                    </div>
                    {f.address ? <div className="sub" style={{marginTop:6}}>Address: {f.address}</div> : null}
                    <div className="row" style={{gap:8, marginTop:10, flexWrap:"wrap"}}>
                      <a href={f.url} target="_blank" rel="noreferrer">Open</a>
                      <button onClick={() => { setSelectedFavId(f.id); setTab("map"); }}>Map</button>
                      <button onClick={() => deleteFav(f.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Map */}
      {tab==="map" && (
        <div className="card">
          <div className="row" style={{justifyContent:"space-between", alignItems:"baseline", flexWrap:"wrap", gap:10}}>
            <div>
              <div className="h">Map (Saved Favorites)</div>
              <div className="sub">Pins come from your saved addresses → “Lookup coords”.</div>
            </div>
            <div className="row" style={{gap:8}}>
              <button onClick={() => setTab("favorites")}>Manage Favorites</button>
            </div>
          </div>

          <div className="row" style={{gap:12, marginTop:10, alignItems:"stretch", flexWrap:"wrap"}}>
            <div style={{minWidth:260, flex:"1 1 300px"}}>
              <div className="sub" style={{marginBottom:8}}>Select</div>
              <select style={{width:"100%"}} value={selectedFav?.id || ""} onChange={e => setSelectedFavId(e.target.value)}>
                {state.favorites.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>

              {selectedFav ? (
                <div className="card" style={{marginTop:10, background:"rgba(8,12,18,0.35)"}}>
                  <div style={{fontWeight:900}}>{selectedFav.name}</div>
                  <div className="sub">{selectedFav.address || "No address yet"}</div>
                  <div className="row" style={{gap:8, marginTop:10, flexWrap:"wrap"}}>
                    <a href={selectedFav.url} target="_blank" rel="noreferrer">Open</a>
                    <button onClick={lookupCoords}>Lookup coords</button>
                    {selectedFav.coords ? (
                      <button onClick={() => copy(`${selectedFav.coords.lat}, ${selectedFav.coords.lon}`)}>Copy coords</button>
                    ) : null}
                  </div>
                  {!selectedFav.address ? (
                    <div className="sub" style={{marginTop:10}}>Tip: edit the favorite and add an address to pin it.</div>
                  ) : null}
                </div>
              ) : (
                <div className="sub" style={{marginTop:10}}>Add a favorite first.</div>
              )}
            </div>

            <div style={{minWidth:320, flex:"2 1 520px"}}>
              {selectedFav?.coords ? (
                <iframe
                  title="map"
                  src={osmEmbedUrl(selectedFav.coords)}
                  style={{width:"100%", height:420, border:"1px solid var(--line)", borderRadius:14, background:"rgba(0,0,0,0.2)"}}
                />
              ) : (
                <div className="card" style={{height:420, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(8,12,18,0.35)"}}>
                  <div className="sub" style={{textAlign:"center"}}>
                    No pin yet. Add an address → Lookup coords → map appears here.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {tab==="notes" && (
        <>
          <div className="card">
            <div className="h">Notes</div>
            <div className="grid2" style={{marginTop:10}}>
              <label className="field">Title
                <input value={noteTitle} onChange={e=>setNoteTitle(e.target.value)} placeholder="e.g. Strain notes / store rules" />
              </label>
            </div>
            <label className="field" style={{marginTop:10}}>Body
              <textarea value={noteBody} onChange={e=>setNoteBody(e.target.value)} rows={6} placeholder="Paste anything here (deal text, reminders, etc.)" />
            </label>
            <div className="row" style={{gap:8, marginTop:10}}>
              <button onClick={addNote}>Save note</button>
            </div>
          </div>

          <div className="card">
            <div className="h">Saved Notes</div>
            {state.notes.length === 0 ? (
              <div className="sub" style={{marginTop:10}}>No notes yet.</div>
            ) : (
              <div style={{marginTop:10}}>
                {state.notes.map(n => (
                  <div key={n.id} className="card cannabisMiniCard">
                    <div className="row" style={{justifyContent:"space-between", alignItems:"baseline", gap:10}}>
                      <div>
                        <div style={{fontWeight:900}}>{n.title}</div>
                        <div className="sub">{new Date(n.createdAt).toLocaleString()}</div>
                      </div>
                      <button onClick={() => deleteNote(n.id)}>Delete</button>
                    </div>
                    <div style={{whiteSpace:"pre-wrap", marginTop:8}}>{n.body}</div>
                    <div className="row" style={{gap:8, marginTop:10}}>
                      <button onClick={() => copy(n.body)}>Copy</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Assistant */}
      {tab==="assistant" && (
        <div className="card">
          <div className="row" style={{justifyContent:"space-between", alignItems:"baseline", flexWrap:"wrap", gap:10}}>
            <div>
              <div className="h">Ask Homie 👊</div>
              <div className="sub">
                Homie compares your saved/pasted info only. It does not fetch live menus, prices, or deals.
              </div>
            </div>
            <div className="row" style={{gap:8, flexWrap:"wrap"}}>
              <button onClick={() => setInput("Compare my top 3 deals and tell me the best overall pick.")}>Compare top deals</button>
              <button onClick={() => setInput("Summarize my saved notes into a checklist.")}>Checklist</button>
            </div>
          </div>

          {!desktop ? (
            <div className="sub" style={{marginTop:10}}>Desktop mode required for Homie chat (local).</div>
          ) : null}

          <div className="card" style={{marginTop:10, height:340, overflow:"auto", background:"rgba(8,12,18,0.35)"}}>
            {chat.filter(m => m.role !== "system").map((m,i) => (
              <div key={i} style={{margin:"10px 0"}}>
                <div className="sub" style={{fontWeight:900}}>{m.role === "user" ? "You" : "Homie"}</div>
                <div style={{whiteSpace:"pre-wrap"}}>{m.content}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="row" style={{gap:8, marginTop:10}}>
            <input style={{flex:1}} value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask Homie… (e.g. rank my deals)" onKeyDown={e=>{ if(e.key==="Enter") send(); }} />
            <button onClick={send}>Send</button>
          </div>
        </div>
      )}

      {/* Settings */}
      {tab==="settings" && (
        <div className="card">
          <div className="h">Settings</div>
          <div className="sub">These lists power filters. For global defaults, use OS → Preferences.</div>

          <div className="grid2" style={{marginTop:10}}>
            <label className="field">ZIP
              <input value={state.zip} onChange={e=>setZip(e.target.value)} placeholder="ZIP" />
            </label>
          </div>

          <div className="row" style={{gap:18, flexWrap:"wrap", marginTop:10}}>
            <div style={{minWidth:280, flex:1}}>
              <div style={{fontWeight:900}}>Categories</div>
              <div className="row" style={{gap:8, flexWrap:"wrap", marginTop:8}}>
                {state.categories.map(c => (
                  <button key={c} className="tabBtn active" onClick={() => setState(s => ({...s, categories: s.categories.filter(x=>x!==c)}))} title="Remove">{c} ✕</button>
                ))}
              </div>
              <div className="row" style={{gap:8, marginTop:8}}>
                <input placeholder="Add category" onKeyDown={(e)=>{ if(e.key==="Enter"){ const v=(e.currentTarget.value||"").trim(); if(v){ setState(s=>({...s, categories:[...s.categories, v]})); e.currentTarget.value=""; } } }} />
                <button onClick={()=>pushNotif({kind:"Workspace", title:"Tip", detail:"Type a category and press Enter."})}>?</button>
              </div>
            </div>

            <div style={{minWidth:280, flex:1}}>
              <div style={{fontWeight:900}}>Price tiers</div>
              <div className="row" style={{gap:8, flexWrap:"wrap", marginTop:8}}>
                {state.priceTiers.map(t => (
                  <button key={t} className="tabBtn active" onClick={() => setState(s => ({...s, priceTiers: s.priceTiers.filter(x=>x!==t)}))} title="Remove">{t} ✕</button>
                ))}
              </div>
              <div className="row" style={{gap:8, marginTop:8}}>
                <input placeholder="Add tier" onKeyDown={(e)=>{ if(e.key==="Enter"){ const v=(e.currentTarget.value||"").trim(); if(v){ setState(s=>({...s, priceTiers:[...s.priceTiers, v]})); e.currentTarget.value=""; } } }} />
                <button onClick={()=>pushNotif({kind:"Workspace", title:"Tip", detail:"Type a tier and press Enter."})}>?</button>
              </div>
            </div>
          </div>

          <div className="card cannabisSectionCard" style={{marginTop:12}}>
            <div style={{fontWeight:900}}>Reset Cannabis local data</div>
            <div className="sub">This clears Cannabis-only state (not your global Preferences).</div>
            <div className="row" style={{gap:8, marginTop:8}}>
              <button onClick={() => { setState(defaultState()); pushNotif({kind:"Workspace", title:"Reset", detail:"Cannabis local state reset."}); }}>Reset Cannabis panel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
