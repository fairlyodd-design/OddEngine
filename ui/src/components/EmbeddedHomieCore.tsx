import React, { useEffect, useMemo, useState } from "react";
import { buildHomieCoreSnapshot, seedHomieDraft } from "../lib/homieCore";
import { getPanelMeta } from "../lib/brain";
import { loadPrefs } from "../lib/prefs";

export default function EmbeddedHomieCore({ activePanelId, onNavigate }: { activePanelId: string; onNavigate: (id: string) => void }) {
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState("");
  const prefs = loadPrefs();
  const snapshot = useMemo(() => buildHomieCoreSnapshot(activePanelId), [activePanelId, tick]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 12000);
    return () => window.clearInterval(id);
  }, []);

  if (prefs.ai.homieEmbeddedCore === false) return null;

  const bestMoveMeta = snapshot.todayBestMove ? getPanelMeta(snapshot.todayBestMove.panelId) : null;
  const nextMoveMeta = snapshot.nextMoneyMove ? getPanelMeta(snapshot.nextMoneyMove.panelId) : null;

  function openHomieWithPrompt(text: string) {
    if (!text.trim()) return;
    seedHomieDraft(text, { source: "embedded-core", panelId: activePanelId });
    setDraft("");
    onNavigate("Homie");
  }

  return (
    <div className="card heroCard homieCoreCard">
      <div className="homieCoreTop">
        <div className="homieCoreTitleWrap">
          <div className="homieCoreAvatarWrap">
            <span className="homieOrb good skin-memoji homieCoreOrb" title="Homie is ready">
              <span className="homieOrbCore">
                <span className="homieMemojiWrap">
                  <span className="homieMemojiOuter anim hype">
                    <span className="homieMemojiInner">
                      <span className="homieCoreEmoji" aria-hidden="true">🧢</span>
                    </span>
                  </span>
                </span>
              </span>
              <span className="homieOrbRing ringOne" />
              <span className="homieOrbRing ringTwo" />
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="small shellEyebrow">Embedded companion</div>
            <div className="assistantTitle">👊 Homie Core</div>
            <div className="small">{snapshot.shellRole} • always aware of your panel, recovery fit, and best next money move.</div>
            <div className="small homieCoreReadyLine">{snapshot.conversationReadyLabel}</div>
            <div className="small homieCompanionMiniLine">{snapshot.companionHeadline}</div>
          </div>
        </div>
        <button className="tabBtn" onClick={() => onNavigate("Homie")}>Open Homie</button>
      </div>

      <div className="assistantChipWrap homieCoreBadges">
        <span className="badge good">{snapshot.panelIcon} {snapshot.panelTitle}</span>
        <span className={`badge ${snapshot.recovery.capacity === "high" ? "good" : snapshot.recovery.capacity === "medium" ? "warn" : "bad"}`}>{snapshot.energyHeadline}</span>
        <span className={`badge ${snapshot.todayBestMove ? "good" : "muted"}`}>{snapshot.todayBestMove ? snapshot.todayBestMove.category : "No lane yet"}</span>
      </div>

      <div className="homieCoreHeadline">{snapshot.operatorHeadline}</div>
      <div className="small homieCoreBriefing">{snapshot.briefing}</div>

      <div className="card homieCompanionCard">
        <div className="small shellEyebrow">Companion mode • {snapshot.companionMode}</div>
        <div className="homieCoreCardTitle">{snapshot.companionHeadline}</div>
        <div className="small" style={{ marginTop: 6 }}>{snapshot.companionBrief}</div>
        <div className="assistantChipWrap homieCompanionChipRow" style={{ marginTop: 10 }}>
          {snapshot.checkInPrompts.map((prompt) => (
            <button key={prompt} className="tabBtn" onClick={() => openHomieWithPrompt(prompt)}>{prompt}</button>
          ))}
        </div>
      </div>

      <div className="assistantChipWrap homieCoreVoiceBar">
        <button className="tabBtn active" onClick={() => window.dispatchEvent(new CustomEvent("oddengine:homie-voice-action", { detail: { action: "start", source: "embedded-core" } }))}>Talk</button>
        <button className="tabBtn" onClick={() => window.dispatchEvent(new CustomEvent("oddengine:homie-voice-action", { detail: { action: "stop", source: "embedded-core" } }))}>Stop</button>
        <button className="tabBtn" onClick={() => window.dispatchEvent(new CustomEvent("oddengine:homie-voice-action", { detail: { action: "toggle-continuous", source: "embedded-core" } }))}>Loop voice</button>
        <button className="tabBtn" onClick={() => window.dispatchEvent(new CustomEvent("oddengine:homie-voice-action", { detail: { action: "screen-read", source: "embedded-core" } }))}>Read screen</button>
        <button className="tabBtn" onClick={() => openHomieWithPrompt(`Give me the best legit money move from ${snapshot.panelTitle} right now.`)}>Money huddle</button>
      </div>

      <div className="homieCoreGrid">

      <div className="timelineCard" style={{ marginTop: 10 }}>
        <div className="small shellEyebrow">Memory + relationship</div>
        <div className="homieCoreCardTitle">{snapshot.memoryHeadline}</div>
        <div className="small" style={{ marginTop: 6 }}>{snapshot.memoryBrief}</div>
        <div className="small" style={{ marginTop: 6 }}>{snapshot.memoryPattern}</div>
        <div className="assistantChipWrap" style={{ marginTop: 10 }}>
          <button className="tabBtn" onClick={() => openHomieWithPrompt(`What do you remember about my current goals, recovery mode, and what lane is working?`)}>Memory check</button>
          <button className="tabBtn" onClick={() => openHomieWithPrompt(`Based on what you remember is working, what should I push today?`)}>Use memory</button>
        </div>
      </div>
        <div className="timelineCard">
          <div className="small">Today’s best move</div>
          <div className="homieCoreCardTitle">{snapshot.todayBestMove ? snapshot.todayBestMove.title : "Need more signal"}</div>
          <div className="small">{snapshot.todayBestMove ? snapshot.todayBestMove.fitReason : "Seed more income lanes in Money, Home, and Brain."}</div>
          <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
            {bestMoveMeta ? <button className="tabBtn active" onClick={() => onNavigate(bestMoveMeta.id)}>Open {bestMoveMeta.title}</button> : null}
            {snapshot.todayBestMove ? <button className="tabBtn" onClick={() => openHomieWithPrompt(`Help me execute this move: ${snapshot.todayBestMove?.title}. Keep it realistic for my energy today.`)}>Ask Homie</button> : null}
          </div>
        </div>
        <div className="timelineCard">
          <div className="small">Money Autopilot</div>
          <div className="homieCoreCardTitle">{snapshot.nextMoneyMove ? snapshot.nextMoneyMove.title : "Queue is waiting"}</div>
          <div className="small">{snapshot.nextMoneyMove ? `${snapshot.nextMoneyMove.valueLabel} • ${snapshot.nextMoneyMove.body}` : "Refresh Money Autopilot from Brain or Money after adding more data."}</div>
          <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
            {nextMoveMeta ? <button className="tabBtn active" onClick={() => onNavigate(nextMoveMeta.id)}>Open {nextMoveMeta.title}</button> : null}
            {snapshot.nextMoneyMove ? <button className="tabBtn" onClick={() => openHomieWithPrompt(`Turn this Autopilot move into tiny steps: ${snapshot.nextMoneyMove?.title}.`)}>Break it down</button> : null}
          </div>
        </div>
      </div>

      <div className="card homieMoneyPulseCard">
        <div className="small shellEyebrow">Money / Homie evolution</div>
        <div className="homieCoreCardTitle">{snapshot.moneyFocusLabel}</div>
        <div className="small" style={{ marginTop: 6 }}>{snapshot.moneyFocusBrief}</div>
        <div className="assistantChipWrap" style={{ marginTop: 10 }}>
          <button className="tabBtn active" onClick={() => openHomieWithPrompt(`Coach me through the next legit money move from home. Keep it realistic for my current recovery mode.`)}>Coach next move</button>
          <button className="tabBtn" onClick={() => onNavigate("Money")}>Open Income board</button>
          <button className="tabBtn" onClick={() => onNavigate("Brain")}>Open Brain</button>
        </div>
      </div>


      <div className="assistantChipWrap" style={{ marginTop: 10 }}>
        <button className="tabBtn active" onClick={() => onNavigate("Trading")}>Homie open Trading</button>
        <button className="tabBtn" onClick={() => openHomieWithPrompt(`What makes money today from home with low friction?`)}>What makes money today?</button>
        <button className="tabBtn" onClick={() => openHomieWithPrompt(`Walk me through the next step from ${snapshot.panelTitle}. Keep it tiny.`)}>Walk me through the next step</button>
        <button className="tabBtn" onClick={() => openHomieWithPrompt(`Help me ship one thing today from Income Forge.`)}>Ship one thing today</button>
      </div>
      <div className="assistantSection" style={{ padding: 0 }}>
        <div className="assistantSectionTitle">Ask Homie from anywhere</div>
        <div className="row" style={{ marginTop: 8, gap: 8 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Ask Homie about ${snapshot.panelTitle}, your best move, or your next 30 minutes…`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                openHomieWithPrompt(draft);
              }
            }}
          />
          <button className="tabBtn active" onClick={() => openHomieWithPrompt(draft)}>Ask</button>
        </div>
        <div className="assistantChipWrap" style={{ marginTop: 10 }}>
          {snapshot.suggestedPrompts.map((prompt) => (
            <button key={prompt} className="tabBtn" onClick={() => openHomieWithPrompt(prompt)}>{prompt}</button>
          ))}
        </div>
      </div>

      <div className="assistantChipWrap" style={{ marginTop: 10 }}>
        {snapshot.quickActions.map((action) => (
          <button
            key={action.id}
            className="tabBtn"
            onClick={() => {
              if (action.kind === "navigate" && action.panelId) onNavigate(action.panelId);
              if (action.kind === "homie-draft" && action.prompt) openHomieWithPrompt(action.prompt);
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
