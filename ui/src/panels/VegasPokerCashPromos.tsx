import React, { useEffect, useMemo, useState } from "react";
import {
  VEGAS_SHOW_INTEL,
  buildTonightLanes,
  getVenueTone,
  safeLoadVegasPrefs,
  safeSaveVegasPrefs,
} from "../lib/vegasIntel";

type Tab = "shows" | "pairings" | "watch";

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

export default function VegasPokerCashPromos() {
  const [tab, setTab] = useState<Tab>("shows");
  const [prefs, setPrefs] = useState(() => safeLoadVegasPrefs());

  useEffect(() => {
    safeSaveVegasPrefs(prefs);
  }, [prefs]);

  const pairings = useMemo(() => {
    const tonight = buildTonightLanes();
    return [
      {
        id: "premium-night",
        title: "Premium poker + show night",
        pokerLane: tonight[1].lane,
        showLane: "Sphere / Eagles",
        why: "Use this if you want a polished flagship room and a true Vegas residency add-on.",
      },
      {
        id: "value-night",
        title: "Value poker + modern show night",
        pokerLane: tonight[0].lane,
        showLane: "Sphere / ILLENIUM or Anyma",
        why: "Good when you want better tournament value but still want a legit event after.",
      },
      {
        id: "future-trip",
        title: "Future trip builder",
        pokerLane: "WSOP watchlist + Horseshoe/Paris",
        showLane: "future Sphere lanes",
        why: "Use this when planning a bigger future Vegas run instead of just tonight.",
      },
    ];
  }, []);

  return (
    <div className="stack">
      <div className="card softCard" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div className="small shellEyebrow">Vegas add-ons / shows / pairings</div>
          <div className="h">Vegas Poker Cash + Promos</div>
          <div className="sub">
            Sharper shows board, pinning, and better "what pairs well with tonight's poker lane?" guidance.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill active={tab === "shows"} onClick={() => setTab("shows")}>Shows board</Pill>
          <Pill active={tab === "pairings"} onClick={() => setTab("pairings")}>Poker + show pairings</Pill>
          <Pill active={tab === "watch"} onClick={() => setTab("watch")}>Pinned shows</Pill>
        </div>
      </div>

      {tab === "shows" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
          {VEGAS_SHOW_INTEL.map((show) => {
            const pinned = prefs.showFavorites.includes(show.id);
            return (
              <div className="card softCard" key={show.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <strong>{show.title}</strong>
                    <div className="muted">{show.venue}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span
                      style={{
                        borderRadius: 999,
                        padding: "5px 8px",
                        fontSize: 11,
                        border: "1px solid rgba(255,255,255,0.08)",
                        ...toneStyle(getVenueTone(show.venue)),
                      }}
                    >
                      {show.dateRange}
                    </span>
                    <button
                      className="tabBtn"
                      type="button"
                      onClick={() =>
                        setPrefs((current) => ({
                          ...current,
                          showFavorites: pinned
                            ? current.showFavorites.filter((id) => id !== show.id)
                            : [...current.showFavorites, show.id],
                        }))
                      }
                    >
                      {pinned ? "Pinned" : "Pin"}
                    </button>
                  </div>
                </div>

                <p className="muted" style={{ marginTop: 10 }}>{show.vibe}</p>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {show.tags.map((tagValue) => (
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

      {tab === "pairings" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
          {pairings.map((pair) => (
            <div className="card softCard" key={pair.id}>
              <strong>{pair.title}</strong>
              <div style={{ ...card, marginTop: 10 }}>
                <div className="small">Poker lane</div>
                <b>{pair.pokerLane}</b>
              </div>
              <div style={{ ...card, marginTop: 10 }}>
                <div className="small">Show lane</div>
                <b>{pair.showLane}</b>
              </div>
              <p className="muted" style={{ marginTop: 10 }}>{pair.why}</p>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "watch" ? (
        <div className="card softCard">
          <div className="small shellEyebrow">Pinned shows</div>
          <div className="h">Watchlist</div>
          <div className="stack" style={{ marginTop: 10 }}>
            {VEGAS_SHOW_INTEL.filter((show) => prefs.showFavorites.includes(show.id)).map((show) => (
              <div style={row} key={show.id}>
                <div>
                  <strong>{show.title}</strong>
                  <div className="muted">{show.venue} · {show.dateRange}</div>
                </div>
                <button
                  className="tabBtn"
                  type="button"
                  onClick={() =>
                    setPrefs((current) => ({
                      ...current,
                      showFavorites: current.showFavorites.filter((id) => id !== show.id),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            {!prefs.showFavorites.length ? (
              <div style={row}>
                <span className="muted">Pin the shows you actually care about from the Shows board.</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
