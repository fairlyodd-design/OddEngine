import React, { useEffect, useMemo, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import { loadGuardedState, normalizeNumber, normalizeString, normalizeStringArray, saveGuardedState, toRecord } from "../lib/stateGuard";

type SessionQuality = "A" | "B" | "C";
type PokerSession = {
  id: string;
  date: string;
  game: string;
  stake: string;
  location: string;
  hours: number;
  buyIn: number;
  cashOut: number;
  result: number;
  quality: SessionQuality;
  tags: string[];
  note: string;
};

type StudyNote = {
  id: string;
  createdAt: string;
  title: string;
  topic: string;
  confidence: number;
  nextAction: string;
  notes: string;
};

type PokerState = {
  bankroll: {
    starting: number;
    current: number;
    reserve: number;
    stopLoss: number;
    maxBuyIn: number;
    target: number;
  };
  todayFocus: string;
  edgeTags: string[];
  sessions: PokerSession[];
  studyNotes: StudyNote[];
  lastUpdated: number;
};

type SessionDraft = {
  date: string;
  game: string;
  stake: string;
  location: string;
  hours: string;
  buyIn: string;
  cashOut: string;
  quality: SessionQuality;
  tags: string;
  note: string;
};

type StudyDraft = {
  title: string;
  topic: string;
  confidence: string;
  nextAction: string;
  notes: string;
};

const KEY = "oddengine:poker:v1";
const STATE_VERSION = "10.24.1";

const defaultState: PokerState = {
  bankroll: {
    starting: 1000,
    current: 1000,
    reserve: 300,
    stopLoss: 150,
    maxBuyIn: 100,
    target: 1500,
  },
  todayFocus: "Play patient. Table select hard. Quit if focus slips.",
  edgeTags: ["table selection", "position", "value betting"],
  sessions: [],
  studyNotes: [],
  lastUpdated: Date.now(),
};

const defaultSessionDraft: SessionDraft = {
  date: new Date().toISOString().slice(0, 10),
  game: "NLH Cash",
  stake: "1/2",
  location: "Local room",
  hours: "4",
  buyIn: "200",
  cashOut: "200",
  quality: "B",
  tags: "table selection, tilt control",
  note: "",
};

const defaultStudyDraft: StudyDraft = {
  title: "",
  topic: "Preflop",
  confidence: "6",
  nextAction: "Review marked hands before next session",
  notes: "",
};

function uid(prefix = "poker") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function money(n: number) {
  return Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function sanitizeSession(raw: unknown): PokerSession | null {
  const rec = toRecord(raw);
  const buyIn = normalizeNumber(rec.buyIn, 0);
  const cashOut = normalizeNumber(rec.cashOut, 0);
  const result = normalizeNumber(rec.result, cashOut - buyIn);
  return {
    id: normalizeString(rec.id) || uid("session"),
    date: normalizeString(rec.date) || new Date().toISOString().slice(0, 10),
    game: normalizeString(rec.game) || "NLH Cash",
    stake: normalizeString(rec.stake) || "1/2",
    location: normalizeString(rec.location) || "",
    hours: normalizeNumber(rec.hours, 0),
    buyIn,
    cashOut,
    result,
    quality: ["A", "B", "C"].includes(String(rec.quality)) ? rec.quality as SessionQuality : "B",
    tags: normalizeStringArray(rec.tags),
    note: normalizeString(rec.note),
  };
}

function sanitizeStudy(raw: unknown): StudyNote | null {
  const rec = toRecord(raw);
  const title = normalizeString(rec.title);
  if (!title) return null;
  return {
    id: normalizeString(rec.id) || uid("study"),
    createdAt: normalizeString(rec.createdAt) || new Date().toISOString().slice(0, 10),
    title,
    topic: normalizeString(rec.topic) || "General",
    confidence: Math.max(1, Math.min(10, normalizeNumber(rec.confidence, 5))),
    nextAction: normalizeString(rec.nextAction),
    notes: normalizeString(rec.notes),
  };
}

function sanitizeState(raw: unknown, fallback: PokerState = defaultState): PokerState {
  const rec = toRecord(raw);
  const bankroll = toRecord(rec.bankroll);
  const sessions = Array.isArray(rec.sessions) ? rec.sessions.map(sanitizeSession).filter(Boolean) as PokerSession[] : [];
  const studyNotes = Array.isArray(rec.studyNotes) ? rec.studyNotes.map(sanitizeStudy).filter(Boolean) as StudyNote[] : [];
  return {
    bankroll: {
      starting: normalizeNumber(bankroll.starting, fallback.bankroll.starting),
      current: normalizeNumber(bankroll.current, fallback.bankroll.current),
      reserve: normalizeNumber(bankroll.reserve, fallback.bankroll.reserve),
      stopLoss: normalizeNumber(bankroll.stopLoss, fallback.bankroll.stopLoss),
      maxBuyIn: normalizeNumber(bankroll.maxBuyIn, fallback.bankroll.maxBuyIn),
      target: normalizeNumber(bankroll.target, fallback.bankroll.target),
    },
    todayFocus: normalizeString(rec.todayFocus, fallback.todayFocus),
    edgeTags: normalizeStringArray(rec.edgeTags).length ? normalizeStringArray(rec.edgeTags) : fallback.edgeTags,
    sessions: sessions.sort((a, b) => String(b.date).localeCompare(String(a.date))),
    studyNotes: studyNotes.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    lastUpdated: normalizeNumber(rec.lastUpdated, Date.now()),
  };
}

export default function Poker() {
  const [state, setState] = useState<PokerState>(() => loadGuardedState<PokerState>({ key: KEY, version: STATE_VERSION, defaultState, sanitize: sanitizeState }));
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(defaultSessionDraft);
  const [studyDraft, setStudyDraft] = useState<StudyDraft>(defaultStudyDraft);

  useEffect(() => {
    saveGuardedState(KEY, STATE_VERSION, state);
  }, []);

  const persist = (next: PokerState) => {
    const safe = sanitizeState({ ...next, lastUpdated: Date.now() });
    setState(safe);
    saveGuardedState(KEY, STATE_VERSION, safe);
  };

  const patchBankroll = (field: keyof PokerState["bankroll"], value: string) => {
    const parsed = Number(value);
    persist({ ...state, bankroll: { ...state.bankroll, [field]: Number.isFinite(parsed) ? parsed : 0 } });
  };

  const addSession = () => {
    const buyIn = Number(sessionDraft.buyIn) || 0;
    const cashOut = Number(sessionDraft.cashOut) || 0;
    const result = cashOut - buyIn;
    const session: PokerSession = {
      id: uid("session"),
      date: sessionDraft.date || new Date().toISOString().slice(0, 10),
      game: sessionDraft.game.trim() || "NLH Cash",
      stake: sessionDraft.stake.trim() || "1/2",
      location: sessionDraft.location.trim(),
      hours: Math.max(0, Number(sessionDraft.hours) || 0),
      buyIn,
      cashOut,
      result,
      quality: sessionDraft.quality,
      tags: sessionDraft.tags.split(",").map((item) => item.trim()).filter(Boolean),
      note: sessionDraft.note.trim(),
    };
    const sessions = [session, ...state.sessions];
    persist({ ...state, sessions, bankroll: { ...state.bankroll, current: Number((state.bankroll.current + result).toFixed(2)) } });
    setSessionDraft({ ...defaultSessionDraft, date: sessionDraft.date });
  };

  const removeSession = (id: string) => {
    const session = state.sessions.find((item) => item.id === id);
    const sessions = state.sessions.filter((item) => item.id !== id);
    const current = session ? state.bankroll.current - session.result : state.bankroll.current;
    persist({ ...state, sessions, bankroll: { ...state.bankroll, current: Number(current.toFixed(2)) } });
  };

  const addStudyNote = () => {
    const title = studyDraft.title.trim();
    if (!title) return;
    const note: StudyNote = {
      id: uid("study"),
      createdAt: new Date().toISOString().slice(0, 10),
      title,
      topic: studyDraft.topic.trim() || "General",
      confidence: Math.max(1, Math.min(10, Number(studyDraft.confidence) || 5)),
      nextAction: studyDraft.nextAction.trim(),
      notes: studyDraft.notes.trim(),
    };
    persist({ ...state, studyNotes: [note, ...state.studyNotes] });
    setStudyDraft(defaultStudyDraft);
  };

  const removeStudy = (id: string) => persist({ ...state, studyNotes: state.studyNotes.filter((item) => item.id !== id) });

  const totalResult = useMemo(() => state.sessions.reduce((sum, session) => sum + session.result, 0), [state.sessions]);
  const totalHours = useMemo(() => state.sessions.reduce((sum, session) => sum + session.hours, 0), [state.sessions]);
  const hourly = totalHours > 0 ? totalResult / totalHours : 0;
  const winRate = state.sessions.length ? Math.round((state.sessions.filter((s) => s.result > 0).length / state.sessions.length) * 100) : 0;
  const riskUnits = state.bankroll.stopLoss > 0 ? state.bankroll.current / state.bankroll.stopLoss : 0;
  const nextShotReady = state.bankroll.current - state.bankroll.reserve >= state.bankroll.maxBuyIn;

  const edgeStats = useMemo(() => {
    const map = new Map<string, { count: number; result: number }>();
    state.sessions.forEach((session) => {
      session.tags.forEach((tag) => {
        const key = tag.toLowerCase();
        const prev = map.get(key) || { count: 0, result: 0 };
        map.set(key, { count: prev.count + 1, result: prev.result + session.result });
      });
    });
    return Array.from(map.entries())
      .map(([tag, stat]) => ({ tag, count: stat.count, result: stat.result }))
      .sort((a, b) => b.count - a.count || b.result - a.result)
      .slice(0, 8);
  }, [state.sessions]);

  return (
    <div className="page">
      <PanelHeader
        panelId="Poker"
        title="♠️ Poker"
        subtitle="Bankroll + sessions + edge tracker"
        storagePrefix="oddengine:poker"
        storageActionsMode="menu"
        badges={[
          { label: `Bankroll ${money(state.bankroll.current)}`, tone: state.bankroll.current >= state.bankroll.starting ? "good" : "warn" },
          { label: `${state.sessions.length} sessions`, tone: state.sessions.length ? "good" : "muted" },
          { label: `Hourly ${money(hourly)}`, tone: hourly >= 0 ? "good" : "warn" },
          { label: nextShotReady ? "Shot ready" : "Protect roll", tone: nextShotReady ? "good" : "warn" },
        ]}
      />

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard">
          <div className="h">Bankroll lane</div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">Starting bankroll<input value={String(state.bankroll.starting)} onChange={(e) => patchBankroll("starting", e.target.value)} /></label>
            <label className="field">Current bankroll<input value={String(state.bankroll.current)} onChange={(e) => patchBankroll("current", e.target.value)} /></label>
            <label className="field">Reserve / life roll<input value={String(state.bankroll.reserve)} onChange={(e) => patchBankroll("reserve", e.target.value)} /></label>
            <label className="field">Daily stop-loss<input value={String(state.bankroll.stopLoss)} onChange={(e) => patchBankroll("stopLoss", e.target.value)} /></label>
            <label className="field">Max buy-in<input value={String(state.bankroll.maxBuyIn)} onChange={(e) => patchBankroll("maxBuyIn", e.target.value)} /></label>
            <label className="field">Target bankroll<input value={String(state.bankroll.target)} onChange={(e) => patchBankroll("target", e.target.value)} /></label>
          </div>
          <label className="field" style={{ marginTop: 10 }}>Today focus
            <textarea rows={3} value={state.todayFocus} onChange={(e) => persist({ ...state, todayFocus: e.target.value })} />
          </label>
          <label className="field">Edge tags
            <input value={state.edgeTags.join(", ")} onChange={(e) => persist({ ...state, edgeTags: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="table selection, exploit iso, tilt control" />
          </label>
          <div className="assistantChipWrap" style={{ marginTop: 12 }}>
            <span className="badge good">Net {money(state.bankroll.current - state.bankroll.starting)}</span>
            <span className="badge muted">Risk units {riskUnits.toFixed(1)}</span>
            <span className="badge muted">Protected roll {money(Math.max(0, state.bankroll.current - state.bankroll.reserve))}</span>
            <span className={`badge ${nextShotReady ? "good" : "warn"}`}>{nextShotReady ? "Bankroll supports next shot" : "Keep protecting reserve"}</span>
          </div>
        </div>

        <div className="card softCard">
          <div className="h">Session capture</div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">Date<input type="date" value={sessionDraft.date} onChange={(e) => setSessionDraft({ ...sessionDraft, date: e.target.value })} /></label>
            <label className="field">Game<input value={sessionDraft.game} onChange={(e) => setSessionDraft({ ...sessionDraft, game: e.target.value })} /></label>
            <label className="field">Stake<input value={sessionDraft.stake} onChange={(e) => setSessionDraft({ ...sessionDraft, stake: e.target.value })} /></label>
            <label className="field">Location<input value={sessionDraft.location} onChange={(e) => setSessionDraft({ ...sessionDraft, location: e.target.value })} /></label>
            <label className="field">Hours<input value={sessionDraft.hours} onChange={(e) => setSessionDraft({ ...sessionDraft, hours: e.target.value })} /></label>
            <label className="field">Quality<select value={sessionDraft.quality} onChange={(e) => setSessionDraft({ ...sessionDraft, quality: e.target.value as SessionQuality })}><option value="A">A game</option><option value="B">B game</option><option value="C">C game</option></select></label>
            <label className="field">Buy-in<input value={sessionDraft.buyIn} onChange={(e) => setSessionDraft({ ...sessionDraft, buyIn: e.target.value })} /></label>
            <label className="field">Cash-out<input value={sessionDraft.cashOut} onChange={(e) => setSessionDraft({ ...sessionDraft, cashOut: e.target.value })} /></label>
          </div>
          <label className="field" style={{ marginTop: 10 }}>Tags
            <input value={sessionDraft.tags} onChange={(e) => setSessionDraft({ ...sessionDraft, tags: e.target.value })} placeholder="table selection, bluff catching, tilt control" />
          </label>
          <label className="field">Notes
            <textarea rows={3} value={sessionDraft.note} onChange={(e) => setSessionDraft({ ...sessionDraft, note: e.target.value })} placeholder="What mattered? What leaked?" />
          </label>
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="tabBtn active" onClick={addSession}>Log session</button>
            <span className={`badge ${(Number(sessionDraft.cashOut) - Number(sessionDraft.buyIn)) >= 0 ? "good" : "warn"}`}>Draft result {money((Number(sessionDraft.cashOut) || 0) - (Number(sessionDraft.buyIn) || 0))}</span>
          </div>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="h">Session ledger</div>
              <div className="sub">Track what the bankroll is actually doing.</div>
            </div>
            <div className="assistantChipWrap">
              <span className="badge muted">Win rate {winRate}%</span>
              <span className={`badge ${totalResult >= 0 ? "good" : "warn"}`}>Total {money(totalResult)}</span>
            </div>
          </div>
          <div className="assistantStack" style={{ marginTop: 12 }}>
            {state.sessions.map((session) => (
              <div key={session.id} className="timelineCard">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{session.date} · {session.game} · {session.stake}</div>
                    <div className="small">{session.location || "Location TBD"} · {session.hours}h · {session.quality} game</div>
                  </div>
                  <div className="assistantChipWrap">
                    {session.tags.map((tag) => <span key={tag} className="badge muted">{tag}</span>)}
                    <span className={`badge ${session.result >= 0 ? "good" : "warn"}`}>{money(session.result)}</span>
                    <button className="tabBtn" onClick={() => removeSession(session.id)}>Delete</button>
                  </div>
                </div>
                {session.note ? <div className="small" style={{ marginTop: 8 }}>{session.note}</div> : null}
              </div>
            ))}
            {!state.sessions.length ? <div className="small">No sessions logged yet. Capture the next one and the bankroll lane will update automatically.</div> : null}
          </div>
        </div>

        <div className="card softCard">
          <div className="h">Edge tracker</div>
          <div className="assistantStack" style={{ marginTop: 12 }}>
            {edgeStats.map((item) => (
              <div key={item.tag} className="timelineCard">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, textTransform: "capitalize" }}>{item.tag}</div>
                  <div className="assistantChipWrap">
                    <span className="badge muted">{item.count} spots</span>
                    <span className={`badge ${item.result >= 0 ? "good" : "warn"}`}>{money(item.result)}</span>
                  </div>
                </div>
              </div>
            ))}
            {!edgeStats.length ? <div className="small">Tag sessions so you can see which edges are actually paying you.</div> : null}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card softCard">
          <div className="h">Study room</div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">Title<input value={studyDraft.title} onChange={(e) => setStudyDraft({ ...studyDraft, title: e.target.value })} placeholder="BTN vs BB c-bet node" /></label>
            <label className="field">Topic<input value={studyDraft.topic} onChange={(e) => setStudyDraft({ ...studyDraft, topic: e.target.value })} placeholder="Preflop / Turn / Live exploit" /></label>
            <label className="field">Confidence (1-10)<input value={studyDraft.confidence} onChange={(e) => setStudyDraft({ ...studyDraft, confidence: e.target.value })} /></label>
            <label className="field">Next action<input value={studyDraft.nextAction} onChange={(e) => setStudyDraft({ ...studyDraft, nextAction: e.target.value })} placeholder="Run 20 sims / review marked hands" /></label>
          </div>
          <label className="field" style={{ marginTop: 10 }}>Notes
            <textarea rows={4} value={studyDraft.notes} onChange={(e) => setStudyDraft({ ...studyDraft, notes: e.target.value })} />
          </label>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="tabBtn active" onClick={addStudyNote}>Save study note</button>
          </div>
        </div>

        <div className="card softCard">
          <div className="h">Study backlog</div>
          <div className="assistantStack" style={{ marginTop: 12 }}>
            {state.studyNotes.map((note) => (
              <div key={note.id} className="timelineCard">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{note.title}</div>
                    <div className="small">{note.createdAt} · {note.topic} · confidence {note.confidence}/10</div>
                  </div>
                  <button className="tabBtn" onClick={() => removeStudy(note.id)}>Delete</button>
                </div>
                {note.nextAction ? <div className="small" style={{ marginTop: 8 }}>Next: {note.nextAction}</div> : null}
                {note.notes ? <div className="small" style={{ marginTop: 8 }}>{note.notes}</div> : null}
              </div>
            ))}
            {!state.studyNotes.length ? <div className="small">Log hand reviews, leaks, and next drills so the edge tracker stays honest.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
