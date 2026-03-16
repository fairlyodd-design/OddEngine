import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import homieMascot from "../assets/homie-mascot.png";
import { loadPrefs, savePrefs, type Prefs } from "../lib/prefs";
import { oddApi } from "../lib/odd";
import { CALENDAR_EVENT, listUpcoming } from "../lib/calendarStore";
import { getPanelMeta, normalizePanelId } from "../lib/brain";
import LilHomie3D from "./LilHomie3D";

type BubbleMsg = { id: string; role: "system" | "user" | "assistant"; text: string; ts: number };

class TinyBoundary extends React.Component<{ onError: () => void; children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    try { this.props.onError(); } catch {}
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function nowId() {
  return `${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function msUntil(date: string, time?: string) {
  try {
    const t = time || "00:00";
    const d = new Date(`${date}T${t}:00`);
    const ms = d.getTime() - Date.now();
    return ms;
  } catch {
    return Number.NaN;
  }
}

function fmtEta(ms: number) {
  const m = Math.round(ms / 60000);
  if (m <= 0) return "now";
  if (m === 1) return "in 1 min";
  if (m < 60) return `in ${m} min`;
  const h = Math.round(m / 60);
  return h === 1 ? "in ~1 hr" : `in ~${h} hr`;
}

export default function LilHomieAgent({
  activePanelId,
  onNavigate,
}: {
  activePanelId: string;
  onNavigate: (id: string) => void;
}) {
  const reduceMotion = useMemo(() => {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      return false;
    }
  }, []);

  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const ai = (prefs.ai as any) || {};
  const enabled = !!ai.homieLilEnabled;
  const roamEnabled = !!ai.homieLilRoam && !reduceMotion;
  const speechEnabled = !!ai.homieLilSpeech;
  const chatterEnabled = ai.homieLilChatter !== false;
  const speed = clamp(Number(ai.homieLilSpeed ?? 160), 80, 280);
  const scale = clamp(Number(ai.homieLilScale ?? 1), 0.7, 1.35);
  const lil3d = (ai as any).homieLil3d === true;
  const energy = clamp(Number((ai as any).homieLilEnergy ?? (ai as any).homieMascotEnergy ?? 0.9), 0.3, 1.0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef({ x: 30, y: 120 });
  const velRef = useRef({ vx: 0, vy: 0 });
  const tgtRef = useRef<{ x: number; y: number; until: number } | null>(null);
  const draggingRef = useRef<{ dx: number; dy: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const walkingRef = useRef(false);
  const facingRef = useRef<"left" | "right">("right");

  const [open, setOpen] = useState(false);
  const [threeFailed, setThreeFailed] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<BubbleMsg[]>(() => [{ id: nowId(), role: "system", text: "Yo 👊 I’m Lil Homie. Drag me, click me, or ask me anything.", ts: Date.now() }]);

  // Restore last position.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("oddengine:lilhomie:pos:v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          posRef.current = { x: parsed.x, y: parsed.y };
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Keep prefs in sync.
  useEffect(() => {
    const onPrefs = (evt: any) => {
      const next = evt?.detail?.prefs;
      if (next) setPrefs(next as Prefs);
      else setPrefs(loadPrefs());
    };
    window.addEventListener("oddengine:prefs-changed", onPrefs as any);
    return () => window.removeEventListener("oddengine:prefs-changed", onPrefs as any);
  }, []);

  // Initial placement.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const { x, y } = posRef.current;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }, [scale]);

  function persistPos() {
    try {
      localStorage.setItem("oddengine:lilhomie:pos:v1", JSON.stringify(posRef.current));
    } catch {
      // ignore
    }
  }

  function say(text: string, opts: { forceOpen?: boolean } = {}) {
    const msg: BubbleMsg = { id: nowId(), role: "assistant", text, ts: Date.now() };
    setMsgs((prev) => [...prev.slice(-14), msg]);
    if (opts.forceOpen) setOpen(true);

    if (!speechEnabled) {
      // still animate a quick "talk" so he feels alive even in quiet mode
      setSpeaking(true);
      window.setTimeout(() => setSpeaking(false), 1100);
      return;
    }
    try {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.06;
      u.pitch = 1.02;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    } catch {
      // ignore
    }
  }

  function systemTipFor(panelId: string) {
    const id = normalizePanelId(panelId);
    if (id === "Trading") return "Locked in. Want a quick scan + best-contract highlight? Hit the command bar: ‘Trading HUD go’.";
    if (id === "Grow") return "Grow vibes. Add a ‘Feed’ or ‘Flip’ reminder to Calendar so you never miss a beat.";
    if (id === "FamilyBudget") return "Budget mode. If you schedule bill due dates in Calendar, Home will warn you early.";
    if (id === "Books") return "Writer’s Lounge time. Want me to outline the next chapter or punch up dialogue? Ask me in this bubble.";
    if (id === "Entertainment") return "Family Night ready. Add a ‘Tonight: Family Night’ event so Mission Control stays live.";
    if (id === "Home") return "Mission Control online. I can roam and nudge you when events are coming up.";
    return "Need anything? I can open panels, focus the command bar, or help plan your next move.";
  }

  // Chatter on panel change.
  const lastPanelRef = useRef<string>(normalizePanelId(activePanelId));
  useEffect(() => {
    const next = normalizePanelId(activePanelId);
    const prev = lastPanelRef.current;
    if (next === prev) return;
    lastPanelRef.current = next;
    if (!enabled || !chatterEnabled) return;
    // small delay so it feels natural
    const t = window.setTimeout(() => {
      say(systemTipFor(next));
    }, 420);
    return () => window.clearTimeout(t);
  }, [activePanelId, enabled, chatterEnabled]);

  // Calendar nudges.
  const lastNudgeRef = useRef<string>("");
  useEffect(() => {
    if (!enabled || !chatterEnabled) return;

    const check = () => {
      const upcoming = listUpcoming({ limit: 8 });
      const next = upcoming.find((e) => {
        const ms = msUntil(e.date, e.time);
        return Number.isFinite(ms) && ms > 0 && ms < 12 * 60 * 1000; // within 12 min
      });
      if (!next) return;
      const key = `${next.id}:${next.date}:${next.time || ""}`;
      if (lastNudgeRef.current === key) return;
      lastNudgeRef.current = key;
      const ms = msUntil(next.date, next.time);
      const eta = fmtEta(ms);
      say(`Heads up — “${next.title}” ${eta}. Want me to open ${next.panelId ? getPanelMeta(next.panelId).title : "Calendar"}?`, { forceOpen: false });
    };

    const onCal = () => check();
    window.addEventListener(CALENDAR_EVENT, onCal as any);
    const interval = window.setInterval(check, 60 * 1000);
    // initial
    check();

    return () => {
      window.removeEventListener(CALENDAR_EVENT, onCal as any);
      window.clearInterval(interval);
    };
  }, [enabled, chatterEnabled]);

  // Movement loop.
  useEffect(() => {
    if (!enabled) return;
    const el = rootRef.current;
    if (!el) return;

    const pickTarget = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const pad = 20;
      const spriteW = 120 * scale;
      const spriteH = 160 * scale;
      const x = Math.random() * (w - spriteW - pad * 2) + pad;
      const y = Math.random() * (h - spriteH - pad * 2) + pad;
      const dwell = 1400 + Math.random() * 2200;
      tgtRef.current = { x, y, until: Date.now() + dwell };
    };

    const step = (ts: number) => {
      if (!lastTickRef.current) lastTickRef.current = ts;
      const dt = Math.min(0.05, (ts - lastTickRef.current) / 1000);
      lastTickRef.current = ts;

      if (!enabled) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const dragging = !!draggingRef.current;

      if (!dragging && roamEnabled) {
        if (!tgtRef.current || Date.now() > tgtRef.current.until) pickTarget();
        const tgt = tgtRef.current;
        if (tgt) {
          const pos = posRef.current;
          const dx = tgt.x - pos.x;
          const dy = tgt.y - pos.y;
          const dist = Math.hypot(dx, dy);
          const maxStep = speed * dt;
          if (dist > 1) {
            const nx = dx / dist;
            const ny = dy / dist;
            const move = Math.min(maxStep, dist);
            pos.x += nx * move;
            pos.y += ny * move;
            if (Math.abs(dx) > 0.5) facingRef.current = dx < 0 ? "left" : "right";
            walkingRef.current = dist > 6;
          } else {
            walkingRef.current = false;
          }
        }
      } else {
        walkingRef.current = false;
      }

      // bounds
      {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const pad = 10;
        const spriteW = 120 * scale;
        const spriteH = 160 * scale;
        posRef.current.x = clamp(posRef.current.x, pad, Math.max(pad, w - spriteW - pad));
        posRef.current.y = clamp(posRef.current.y, pad, Math.max(pad, h - spriteH - pad));
      }

      // apply styles directly (no re-render per frame)
      const { x, y } = posRef.current;
      const walk = walkingRef.current;
      const face = facingRef.current;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
      el.classList.toggle("walking", walk);
      el.classList.toggle("speaking", speaking);
      el.classList.toggle("face-left", face === "left");

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, roamEnabled, speed, scale, speaking]);

  // Drag behavior
  useEffect(() => {
    if (!enabled) return;

    const onMove = (e: PointerEvent) => {
      const drag = draggingRef.current;
      if (!drag) return;
      posRef.current.x = e.clientX - drag.dx;
      posRef.current.y = e.clientY - drag.dy;
      const el = rootRef.current;
      if (el) {
        el.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0) scale(${scale})`;
        el.classList.toggle("face-left", facingRef.current === "left");
      }
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      persistPos();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [enabled, scale]);

  function beginDrag(e: React.PointerEvent) {
    if (!enabled) return;
    const rect = rootRef.current?.getBoundingClientRect();
    const baseX = rect?.left ?? posRef.current.x;
    const baseY = rect?.top ?? posRef.current.y;
    draggingRef.current = { dx: e.clientX - baseX, dy: e.clientY - baseY };
    try { (e.target as any)?.setPointerCapture?.(e.pointerId); } catch {}
  }

  async function askAi(text: string) {
    const cleaned = text.trim();
    if (!cleaned) return;

    const userMsg: BubbleMsg = { id: nowId(), role: "user", text: cleaned, ts: Date.now() };
    setMsgs((prev) => [...prev.slice(-14), userMsg]);
    setInput("");

    setThinking(true);
    try {
      const system = "You are Lil Homie — a hype Fortnite-mascot assistant inside FairlyOdd OS. Be concise, friendly, and action-oriented. Give 1-3 bullet steps max.";
      const payload = {
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Active panel: ${normalizePanelId(activePanelId)}\nUser request: ${cleaned}` },
        ],
        temperature: 0.6,
      };
      const res = await oddApi().homieChat(payload as any);
      if (!res?.ok || !res?.reply) {
        say("AI is offline in this mode. If you’re in Desktop, start the local Homie model (Ollama) and try again.");
        return;
      }
      say(res.reply, { forceOpen: true });
    } catch (e: any) {
      say(`AI error: ${String(e?.message || e)}`);
    } finally {
      setThinking(false);
    }
  }

  function quickToggleEnabled(next: boolean) {
    const updated = loadPrefs();
    (updated.ai as any).homieLilEnabled = next;
    savePrefs(updated);
    setPrefs(updated);
  }

  function quickToggleRoam(next: boolean) {
    const updated = loadPrefs();
    (updated.ai as any).homieLilRoam = next;
    savePrefs(updated);
    setPrefs(updated);
  }

  if (!enabled) {
    // small hidden stub in case user wants to re-enable quickly via prefs.
    return null;
  }

  const activeMeta = getPanelMeta(activePanelId);

  return (
    <div className={`lilHomieAgent ${open ? "open" : ""} ${thinking ? "thinking" : ""} ${(lil3d && !threeFailed) ? "lil3d" : ""}`} ref={rootRef}>
      <div className="lilHomieHitbox" onPointerDown={beginDrag} onClick={() => setOpen((v) => !v)} title="Lil Homie (drag or click)">
        <div className="lilAgentFlip" aria-hidden="true">
          <div className="homieLilBody lilAgentBody">
            {lil3d && !threeFailed ? (
              <TinyBoundary onError={() => setThreeFailed(true)}>
                <Suspense fallback={null}>
                  <LilHomie3D hostRef={rootRef as any} energy={energy} />
                </Suspense>
              </TinyBoundary>
            ) : (
              <>
                <div className="homieLilHead lilAgentHead">
                  <img src={homieMascot} className="lilAgentHeadImg" alt="Lil Homie" draggable={false} />
                </div>
                <div className="homieLilNeck" />
                <div className="homieLilTorso">
                  <div className="homieLilPocket" />
                </div>
                <span className="homieLilArm left"><span className="homieLilHand" /></span>
                <span className="homieLilArm right"><span className="homieLilHand" /></span>
                <span className="homieLilLeg left"><span className="homieLilShoe" /></span>
                <span className="homieLilLeg right"><span className="homieLilShoe" /></span>
              </>
            )}
          </div>
        </div>
        <div className="lilHomieName">Lil Homie</div>
      </div>

      {open && (
        <div className="lilHomieBubble" onClick={(e) => e.stopPropagation()}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div className="h" style={{ fontSize: 14, marginBottom: 2 }}>🐦‍🔥 Lil Homie</div>
              <div className="small" style={{ opacity: 0.85 }}>Active: {activeMeta.icon} {activeMeta.title}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="tabBtn" onClick={() => quickToggleRoam(!roamEnabled)}>{roamEnabled ? "Roam: On" : "Roam: Off"}</button>
              <button className="tabBtn" onClick={() => setOpen(false)}>Hide</button>
            </div>
          </div>

          <div className="lilHomieMsgs">
            {msgs.slice(-10).map((m) => (
              <div key={m.id} className={`lilMsg ${m.role}`}>
                <div className="lilMsgBubble">{m.text}</div>
              </div>
            ))}
            {thinking && (
              <div className="lilMsg assistant">
                <div className="lilMsgBubble">Thinking…</div>
              </div>
            )}
          </div>

          <div className="lilHomieActions">
            <button className="tabBtn" onClick={() => onNavigate("Calendar")}>Calendar</button>
            <button className="tabBtn" onClick={() => window.dispatchEvent(new CustomEvent("oddengine:focus-commandbar"))}>Command bar</button>
            <button className="tabBtn" onClick={() => onNavigate("Homie")}>Open Homie</button>
            <button className="tabBtn" onClick={() => onNavigate("Books")}>Writer’s Lounge</button>
          </div>

          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <input
              className="lilHomieInput"
              value={input}
              placeholder="Ask Lil Homie…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") askAi(input);
              }}
            />
            <button onClick={() => askAi(input)} disabled={!input.trim() || thinking}>Ask</button>
          </div>

          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10 }}>
            <div className="small" style={{ opacity: 0.8 }}>Tip: drag me anywhere. I’ll avoid chaos and roam when enabled.</div>
            <button className="tabBtn" onClick={() => { quickToggleEnabled(false); }}>Disable</button>
          </div>
        </div>
      )}
    </div>
  );
}
