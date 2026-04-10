import React, { useEffect, useMemo, useState } from "react";
import {
  buildAssistantInsight,
  getPanelChat,
  getPanelMeta,
  readPanelContext,
  runBrainChat,
  runQuickAction,
  saveBrainNote,
  savePanelChat,
  type BrainChatMessage,
  QUICK_ACTIONS,
  ACTION_CHAINS,
  getPanelChainIds,
  getActionHistory,
  getBrainMemories,
  undoActionRecord,
} from "../lib/brain";
import { executeCommand } from "../lib/commandCenter";
import { loadPrefs } from "../lib/prefs";
import { loadJSON, saveJSON } from "../lib/storage";
import {
  UPGRADE_PACKS_EVENT,
  getInjectedAssistantCards,
  grantAllUpgradePackPermissions,
  installUpgradePack,
  repairUpgradePackDependencies,
  type UpgradeSurfaceAction,
} from "../lib/plugins";

const DOCK_OPEN_KEY = "oddengine:brain:dockOpen:v1";

export default function AssistantDock({ panelId, onNavigate, onOpenHowTo }: { panelId: string; onNavigate: (id: string) => void; onOpenHowTo?: () => void; }) {
  const meta = getPanelMeta(panelId);
  const prefs = loadPrefs();
  const openMap = loadJSON<Record<string, boolean>>(DOCK_OPEN_KEY, {});
  const [open, setOpen] = useState<boolean>(openMap[meta.id] ?? (prefs.ai?.defaultDockOpen ?? true));
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [ctxTick, setCtxTick] = useState(0);
  const [pluginTick, setPluginTick] = useState(0);
  const [messages, setMessages] = useState<BrainChatMessage[]>(() => getPanelChat(meta.id));
  const ctx = useMemo(() => readPanelContext(meta.id), [meta.id, ctxTick]);
  const insight = useMemo(() => buildAssistantInsight(meta.id), [meta.id, ctxTick]);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastAction = useMemo(() => getActionHistory(meta.id)[0] || null, [meta.id, ctxTick]);
  const lastMemory = useMemo(() => getBrainMemories(meta.id)[0] || null, [meta.id, ctxTick]);
  const pluginCards = useMemo(() => getInjectedAssistantCards(meta.id), [meta.id, pluginTick]);

  useEffect(() => {
    setMessages(getPanelChat(meta.id));
    setPrompt("");
    const nextOpenMap = loadJSON<Record<string, boolean>>(DOCK_OPEN_KEY, {});
    setOpen(nextOpenMap[meta.id] ?? (prefs.ai?.defaultDockOpen ?? true));
  }, [meta.id]);

  useEffect(() => {
    const handler = () => setPluginTick((v) => v + 1);
    window.addEventListener(UPGRADE_PACKS_EVENT, handler as EventListener);
    return () => window.removeEventListener(UPGRADE_PACKS_EVENT, handler as EventListener);
  }, []);

  useEffect(() => {
    const next = { ...loadJSON<Record<string, boolean>>(DOCK_OPEN_KEY, {}), [meta.id]: open };
    saveJSON(DOCK_OPEN_KEY, next);
  }, [meta.id, open]);

  function persist(next: BrainChatMessage[]) {
    setMessages(next);
    savePanelChat(meta.id, next);
  }

  function pushAssistantMessage(content: string) {
    const next = [...messages, { role: "assistant", content, ts: Date.now() }];
    persist(next.slice(-20));
  }

  async function ask(nextPrompt?: string) {
    const text = (nextPrompt ?? prompt).trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user", content: text, ts: Date.now() }];
    persist(next);
    setPrompt("");
    setBusy(true);
    try {
      const r = await runBrainChat({ panelId: meta.id, prompt: text, mode: "panel" });
      const out = [...next, { role: "assistant", content: r.reply, ts: Date.now() }];
      persist(out);
      if (prefs.ai?.autoPinNotes) {
        saveBrainNote({ panelId: meta.id, title: `${meta.title} insight`, body: r.reply, pinned: true });
      }
    } finally {
      setBusy(false);
      setCtxTick((v) => v + 1);
    }
  }

  function runAction(action: NonNullable<typeof meta.actions>[number]) {
    if (action.kind === "navigate" && action.panelId) onNavigate(action.panelId);
    if (action.kind === "setStorage" && action.storageKey) {
      try { localStorage.setItem(action.storageKey, JSON.stringify(action.storageValue)); } catch {}
      if (action.panelId) onNavigate(action.panelId);
    }
    if (action.kind === "help") onOpenHowTo?.();
  }

  function pinLatest() {
    if (!lastAssistant) return;
    saveBrainNote({ panelId: meta.id, title: `${meta.assistantName} note`, body: lastAssistant.content, pinned: true });
    setCtxTick((v) => v + 1);
  }

  function handleQuickAction(actionId: string) {
    const result = runQuickAction(actionId);
    if (result.panelId) onNavigate(result.panelId);
    if (result.message) pushAssistantMessage(result.message);
    setCtxTick((v) => v + 1);
  }

  function handlePluginAction(action: UpgradeSurfaceAction) {
    if (action.kind === "install-pack") {
      const packId = action.id.split(":")[0];
      installUpgradePack(packId);
      pushAssistantMessage(`${action.label} complete.`);
      setPluginTick((v) => v + 1);
      return;
    }
    if (action.kind === "grant-permissions") {
      const packId = action.id.split(":")[0];
      grantAllUpgradePackPermissions(packId);
      pushAssistantMessage(`${action.label} complete.`);
      setPluginTick((v) => v + 1);
      return;
    }
    if (action.kind === "repair-dependencies") {
      const packId = action.id.split(":")[0];
      repairUpgradePackDependencies(packId);
      pushAssistantMessage(`${action.label} complete.`);
      setPluginTick((v) => v + 1);
      return;
    }
    if (action.kind === "navigate" && action.panelId) {
      onNavigate(action.panelId);
      if (action.speakText) pushAssistantMessage(action.speakText);
      return;
    }
    if (action.kind === "command" && action.commandText) {
      const result = executeCommand({
        text: action.commandText,
        activePanelId: meta.id,
        onNavigate,
        onOpenHowTo,
        onStatus: (text) => pushAssistantMessage(text),
      });
      if (result?.message && !action.speakText) pushAssistantMessage(result.message);
      if (action.speakText) pushAssistantMessage(action.speakText);
      setCtxTick((v) => v + 1);
    }
  }

  const chainIds = getPanelChainIds(meta.id);

  const chipActions = [
    ...(meta.quickActionIds || []),
    meta.id === "FamilyBudget" ? "budget:payoff" : null,
    meta.id === "FamilyBudget" ? "budget:reports" : null,
    meta.id === "Trading" ? "panel:homie" : null,
    meta.id === "Security" ? "security:lockdown" : null,
    meta.id === "Brain" ? "brain:pin-digest" : null,
    meta.id === "DevEngine" ? "panel:homie" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="assistantWrap glassPanel">
      <div className="assistantHeader">
        <div>
          <div className="assistantTitle">{meta.assistantName}</div>
          <div className="small">{meta.assistantRole}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className={`badge ${insight.tone === "bad" ? "bad" : insight.tone === "warn" ? "warn" : "good"}`}>{insight.tone === "good" ? "Ready" : insight.tone === "warn" ? "Needs data" : "Attention"}</span>
          <button className="tabBtn" onClick={() => setOpen((v) => !v)}>{open ? "Hide" : "Show"}</button>
        </div>
      </div>

      {!open ? (
        <div className="assistantMini small">{insight.headline}</div>
      ) : (
        <>
          <div className="assistantSection card softCard">
            <div className="assistantSectionTitle">Panel read</div>
            <div className="small" style={{ lineHeight: 1.5, marginTop: 8 }}>{ctx.summary}</div>
            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              {insight.badges.map((badge) => <span key={badge.label} className={`badge ${badge.tone}`}>{badge.label}</span>)}
            </div>
          </div>

          <div className="assistantSection card softCard">
            <div className="assistantSectionTitle">What looks good</div>
            <ul className="assistantList small">
              {insight.wins.slice(0, 3).map((detail, idx) => <li key={idx}>{detail}</li>)}
            </ul>
            <div className="assistantSectionTitle" style={{ marginTop: 14 }}>What to watch</div>
            <ul className="assistantList small">
              {insight.watchouts.slice(0, 3).map((detail, idx) => <li key={idx}>{detail}</li>)}
            </ul>
          </div>

          {!!pluginCards.length && (
            <div className="assistantSection card softCard">
              <div className="assistantSectionTitle">Plugin copilots</div>
              <div className="assistantStack" style={{ marginTop: 10 }}>
                {pluginCards.map((card) => (
                  <div key={card.id} className={`timelineCard pluginUpgradeCard ${card.tone || "good"}`}>
                    {card.eyebrow ? <div className="small pluginCardEyebrow">{card.eyebrow}</div> : null}
                    <div style={{ fontWeight: 800, marginTop: 4 }}>{card.title}</div>
                    <div className="small" style={{ marginTop: 6 }}>{card.body}</div>
                    <div className="assistantChipWrap" style={{ marginTop: 10 }}>
                      {card.actions.map((action) => (
                        <button key={action.id} className={`tabBtn ${action.tone === "good" ? "active" : ""}`} onClick={() => handlePluginAction(action)}>
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(lastAction || lastMemory) && (
            <div className="assistantSection card softCard">
              <div className="assistantSectionTitle">Recent confirmed state</div>
              {lastAction && (
                <div className="timelineCard" style={{ marginTop: 10 }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div>
                      <div className="small">{new Date(lastAction.ts).toLocaleTimeString()}</div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{lastAction.title}</div>
                    </div>
                    <span className={`badge ${lastAction.status === "error" ? "bad" : lastAction.status === "warn" ? "warn" : lastAction.status === "info" ? "muted" : "good"}`}>{lastAction.undoneAt ? "undone" : lastAction.status}</span>
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>{lastAction.body}</div>
                  {!!lastAction.undoSteps?.length && !lastAction.undoneAt && (
                    <div className="row" style={{ marginTop: 8, gap: 8 }}>
                      <button className="tabBtn" onClick={() => { const result = undoActionRecord(lastAction.id); if (result.panelId) onNavigate(result.panelId); if (result.message) pushAssistantMessage(result.message); setCtxTick((v) => v + 1); }}>Undo last action</button>
                    </div>
                  )}
                </div>
              )}
              {lastMemory && (
                <div className="small" style={{ marginTop: 10 }}>{lastMemory.title} — {lastMemory.body}</div>
              )}
            </div>
          )}

          <div className="assistantSection card softCard">
            <div className="assistantSectionTitle">Quick prompts</div>
            <div className="assistantChipWrap">
              {meta.quickPrompts.map((qp) => (
                <button key={qp} className="tabBtn" onClick={() => ask(qp)} disabled={busy}>{qp}</button>
              ))}
            </div>
          </div>

          <div className="assistantSection card softCard">
            <div className="assistantSectionTitle">Suggested next steps</div>
            <ul className="assistantList small">
              {insight.suggestedActions.map((step, idx) => <li key={idx}>{step}</li>)}
            </ul>
            {!!chainIds.length && (
              <>
                <div className="assistantSectionTitle" style={{ marginTop: 14 }}>One-tap chains</div>
                <div className="assistantChipWrap" style={{ marginTop: 10 }}>
                  {chainIds.map((chainId) => {
                    const chain = ACTION_CHAINS.find((item) => item.id === chainId);
                    if (!chain) return null;
                    return (
                      <button key={chainId} className="tabBtn active" onClick={() => handleQuickAction(chainId)} title={chain.description}>
                        {chain.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              {chipActions.map((actionId) => {
                const label = QUICK_ACTIONS.find((action) => action.id === actionId)?.label
                  || (actionId === "budget:payoff" ? "Open payoff" : actionId === "budget:reports" ? "Open reports" : actionId === "security:lockdown" ? "Lock it down" : actionId === "panel:homie" ? "Route to Homie" : "Run action");
                return (
                  <button key={actionId} className="tabBtn active" onClick={() => handleQuickAction(actionId)}>
                    {label}
                  </button>
                );
              })}
              {!!meta.actions?.length && meta.actions.map((action) => (
                <button key={action.id} className="tabBtn" onClick={() => runAction(action)}>{action.label}</button>
              ))}
              {onOpenHowTo && <button className="tabBtn" onClick={onOpenHowTo}>How to use</button>}
            </div>
          </div>

          <div className="assistantSection card softCard">
            <div className="assistantSectionTitle">Ask AI</div>
            <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={`Ask ${meta.assistantName.toLowerCase()} about ${meta.title.toLowerCase()}...`} />
            <div className="row" style={{ marginTop: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
              <div className="small">Context includes saved local panel state, goals, and recent mission signals.</div>
              <div className="row" style={{ gap: 8 }}>
                <button className="tabBtn" onClick={() => setCtxTick((v) => v + 1)}>Refresh</button>
                <button onClick={() => ask()} disabled={busy || !prompt.trim()}>{busy ? "Thinking…" : "Ask"}</button>
              </div>
            </div>
          </div>

          {!!messages.length && (
            <div className="assistantSection card softCard">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div className="assistantSectionTitle">Recent assistant notes</div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="tabBtn" onClick={() => onNavigate("Brain")}>Open Brain</button>
                  <button className="tabBtn" onClick={pinLatest} disabled={!lastAssistant}>Pin to Brain</button>
                </div>
              </div>
              <div className="assistantTranscript">
                {messages.slice(-4).map((msg, idx) => (
                  <div key={idx} className={`assistantBubble ${msg.role}`}>
                    <div className="small" style={{ marginBottom: 6 }}>{msg.role === "assistant" ? meta.assistantName : "You"}</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
