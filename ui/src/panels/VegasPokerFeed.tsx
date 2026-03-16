import React, { useEffect, useMemo, useState } from "react";
import {
  VEGAS_TOURNAMENT_SERIES,
  VegasSeriesTag,
  buildTonightLanes,
  getVenueTone,
  safeLoadVegasPrefs,
  safeSaveVegasPrefs,
} from "../lib/vegasIntel";

type Tab = "series" | "tonight" | "watch";

function toneStyle(tone: string) {
  if (tone === "premium") return { background: "rgba(123,92,255,0.18)", borderColor: "rgba(123,92,255,0.28)" };
  if (tone === "value") return { background: "rgba(94,201,111,0.18)", borderColor: "rgba(94,201,111,0.28)" };
  if (tone === "prestige") return { background: "rgba(255,179,71,0.18)", borderColor: "rgba(255,179,71,0.28)" };
  if (tone === "locals") return { background: "rgba(93,163,255,0.18)", borderColor: "rgba(93,163,255,0.28)" };
  if (tone === "show") return { background: "rgba(255,120,169,0.18)", borderColor: "rgba(255,120,169,0.28)" };
  return { background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" };
}

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.035)",
  borderRadius: 16,
  padding: 14,
};

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
  borderRadius: 12,
  padding: "10px 12px",
};

function Pill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tabBtn ${active ? "active" : ""}`}
      style={{ borderRadius: 999, padding: "8px 12px" }}
    >
      {children}
    </button>
  );
}

export default function VegasPokerFeed() {
  const [tab, setTab] = useState<Tab>("series");
  const [tag, setTag] = useState<VegasSeriesTag | "all">("all");
  const [prefs, setPrefs] = useState(() => safeLoadVegasPrefs());

  useEffect(() => {
    safeSaveVegasPrefs(prefs);
  }, [prefs]);

  const filtered = useMemo(() => {
    return VEGAS_TOURNAMENT_SERIES.filter((item) => tag === "all" ? true : item.tags.includes(tag));
  }, [tag]);

  const tonightLanes = useMemo(() => buildTonightLanes(), []);

  return (
    <div className="stack">
      <div className="card softCard" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="small shellEyebrow">Vegas intel / tournament desk</div>
            <div className="h">Vegas Poker Feed</div>
            <div className="sub">
              Sharper series tracking, better room guidance, watchlist saves, and stronger "what's worth tonight?" flow.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ ...card, minWidth: 120 }}>
              <div className="small">Tracked series</div>
              <b>{VEGAS_TOURNAMENT_SERIES.length}</b>
            </div>
            <div style={{ ...card, minWidth: 120 }}>
              <div className="small">Pinned rooms</div>
              <b>{prefs.favorites.length}</b>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill active={tab === "series"} onClick={() => setTab("series")}>Series board</Pill>
          <Pill active={tab === "tonight"} onClick={() => setTab("tonight")}>Tonight</Pill>
          <Pill active={tab === "watch"} onClick={() => setTab("watch")}>Watchlist</Pill>
        </div>

        {tab === "series" ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["all", "series", "value", "prestige", "daily", "future", "satellite"].map((item) => (
              <button
                key={item}
                type="button"
                className={`tabBtn ${tag === item ? "active" : ""}`}
                style={{ borderRadius: 999, padding: "6px 10px" }}
                onClick={() => setTag(item as VegasSeriesTag | "all")}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {tab === "series" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
          {filtered.map((series) => {
            const pinned = prefs.favorites.includes(series.id);
            return (
              <div className="card softCard" key={series.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <strong>{series.title}</strong>
                    <div className="muted">{series.venue}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span
                      style={{
                        borderRadius: 999,
                        padding: "5px 8px",
                        fontSize: 11,
                        border: "1px solid rgba(255,255,255,0.08)",
                        ...toneStyle(getVenueTone(series.venue)),
                      }}
                    >
                      {series.dateRange}
                    </span>
                    <button
                      className="tabBtn"
                      type="button"
                      onClick={() =>
                        setPrefs((current) => ({
                          ...current,
                          favorites: pinned
                            ? current.favorites.filter((id) => id !== series.id)
                            : [...current.favorites, series.id],
                        }))
                      }
                    >
                      {pinned ? "Pinned" : "Pin"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div style={card}>
                    <div className="small">Guarantee lane</div>
                    <b>{series.guarantee}</b>
                  </div>
                  <div style={card}>
                    <div className="small">Buy-in focus</div>
                    <b>{series.buyInFocus}</b>
                  </div>
                </div>

                <p className="muted" style={{ marginTop: 10 }}>{series.bestFor}</p>

                <div className="stack" style={{ marginTop: 10 }}>
                  {series.notes.map((note) => (
                    <div style={row} key={note}>
                      <span className="muted">{note}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {series.tags.map((tagValue) => (
                    <span
                      key={tagValue}
                      style={{
                        borderRadius: 999,
                        padding: "4px 8px",
                        fontSize: 11,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.05)",
                      }}
                    >
                      {tagValue}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === "tonight" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
          {tonightLanes.map((lane) => (
            <div className="card softCard" key={lane.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <strong>{lane.title}</strong>
                <span
                  style={{
                    borderRadius: 999,
                    padding: "5px 8px",
                    fontSize: 11,
                    border: "1px solid rgba(255,255,255,0.08)",
                    ...toneStyle(lane.tone),
                  }}
                >
                  {lane.lane}
                </span>
              </div>
              <p className="muted" style={{ marginTop: 10 }}>{lane.note}</p>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "watch" ? (
        <div className="card softCard">
          <div className="small shellEyebrow">Pinned poker lanes</div>
          <div className="h">Watchlist</div>
          <div className="stack" style={{ marginTop: 10 }}>
            {VEGAS_TOURNAMENT_SERIES.filter((series) => prefs.favorites.includes(series.id)).map((series) => (
              <div style={row} key={series.id}>
                <div>
                  <strong>{series.title}</strong>
                  <div className="muted">{series.venue} · {series.dateRange}</div>
                </div>
                <button
                  className="tabBtn"
                  type="button"
                  onClick={() =>
                    setPrefs((current) => ({
                      ...current,
                      favorites: current.favorites.filter((id) => id !== series.id),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            {!prefs.favorites.length ? (
              <div style={row}>
                <span className="muted">Pin your favorite series or daily lanes from the Series board.</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
