import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import {
  browserSupportsWakeWord,
  createHomieWakeWordController,
  type HomieVoiceEvent,
  type HomieVoiceMode,
  type HomieWakeWordSettings,
} from "../lib/homieWakeWord";

type VoiceLogItem = {
  id: string;
  role: "system" | "heard" | "homie";
  text: string;
  ts: number;
};

const NOTES_KEY = "oddengine:homie:wakeword:notes:v1";
const LOG_KEY = "oddengine:homie:wakeword:log:v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function modeLabel(mode: HomieVoiceMode) {
  switch (mode) {
    case "idle":
      return "Idle";
    case "listening":
      return "Listening";
    case "processing":
      return "Processing";
    case "speaking":
      return "Speaking";
    case "muted":
      return "Muted";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

function defaultReplyFromTranscript(transcript: string) {
  const text = transcript.toLowerCase();
  if (text.includes("open studio")) return "Opening Studio would be a great next move. Use the quick action to jump there.";
  if (text.includes("open grocery")) return "Got it. Grocery Meals is a solid next stop for budget-aware shopping.";
  if (text.includes("open budget")) return "Family Budget is the right place for household runway and plan checks.";
  if (text.includes("what next")) return "My next-best move is to check your top mission, then open the panel that removes the biggest blocker.";
  return "I heard you. Wake word mode is live, and I am ready for the next action.";
}

export default function Homie() {
  const [voiceMode, setVoiceMode] = useState<HomieVoiceMode>("idle");
  const [settings, setSettings] = useState<HomieWakeWordSettings | null>(null);
  const [notes, setNotes] = useState<string>(() => loadJSON<string>(NOTES_KEY, ""));
  const [log, setLog] = useState<VoiceLogItem[]>(() => loadJSON<VoiceLogItem[]>(LOG_KEY, []));
  const [lastHeard, setLastHeard] = useState("");
  const [lastReply, setLastReply] = useState("");
  const controllerRef = useRef<ReturnType<typeof createHomieWakeWordController> | null>(null);

  useEffect(() => {
    const controller = createHomieWakeWordController((event: HomieVoiceEvent) => {
      if (event.type === "state") {
        setVoiceMode(event.mode);
      }

      if (event.type === "heard") {
        setLastHeard(event.transcript);
        setLog((prev) => [
          {
            id: uid(),
            role: "heard",
            text: `${event.heardWakeWord ? "[wake] " : ""}${event.transcript}`,
            ts: Date.now(),
          },
          ...prev,
        ].slice(0, 40));
      }

      if (event.type === "response-start") {
        setLastReply(event.text);
        setLog((prev) => [
          { id: uid(), role: "homie", text: event.text, ts: Date.now() },
          ...prev,
        ].slice(0, 40));
      }

      if (event.type === "error") {
        setLog((prev) => [
          { id: uid(), role: "system", text: `Voice error: ${event.message}`, ts: Date.now() },
          ...prev,
        ].slice(0, 40));
      }
    });

    controllerRef.current = controller;
    setSettings(controller.getSettings());
    setVoiceMode(controller.getMode());

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    saveJSON(NOTES_KEY, notes);
  }, [notes]);

  useEffect(() => {
    saveJSON(LOG_KEY, log);
  }, [log]);

  const supportLabel = useMemo(
    () => (browserSupportsWakeWord() ? "Supported in this runtime" : "Browser/runtime support not detected"),
    [],
  );

  const updateSettings = (patch: Partial<HomieWakeWordSettings>) => {
    const next = controllerRef.current?.updateSettings(patch);
    if (next) setSettings({ ...next });
  };

  const runWakeTest = async () => {
    const reply = defaultReplyFromTranscript(lastHeard || settings?.wakeWord || "hey homie");
    await controllerRef.current?.speak(reply);
  };

  const startListening = () => controllerRef.current?.startListening();
  const stopListening = () => controllerRef.current?.stopListening();

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card softCard">
        <div className="small shellEyebrow">HOMIE / WAKE WORD + CONVERSATION</div>
        <div className="h mt-2">Mic-driven wake word mode with conversation-ready voice state.</div>
        <div className="sub mt-2">
          This pass gives Homie a local-first wake word foundation, conversation mode, voice status, and
          speech synthesis support without requiring a risky full system rewrite.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          alignItems: "start",
        }}
      >
        <div className="card softCard">
          <div className="small shellEyebrow">VOICE STATUS</div>
          <div className="small mt-2"><b>Mode:</b> {modeLabel(voiceMode)}</div>
          <div className="small mt-2"><b>Wake word support:</b> {supportLabel}</div>
          <div className="small mt-2"><b>Last heard:</b> {lastHeard || "Nothing heard yet."}</div>
          <div className="small mt-2"><b>Last reply:</b> {lastReply || "No spoken reply yet."}</div>

          <div className="row wrap mt-4" style={{ gap: 10 }}>
            <button className="tabBtn active" onClick={startListening}>Start listening</button>
            <button className="tabBtn" onClick={stopListening}>Stop listening</button>
            <button className="tabBtn" onClick={() => void runWakeTest()}>Test reply</button>
          </div>
        </div>

        <div className="card softCard">
          <div className="small shellEyebrow">VOICE SETTINGS</div>

          <label className="small mt-3" style={{ display: "block" }}>
            Wake word
            <input
              className="input mt-2"
              value={settings?.wakeWord || ""}
              onChange={(e) => updateSettings({ wakeWord: e.target.value })}
              placeholder="hey homie"
            />
          </label>

          <div className="row wrap mt-3" style={{ gap: 10 }}>
            <button
              className={`tabBtn ${settings?.enabled ? "active" : ""}`}
              onClick={() => updateSettings({ enabled: !settings?.enabled })}
            >
              {settings?.enabled ? "Wake word on" : "Wake word off"}
            </button>

            <button
              className={`tabBtn ${settings?.conversationMode ? "active" : ""}`}
              onClick={() => updateSettings({ conversationMode: !settings?.conversationMode })}
            >
              {settings?.conversationMode ? "Conversation on" : "Conversation off"}
            </button>

            <button
              className={`tabBtn ${settings?.micEnabled ? "active" : ""}`}
              onClick={() => updateSettings({ micEnabled: !settings?.micEnabled })}
            >
              {settings?.micEnabled ? "Mic on" : "Mic off"}
            </button>

            <button
              className={`tabBtn ${settings?.speakerEnabled ? "active" : ""}`}
              onClick={() => updateSettings({ speakerEnabled: !settings?.speakerEnabled })}
            >
              {settings?.speakerEnabled ? "Speaker on" : "Speaker off"}
            </button>
          </div>

          <div className="note mt-4">
            Voice is local-runtime dependent. Browser speech recognition availability varies by environment.
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          alignItems: "start",
        }}
      >
        <div className="card softCard">
          <div className="small shellEyebrow">CONVERSATION LOG</div>
          {!log.length ? (
            <div className="small mt-3">No wake-word or voice events yet.</div>
          ) : (
            <div className="mt-3" style={{ display: "grid", gap: 10 }}>
              {log.map((item) => (
                <div key={item.id} className="card softCard">
                  <div className="small shellEyebrow">{item.role.toUpperCase()}</div>
                  <div className="small mt-2">{item.text}</div>
                  <div className="small mt-2">{new Date(item.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card softCard">
          <div className="small shellEyebrow">MISSION NOTES</div>
          <textarea
            className="input mt-2"
            rows={12}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Keep quick context notes for Homie here: preferred tone, current mission, things to remember, or what to do when the wake word fires."
          />
        </div>
      </div>
    </div>
  );
}
