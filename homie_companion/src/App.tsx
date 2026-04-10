import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvatarLoaderCard } from "./components/AvatarLoaderCard";
import { CompanionControls } from "./components/CompanionControls";
import { CompanionConversation } from "./components/CompanionConversation";
import { CompanionHeader } from "./components/CompanionHeader";
import { CompanionStatusBar } from "./components/CompanionStatusBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { EventConsole } from "./components/EventConsole";
import { HomieShell } from "./components/HomieShell";
import { SceneFallback } from "./components/SceneFallback";
import { demoEvents } from "./lib/events";
import { detectAvatarKind, normalizeAvatarPath } from "./lib/avatarRuntime";
import {
  getBridgeStatus,
  getDesktopStatus,
  getRecentBridgeEvents,
  sendTestEvent,
  subscribeToBridgeEvents
} from "./lib/ipc";
import { getSpeechSupport, speakWithBrowser, speechStubNote, startMicActivityWatch, startVoiceRecognition } from "./lib/speech";
import { buildCompanionReply, getStoryQuickReplies, starterCompanionReply } from "./lib/companionBrain";
import { readStoryBridgeSnapshot, storyBridgeSignature, subscribeStoryBridge, summarizeStoryBridge, type StoryBridgeSnapshot } from "./lib/storyBridge";
import { queueStoryAction, readStoryActions, subscribeStoryActions, storyActionLabel, type StoryActionRequest } from "./lib/storyActionBridge";
import { HomieScene } from "./scene/HomieScene";
import { eventToState } from "./state/animationMachine";
import { useCompanionStore } from "./state/companionStore";
import type { HomieState } from "./types/homie";

type ConversationRow = { role: "assistant" | "user"; text: string; bullets?: string[] };
type VoiceMode = "single" | "loop";

export default function App() {
  const [sceneBootKey, setSceneBootKey] = useState(0);
  const [safeMode, setSafeMode] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [storyBridge, setStoryBridge] = useState<StoryBridgeSnapshot | null>(() => readStoryBridgeSnapshot());
  const [conversation, setConversation] = useState<ConversationRow[]>(() => {
    const welcome = starterCompanionReply(readStoryBridgeSnapshot());
    return [{ role: "assistant", text: welcome.body, bullets: welcome.bullets }];
  });
  const [quickReplies, setQuickReplies] = useState(() => starterCompanionReply(readStoryBridgeSnapshot()).quickReplies);
  const [storyActions, setStoryActions] = useState<StoryActionRequest[]>(() => readStoryActions());
  const recognitionRef = useRef<null | { stop: () => void }>(null);
  const speechRef = useRef<null | { stop: () => void }>(null);
  const bargeMonitorRef = useRef<null | { stop: () => void }>(null);
  const loopTimerRef = useRef<number | null>(null);
  const bargeTimerRef = useRef<number | null>(null);
  const speechGuardTimerRef = useRef<number | null>(null);
  const loopActiveRef = useRef(false);
  const isRespondingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const speechInterruptedRef = useRef(false);
  const storyBridgeSignatureRef = useRef(storyBridgeSignature(readStoryBridgeSnapshot()));
  const storyActionSignatureRef = useRef("none");
  const speechSupport = useMemo(() => getSpeechSupport(), []);
  const latestProjectAction = useMemo(() => storyActions.find((action) => action.projectId === storyBridge?.projectId) || null, [storyActions, storyBridge?.projectId]);
  const pendingProjectActions = useMemo(() => storyActions.filter((action) => action.projectId === storyBridge?.projectId && (action.status === "pending" || action.status === "running")), [storyActions, storyBridge?.projectId]);

  const {
    state,
    message,
    bridgeStatus,
    desktopStatus,
    recentEvents,
    avatar,
    speech,
    setState,
    setBridgeStatus,
    setDesktopStatus,
    pushEvent,
    setRecentEvents,
    setAvatarSource,
    setAvatarScale,
    setAvatarLoading,
    setAvatarReady,
    setAvatarError,
    useFallbackAvatar,
    setSpeechListening,
    setSpeechSpeaking,
    setSpeechLoop,
    setSpeechBubble,
    setSpeechAmplitude,
    setSpeechBargeState,
    setSpeechWarmingMic,
    setSpeechError,
    clearSpeechBubble
  } = useCompanionStore();

  const setLoopActive = useCallback((active: boolean) => {
    loopActiveRef.current = active;
    setSpeechLoop(active);
  }, [setSpeechLoop]);

  const clearLoopTimer = useCallback(() => {
    if (loopTimerRef.current !== null) {
      window.clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  }, []);

  const clearBargeTimer = useCallback(() => {
    if (bargeTimerRef.current !== null) {
      window.clearTimeout(bargeTimerRef.current);
      bargeTimerRef.current = null;
    }
  }, []);

  const clearSpeechGuardTimer = useCallback(() => {
    if (speechGuardTimerRef.current !== null) {
      window.clearTimeout(speechGuardTimerRef.current);
      speechGuardTimerRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  const stopSpeech = useCallback(() => {
    clearSpeechGuardTimer();
    speechRef.current?.stop();
    speechRef.current = null;
  }, [clearSpeechGuardTimer]);

  const stopBargeMonitor = useCallback(() => {
    clearBargeTimer();
    bargeMonitorRef.current?.stop();
    bargeMonitorRef.current = null;
    setSpeechBargeState(false, false);
  }, [clearBargeTimer, setSpeechBargeState]);

  const cancelSpeechForOverride = useCallback(() => {
    if (!speechRef.current) return;
    speechInterruptedRef.current = true;
    stopSpeech();
  }, [stopSpeech]);

  useEffect(() => {
    isRespondingRef.current = isResponding;
  }, [isResponding]);

  useEffect(() => {
    isSpeakingRef.current = speech.speaking;
  }, [speech.speaking]);

  useEffect(() => {
    loopActiveRef.current = speech.loopActive;
  }, [speech.loopActive]);


  useEffect(() => {
    const applyStoryBridge = (next: StoryBridgeSnapshot | null) => {
      const nextSignature = storyBridgeSignature(next);
      if (nextSignature === storyBridgeSignatureRef.current) return;
      storyBridgeSignatureRef.current = nextSignature;
      setStoryBridge(next);
      if (!next) {
        setQuickReplies(starterCompanionReply().quickReplies);
        return;
      }

      setQuickReplies(getStoryQuickReplies(next));
      const syncLine = next.homieCue?.trim()
        ? `Story Forge sync live: ${summarizeStoryBridge(next)}. ${next.homieCue.trim()}`
        : `Story Forge sync live: ${summarizeStoryBridge(next)}.`;
      setConversation((current) => {
        const last = current[current.length - 1];
        if (last?.role === "assistant" && last.text === syncLine) return current;
        return [
          ...current,
          {
            role: "assistant",
            text: syncLine,
            bullets: [
              `Resume point: ${next.resumeFrom}`,
              `Preview: ${next.roomPreviewTitle || next.summary}`,
              `Release target: ${next.releaseTarget}`
            ]
          }
        ];
      });
      setState("talking", {
        title: "Story Forge synced",
        body: syncLine
      });
      setSpeechBubble(syncLine);
    };

    const unsubscribe = subscribeStoryBridge(applyStoryBridge);
    const pollId = window.setInterval(() => {
      applyStoryBridge(readStoryBridgeSnapshot());
    }, 1200);

    return () => {
      unsubscribe?.();
      window.clearInterval(pollId);
    };
  }, [setSpeechBubble, setState]);

  useEffect(() => {
    const applyActions = (next: StoryActionRequest[]) => setStoryActions(next);
    const unsubscribe = subscribeStoryActions(applyActions);
    const intervalId = window.setInterval(() => applyActions(readStoryActions()), 1200);
    return () => {
      unsubscribe?.();
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const signature = latestProjectAction ? `${latestProjectAction.id}:${latestProjectAction.status}:${latestProjectAction.updatedAt}` : "none";
    if (signature === storyActionSignatureRef.current) return;
    storyActionSignatureRef.current = signature;
    if (!latestProjectAction || !storyBridge) return;
    if (latestProjectAction.status !== "done" && latestProjectAction.status !== "error") return;
    const line = latestProjectAction.status === "done"
      ? `Story Forge action complete: ${latestProjectAction.resultSummary || storyActionLabel(latestProjectAction.type)}.`
      : `Story Forge action hit a hiccup: ${latestProjectAction.resultDetail || latestProjectAction.resultSummary || storyActionLabel(latestProjectAction.type)}.`;
    setConversation((current) => {
      const last = current[current.length - 1];
      if (last?.role === "assistant" && last.text === line) return current;
      return [...current, { role: "assistant", text: line, bullets: latestProjectAction.resultDetail ? [latestProjectAction.resultDetail] : undefined }];
    });
    setSpeechBubble(line);
    setQuickReplies(getStoryQuickReplies(storyBridge));
    setState(latestProjectAction.status === "done" ? "talking" : "alert", {
      title: latestProjectAction.status === "done" ? "Story action complete" : "Story action hiccup",
      body: line,
    });
  }, [latestProjectAction, setQuickReplies, setSpeechBubble, setState, storyBridge]);

  useEffect(() => {
    void getBridgeStatus().then(setBridgeStatus);
    void getDesktopStatus().then(setDesktopStatus);
    void getRecentBridgeEvents().then(setRecentEvents);

    const unsubscribe = subscribeToBridgeEvents((event) => {
      pushEvent(event);
      const next = eventToState(event);
      setState(next.state, next.message);
      if (event.type === "speech:say" && event.payload?.text) {
        setSpeechBubble(event.payload.text);
      }
    });

    return () => {
      unsubscribe?.();
      clearLoopTimer();
      clearSpeechGuardTimer();
      stopBargeMonitor();
      loopActiveRef.current = false;
      stopRecognition();
      stopSpeech();
    };
  }, [clearLoopTimer, pushEvent, setBridgeStatus, setDesktopStatus, setRecentEvents, setSpeechBubble, setState, stopBargeMonitor, stopRecognition, stopSpeech]);

  async function refreshDesktop() {
    const status = await getDesktopStatus();
    setDesktopStatus(status);
  }

  async function refreshBridge() {
    const status = await getBridgeStatus();
    setBridgeStatus(status);
    const events = await getRecentBridgeEvents();
    setRecentEvents(events);
  }

  async function handleSetState(nextState: HomieState) {
    const event = demoEvents[nextState];
    await sendTestEvent(event);
    await refreshBridge();
  }

  async function handleSendSpeechEvent() {
    await sendTestEvent(demoEvents.talking);
    await refreshBridge();
  }

  async function handleSendAlertEvent() {
    await sendTestEvent(demoEvents.alert);
    await refreshBridge();
  }

  async function handleMoveDisplay() {
    await window.homie.desktop.moveToNextDisplay();
    await refreshDesktop();
  }

  async function handleTogglePin() {
    await window.homie.desktop.toggleAlwaysOnTop();
    await refreshDesktop();
  }

  async function handleResetBounds() {
    await window.homie.desktop.resetBounds();
    await refreshDesktop();
  }

  const handleLoadAvatarPath = useCallback((value: string) => {
    const normalized = normalizeAvatarPath(value);
    const kind = detectAvatarKind(normalized);
    setAvatarSource(normalized);
    if (kind === "fallback") {
      setAvatarError("Avatar path needs a .glb, .gltf, or .vrm file", normalized, kind);
      return;
    }
    setSafeMode(false);
    setSceneBootKey((current) => current + 1);
    setAvatarLoading(normalized, kind);
  }, [setAvatarError, setAvatarLoading, setAvatarSource]);

  const handleAvatarLoading = useCallback((sourceUrl: string) => {
    const kind = detectAvatarKind(sourceUrl);
    setAvatarLoading(sourceUrl, kind);
  }, [setAvatarLoading]);

  const handleAvatarReady = useCallback((sourceUrl: string) => {
    const kind = detectAvatarKind(sourceUrl);
    setAvatarReady({
      sourceUrl,
      kind,
      lastLoadedAt: new Date().toISOString()
    });
  }, [setAvatarReady]);

  const handleAvatarError = useCallback((error: string, sourceUrl: string) => {
    setAvatarError(error, sourceUrl, detectAvatarKind(sourceUrl));
  }, [setAvatarError]);

  function handleRetryScene() {
    setSafeMode(false);
    setSceneBootKey((current) => current + 1);
  }

  function handleUseFallbackBuddy() {
    useFallbackAvatar();
    setSafeMode(true);
  }

  const presenceLabel = useMemo(() => {
    if (safeMode) return "safe mode";
    if (speech.bargingIn) return "cutting back to you";
    if (speech.warmingMic) return "smoothing turn handoff";
    if (speech.loopActive) {
      if (speech.speaking && speech.bargeInReady) return "interruptible talk-back";
      if (speech.warmingMic) return "voice chat reopening";
      return speech.speaking ? "voice chat answering" : speech.listening ? "voice chat open" : "voice chat armed";
    }
    if (speech.listening) return "listening to you";
    if (speech.speaking) return "talking back";
    if (avatar.status === "loading") return "warming up avatar";
    if (!bridgeStatus.ok) return "waiting for bridge";
    switch (state) {
      case "listening":
        return "listening for your next move";
      case "talking":
        return "speaking back";
      case "alert":
        return "watching for a move";
      case "celebrate":
        return "hype mode";
      default:
        return "standing by";
    }
  }, [avatar.status, bridgeStatus.ok, safeMode, speech.bargeInReady, speech.bargingIn, speech.listening, speech.loopActive, speech.speaking, speech.warmingMic, state]);

  const animateSpeechPulse = useCallback((rounds = 1) => {
    let tick = 0;
    const id = window.setInterval(() => {
      tick += 1;
      const pulse = 0.4 + Math.abs(Math.sin(tick * 0.9)) * 0.6;
      setSpeechAmplitude(pulse);
      if (tick > rounds * 14) {
        window.clearInterval(id);
        setSpeechAmplitude(0.1);
      }
    }, 70);
  }, [setSpeechAmplitude]);

  const interruptForBargeIn = useCallback((source: "manual" | "natural" = "manual") => {
    clearLoopTimer();
    stopBargeMonitor();
    stopRecognition();
    cancelSpeechForOverride();
    setSpeechListening(false, "");
    setSpeechSpeaking(false);
    setSpeechAmplitude(0);
    setSpeechError(undefined);
    setSpeechBubble(source === "natural" ? "Got you — cutting back to you now." : "Jump in — Homie is reopening the mic.");
    setState("listening", {
      title: "Jumping back in",
      body: source === "natural"
        ? "You cut in while Homie was talking, so the reply lane stopped and the mic is reopening now."
        : "Homie stopped talking so you can jump back in right away."
    });
    armVoiceRecognition(loopActiveRef.current ? "loop" : "single", source === "natural" ? 140 : 70);
    setSpeechBargeState(false, true);
  }, [cancelSpeechForOverride, clearLoopTimer, setSpeechAmplitude, setSpeechBargeState, setSpeechBubble, setSpeechError, setSpeechListening, setSpeechSpeaking, setState, stopBargeMonitor, stopRecognition]);

  const startBargeMonitor = useCallback(() => {
    if (!loopActiveRef.current || !speechSupport.recognition || !speechSupport.micActivity) return;
    stopBargeMonitor();
    clearBargeTimer();
    bargeTimerRef.current = window.setTimeout(() => {
      void (async () => {
        if (!loopActiveRef.current || !isSpeakingRef.current) return;
        const handle = await startMicActivityWatch({
          onReady: () => {
            setSpeechBargeState(true, false);
          },
          onBargeIn: () => {
            bargeMonitorRef.current = null;
            interruptForBargeIn("natural");
          },
          onError: (detail) => {
            bargeMonitorRef.current = null;
            setSpeechBargeState(false, false);
            if (/AbortError/i.test(detail)) return;
            if (/NotAllowed|PermissionDenied/i.test(detail)) {
              setSpeechError("Live cut-in needs microphone permission. Voice chat still works with Interrupt now.");
              return;
            }
            if (/NotFound/i.test(detail)) {
              setSpeechError("No microphone was found for live cut-in. Voice chat still works with Interrupt now.");
            }
          }
        });
        if (!handle) return;
        if (!loopActiveRef.current || !isSpeakingRef.current) {
          handle.stop();
          return;
        }
        bargeMonitorRef.current = handle;
      })();
    }, 360);
  }, [clearBargeTimer, interruptForBargeIn, setSpeechBargeState, setSpeechError, speechSupport.micActivity, speechSupport.recognition, stopBargeMonitor]);

  useEffect(() => {
    if (!speech.speaking) {
      stopBargeMonitor();
    }
  }, [speech.speaking, stopBargeMonitor]);

  const armVoiceRecognition = useCallback((mode: VoiceMode, delay = 0) => {
    clearLoopTimer();
    stopBargeMonitor();
    const launch = () => {
      if (mode === "loop" && !loopActiveRef.current) return;
      if (isRespondingRef.current || isSpeakingRef.current) return;
      stopRecognition();
      speechInterruptedRef.current = false;
      setSpeechWarmingMic(false);
      setSpeechError(undefined);

      let receivedFinal = false;
      const handle = startVoiceRecognition({
        onStart: () => {
          stopBargeMonitor();
          setSpeechWarmingMic(false);
          setSpeechListening(true, "");
          if (mode === "loop") {
            setSpeechBubble("I'm listening…");
          }
          setState("listening", {
            title: mode === "loop" ? "Voice chat live" : "Listening",
            body: mode === "loop" ? "Open mic is live. Speak naturally, pause when you are done, and cut in if you need to steer the moment." : "Speak naturally. Homie is tuned in."
          });
        },
        onInterim: (text) => {
          setSpeechListening(true, text);
          setSpeechBubble(text);
          setSpeechAmplitude(0.25 + Math.min(text.length / 80, 0.5));
        },
        onFinal: (text) => {
          receivedFinal = true;
          recognitionRef.current = null;
          setSpeechListening(false, "");
          setSpeechAmplitude(0);
          if (text.trim()) {
            respondToUser(text, "voice");
            return;
          }
          if (mode === "loop" && loopActiveRef.current) {
            queueLoopRearm("Your turn — jump in whenever you're ready.", "Homie is reopening the mic so you can keep talking naturally.", 320);
          }
        },
        onEnd: () => {
          recognitionRef.current = null;
          setSpeechListening(false, "");
          setSpeechAmplitude(0);
          if (mode === "loop" && loopActiveRef.current && !receivedFinal && !isRespondingRef.current && !isSpeakingRef.current) {
            queueLoopRearm("Your turn — jump in whenever you're ready.", "Homie is smoothing the handoff and reopening the mic again.", 420);
          }
        },
        onError: (errorText) => {
          recognitionRef.current = null;
          setSpeechError(errorText);
          setSpeechListening(false, "");
          setSpeechAmplitude(0);
          if (mode !== "loop" || !loopActiveRef.current) return;
          if (["not-allowed", "service-not-allowed"].includes(errorText)) {
            setLoopActive(false);
            return;
          }
          if (["aborted", "audio-capture", "network", "no-speech"].includes(errorText)) {
            queueLoopRearm(errorText === "no-speech" ? "I didn't catch anything that round — mic reopening." : "Voice lane hiccup — mic reopening.", errorText === "no-speech" ? "No full phrase came through, so Homie is reopening the mic without making you restart voice chat." : "The browser voice lane hiccuped, so Homie is recovering and reopening the mic for you.", errorText === "no-speech" ? 260 : 640);
            return;
          }
          setLoopActive(false);
        }
      });

      if (!handle && mode === "loop") {
        setLoopActive(false);
        return;
      }

      recognitionRef.current = handle;
    };

    if (delay > 0) {
      loopTimerRef.current = window.setTimeout(launch, delay);
      return;
    }

    launch();
  }, [clearLoopTimer, setLoopActive, setSpeechAmplitude, setSpeechBubble, setSpeechError, setSpeechListening, setState, stopBargeMonitor, stopRecognition]);

  const queueLoopRearm = useCallback((bubbleText: string, detailText: string, delay = 240) => {
    if (!loopActiveRef.current) return;
    setSpeechWarmingMic(true, bubbleText);
    setSpeechBubble(bubbleText);
    setState("listening", { title: "Reopening mic", body: detailText });
    armVoiceRecognition("loop", delay);
  }, [armVoiceRecognition, setSpeechBubble, setSpeechWarmingMic, setState]);

  const estimateSpeechDuration = useCallback((text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    return Math.max(1800, Math.min(14000, words * 360 + chars * 16 + 1100));
  }, []);

  const speakReply = useCallback((text: string, endState: HomieState, resumeLoopAfterSpeech = false) => {
    stopBargeMonitor();
    clearSpeechGuardTimer();
    setSpeechBubble(text);
    let settled = false;

    const settle = (mode: "end" | "error" | "guard", voiceError?: string) => {
      if (settled) return;
      settled = true;
      clearSpeechGuardTimer();
      stopBargeMonitor();
      speechRef.current = null;
      const interrupted = speechInterruptedRef.current;
      speechInterruptedRef.current = false;
      if (interrupted) {
        setSpeechSpeaking(false, "Jumping back to you.");
        setSpeechAmplitude(0);
        setSpeechBargeState(false, false);
        return;
      }
      if (voiceError) {
        setSpeechError(voiceError);
      }
      setSpeechSpeaking(false, text);
      setSpeechAmplitude(0);
      setSpeechBargeState(false, false);
      if (resumeLoopAfterSpeech && loopActiveRef.current) {
        queueLoopRearm(
          voiceError
            ? (mode === "guard" ? "Reply lane drifted — reopening the mic." : "Voice hiccup — reopening the mic.")
            : "Your turn — jump in whenever you're ready.",
          voiceError
            ? (mode === "guard"
              ? "The browser did not send a clean speech-finished signal, so Homie is keeping the conversation moving and reopening the mic."
              : "The browser voice lane glitched, so Homie is recovering and reopening the mic for you.")
            : "Homie finished talking. The mic is reopening so you can jump right back in.",
          voiceError ? 420 : 240,
        );
        return;
      }
      setState(endState, { title: message.title, body: text });
    };

    const handle = speakWithBrowser(text, {
      onStart: () => {
        speechInterruptedRef.current = false;
        setSpeechWarmingMic(false);
        setSpeechBargeState(false, false);
        setSpeechSpeaking(true, text);
        setState("talking", { title: "Talking", body: text });
        animateSpeechPulse(3);
        if (resumeLoopAfterSpeech && loopActiveRef.current) {
          startBargeMonitor();
        }
        speechGuardTimerRef.current = window.setTimeout(() => {
          if (!speechRef.current || speechInterruptedRef.current) return;
          settle("guard", "Speech-finished signal stalled in this browser renderer.");
        }, estimateSpeechDuration(text));
      },
      onBoundary: () => {
        if (!speechInterruptedRef.current) {
          animateSpeechPulse(1);
        }
      },
      onEnd: () => {
        settle("end");
      },
      onError: (voiceError) => {
        if (speechInterruptedRef.current) {
          settle("end");
          return;
        }
        settle("error", voiceError);
      }
    });
    speechRef.current = handle;
    if (!handle) {
      setSpeechWarmingMic(false);
      setSpeechBargeState(false, false);
      setSpeechSpeaking(false, text);
      setSpeechAmplitude(0);
      if (resumeLoopAfterSpeech && loopActiveRef.current) {
        queueLoopRearm("Your turn — jump in whenever you're ready.", "Speech synthesis is missing here, so Homie is skipping straight back to the open mic.", 220);
        return;
      }
      setState(endState, { title: message.title, body: text });
    }
  }, [animateSpeechPulse, clearSpeechGuardTimer, estimateSpeechDuration, message.title, queueLoopRearm, setSpeechAmplitude, setSpeechBargeState, setSpeechBubble, setSpeechError, setSpeechSpeaking, setSpeechWarmingMic, setState, startBargeMonitor, stopBargeMonitor]);

  const queueStoryForgeAction = useCallback((type: StoryActionRequest["type"], noteText?: string) => {
    if (!storyBridge) return null;
    return queueStoryAction({
      type,
      projectId: storyBridge.projectId,
      projectTitle: storyBridge.projectTitle,
      room: storyBridge.activeRoom,
      noteText,
      cue: storyBridge.homieCue || storyBridge.lastActionSummary || storyBridge.resumeFrom,
      requestedBy: "homie",
    });
  }, [storyBridge]);

  const handleSaveLatestNote = useCallback(() => {
    const latest = [...conversation].reverse().find((item) => item.role === "assistant");
    if (!latest || !storyBridge) return;
    const detail = [latest.text, ...(latest.bullets || [])].join("\n- ");
    const queued = queueStoryForgeAction("add-room-note", detail);
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued a room note for ${storyBridge.projectTitle} in ${storyBridge.activeRoom}.`, bullets: ["Books / Story Forge will save this note back into the project."] }]);
  }, [conversation, queueStoryForgeAction, storyBridge]);

  const handleBuildActiveRoom = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("generate-room-packet");
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued a fresh ${storyBridge.activeRoom} packet build for ${storyBridge.projectTitle}.` }]);
  }, [queueStoryForgeAction, storyBridge]);

  const handlePrepRenderPacket = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("prep-render-packet");
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued a Render Lab packet for ${storyBridge.projectTitle}.` }]);
  }, [queueStoryForgeAction, storyBridge]);

  const handleQueueRenderJob = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("create-render-job");
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued a render job request for ${storyBridge.projectTitle}.` }]);
  }, [queueStoryForgeAction, storyBridge]);

  const handleRefreshRenderQueue = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("refresh-render-queue");
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued a render queue refresh for ${storyBridge.projectTitle}.` }]);
  }, [queueStoryForgeAction, storyBridge]);

  const handleImportLatestOutput = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("import-render-output");
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued an output import for ${storyBridge.projectTitle}.` }]);
  }, [queueStoryForgeAction, storyBridge]);

  const handleWatchLatestOutput = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("watch-render-output");
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued output review tracking for ${storyBridge.projectTitle}.` }]);
  }, [queueStoryForgeAction, storyBridge]);

  const latestAssistantNote = useCallback(() => {
    const latest = [...conversation].reverse().find((item) => item.role === "assistant");
    if (!latest) return storyBridge?.latestOutputReviewNote || storyBridge?.homieCue || "";
    return [latest.text, ...(latest.bullets || [])].join("\n- ");
  }, [conversation, storyBridge?.homieCue, storyBridge?.latestOutputReviewNote]);

  const handleSaveOutputReviewNote = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("save-output-review-note", latestAssistantNote());
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued an output review note for ${storyBridge.projectTitle}.` }]);
  }, [latestAssistantNote, queueStoryForgeAction, storyBridge]);

  const handleApproveOutput = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("approve-render-output", latestAssistantNote());
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued an approval stamp for the latest output in ${storyBridge.projectTitle}.` }]);
  }, [latestAssistantNote, queueStoryForgeAction, storyBridge]);

  const handleReviseOutput = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("revise-render-output", latestAssistantNote());
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued a revision decision for the latest output in ${storyBridge.projectTitle}.` }]);
  }, [latestAssistantNote, queueStoryForgeAction, storyBridge]);

  const handleRerenderOutput = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("rerender-render-output", latestAssistantNote());
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued a re-render request for the latest output in ${storyBridge.projectTitle}.` }]);
  }, [latestAssistantNote, queueStoryForgeAction, storyBridge]);

  const handlePrepRevisionLoop = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("prep-revision-loop", latestAssistantNote());
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued a revision loop packet for ${storyBridge.projectTitle}.` }]);
  }, [latestAssistantNote, queueStoryForgeAction, storyBridge]);

  const handlePrepRerenderPacket = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("prep-rerender-packet", latestAssistantNote());
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued a fresh re-render packet for ${storyBridge.projectTitle}.` }]);
  }, [latestAssistantNote, queueStoryForgeAction, storyBridge]);

  const handlePrepPublishPacket = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("prep-publish-packet", latestAssistantNote());
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued a publish packet for ${storyBridge.projectTitle}.` }]);
  }, [latestAssistantNote, queueStoryForgeAction, storyBridge]);

  const handlePrepReleaseBoard = useCallback(() => {
    if (!storyBridge) return;
    const queued = queueStoryForgeAction("prep-release-board", latestAssistantNote());
    if (!queued) return;
    setConversation((current) => [...current, { role: "assistant", text: `Queued a release board for ${storyBridge.projectTitle} with platform targets, teaser assets, metadata, and final output files.` }]);
  }, [latestAssistantNote, queueStoryForgeAction, storyBridge]);

  const respondToUser = useCallback((trimmed: string, source: "typed" | "voice" = "typed") => {
    if (!trimmed) return;
    stopBargeMonitor();
    stopRecognition();
    cancelSpeechForOverride();
    setSpeechBargeState(false, false);
    setConversation((current) => [...current, { role: "user", text: trimmed }]);
    setState("listening", { title: "Listening", body: "Homie is taking in what you need and lining up the cleanest next move." });
    setSpeechBubble(trimmed);
    setIsResponding(true);
    window.setTimeout(() => {
      const reply = buildCompanionReply(trimmed, storyBridge);
      setConversation((current) => [...current, { role: "assistant", text: reply.body, bullets: reply.bullets }]);
      setQuickReplies(reply.quickReplies);
      setState(reply.state, { title: reply.title, body: reply.body });
      setIsResponding(false);
      speakReply(reply.body, reply.state, source === "voice" || loopActiveRef.current);
    }, 280);
  }, [cancelSpeechForOverride, setSpeechBargeState, setSpeechBubble, setState, speakReply, stopBargeMonitor, stopRecognition, storyBridge]);

  const handleReviewLatestOutput = useCallback(() => {
    if (!storyBridge) return;
    respondToUser("Review the latest render output and tell me what to check next.", "typed");
  }, [respondToUser, storyBridge]);

  const handleCompanionSend = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (storyBridge && /save (this|that)? ?note|push (this|that)? ?note|add room note/.test(lower)) {
      handleSaveLatestNote();
      return;
    }
    if (storyBridge && /build active room|build this room|generate room packet|refresh room packet/.test(lower)) {
      handleBuildActiveRoom();
      return;
    }
    if (storyBridge && /prep render|render packet|stage render lab/.test(lower)) {
      handlePrepRenderPacket();
      return;
    }
    if (storyBridge && /queue render|start render job|send to render lab/.test(lower)) {
      handleQueueRenderJob();
      return;
    }
    if (storyBridge && /refresh render queue|sync render queue|check render queue/.test(lower)) {
      handleRefreshRenderQueue();
      return;
    }
    if (storyBridge && /import latest output|import render output|pull in render output/.test(lower)) {
      handleImportLatestOutput();
      return;
    }
    if (storyBridge && /mark watched|review started|watch latest output/.test(lower)) {
      handleWatchLatestOutput();
      return;
    }
    if (storyBridge && /save output note|save review note|stamp output note/.test(lower)) {
      handleSaveOutputReviewNote();
      return;
    }
    if (storyBridge && /approve output|approve latest output|stamp approval/.test(lower)) {
      handleApproveOutput();
      return;
    }
    if (storyBridge && /revise output|needs revision|revision decision/.test(lower)) {
      handleReviseOutput();
      return;
    }
    if (storyBridge && /request re-render|rerender output|re-render output|needs another render/.test(lower)) {
      handleRerenderOutput();
      return;
    }
    if (storyBridge && /prep revision loop|stage revision loop|build next pass/.test(lower)) {
      handlePrepRevisionLoop();
      return;
    }
    if (storyBridge && /prep re-render packet|prep rerender packet|stage next render packet/.test(lower)) {
      handlePrepRerenderPacket();
      return;
    }
    if (storyBridge && /prep publish packet|build publish packet|stage release packet/.test(lower)) {
      handlePrepPublishPacket();
      return;
    }
    if (storyBridge && /review latest output|review the output|how does the output look|review release packet|what should we launch first/.test(lower)) {
      handleReviewLatestOutput();
      return;
    }
    respondToUser(trimmed, "typed");
  }, [handleApproveOutput, handleBuildActiveRoom, handleImportLatestOutput, handlePrepPublishPacket, handlePrepReleaseBoard, handlePrepRenderPacket, handlePrepRerenderPacket, handlePrepRevisionLoop, handleQueueRenderJob, handleRefreshRenderQueue, handleRerenderOutput, handleReviewLatestOutput, handleReviseOutput, handleSaveLatestNote, handleSaveOutputReviewNote, handleWatchLatestOutput, respondToUser, storyBridge]);

  const handleStartVoice = useCallback(() => {
    if (!speechSupport.recognition) {
      setSpeechError("This Chromium build does not expose speech recognition yet.");
      return;
    }
    clearLoopTimer();
    stopBargeMonitor();
    cancelSpeechForOverride();
    setLoopActive(false);
    armVoiceRecognition("single");
  }, [armVoiceRecognition, cancelSpeechForOverride, clearLoopTimer, setLoopActive, setSpeechError, speechSupport.recognition, stopBargeMonitor]);

  const handleStopVoice = useCallback(() => {
    clearLoopTimer();
    stopBargeMonitor();
    stopRecognition();
    setSpeechListening(false, "");
    setSpeechAmplitude(0);
  }, [clearLoopTimer, setSpeechAmplitude, setSpeechListening, stopBargeMonitor, stopRecognition]);

  const handleInterruptVoice = useCallback(() => {
    if (!speechSupport.recognition) {
      setSpeechError("This Chromium build does not expose speech recognition yet.");
      return;
    }
    interruptForBargeIn("manual");
  }, [interruptForBargeIn, setSpeechError, speechSupport.recognition]);

  const handleToggleVoiceLoop = useCallback(() => {
    if (!speechSupport.recognition) {
      setSpeechError("This Chromium build does not expose speech recognition yet.");
      return;
    }
    if (loopActiveRef.current) {
      clearLoopTimer();
      stopBargeMonitor();
      setLoopActive(false);
      stopRecognition();
      cancelSpeechForOverride();
      setSpeechListening(false, "");
      setSpeechWarmingMic(false);
      setSpeechSpeaking(false);
      setSpeechAmplitude(0);
      setSpeechBubble("Voice chat ended. Tap Start voice chat whenever you want the open mic back.");
      setState("idle", { title: "Voice chat ended", body: "Open mic is off. Homie is still here for typed chat or another voice round." });
      return;
    }
    clearSpeechBubble();
    stopBargeMonitor();
    setSpeechError(undefined);
    setLoopActive(true);
    armVoiceRecognition("loop");
  }, [armVoiceRecognition, cancelSpeechForOverride, clearLoopTimer, clearSpeechBubble, setLoopActive, setSpeechAmplitude, setSpeechBubble, setSpeechError, setSpeechListening, setSpeechSpeaking, setState, speechSupport.recognition, stopBargeMonitor, stopRecognition]);

  const sceneOverlay = useMemo(() => {
    if (safeMode) {
      return { title: "Safe mode on", body: "Homie is using the steady fallback lane so the window stays alive while we polish the 3D view." };
    }
    if (avatar.status === "loading") {
      return { title: "Loading avatar", body: avatar.sourceUrl || "Getting the avatar lane ready." };
    }
    if (avatar.status === "error") {
      return { title: "Avatar had a hiccup", body: avatar.error || "Fallback buddy is still available." };
    }
    return null;
  }, [avatar.error, avatar.sourceUrl, avatar.status, safeMode]);

  return (
    <HomieShell>
      <CompanionHeader
        bridgeStatus={bridgeStatus}
        desktopStatus={desktopStatus}
        state={state}
        presenceLabel={presenceLabel}
        onMoveDisplay={handleMoveDisplay}
        onTogglePin={handleTogglePin}
        onResetBounds={handleResetBounds}
        onMinimize={() => void window.homie.desktop.minimize()}
        onClose={() => void window.homie.desktop.close()}
      />

      <div className="layout">
        <div className="scene-column">
          <div className="presence-strip card">
            <div>
              <div className="card-title">Presence</div>
              <h3>{message.title}</h3>
              <p>{message.body}</p>
            </div>
            <div className="status-row">
              <span className={`pill ${bridgeStatus.ok ? "ok" : "warn"}`}>{presenceLabel}</span>
              <span className={`pill ${speech.loopActive ? "ok" : "soft"}`}>{speech.loopActive ? (speech.warmingMic ? "mic reopening" : "open mic live") : safeMode ? "safe fallback" : "live companion"}</span>
              <span className={`pill ${speech.bargeInReady || speech.bargingIn ? "ok" : "soft"}`}>{speech.bargingIn ? "reopening mic" : speech.warmingMic ? "handoff smoothing" : speech.bargeInReady ? "cut-in ready" : "turn stable"}</span>
            </div>
          </div>

          <div className="scene-stage-wrap">
            {safeMode ? (
              <div className="scene-shell">
                <SceneFallback
                  state={state}
                  avatar={avatar}
                  safeMode
                  message="Homie is running in a plain safe view right now so the window stays alive while we sort out the 3D lane."
                  onReenable3D={handleRetryScene}
                />
              </div>
            ) : (
              <div className="scene-shell">
                <ErrorBoundary fallback={<SceneFallback state={state} avatar={avatar} message="The 3D lane tripped. Homie can still hang out in safe mode." onReenable3D={handleRetryScene} /> }>
                  <HomieScene
                    key={sceneBootKey}
                    state={state}
                    avatar={avatar}
                    speechAmplitude={speech.amplitude}
                    onAvatarLoading={handleAvatarLoading}
                    onAvatarReady={handleAvatarReady}
                    onAvatarError={handleAvatarError}
                  />
                </ErrorBoundary>
              </div>
            )}

            {sceneOverlay ? (
              <div className="scene-overlay">
                <div className="scene-overlay-card">
                  <div className="card-title">Companion lane</div>
                  <h3>{sceneOverlay.title}</h3>
                  <p>{sceneOverlay.body}</p>
                </div>
              </div>
            ) : null}

            {speech.bubbleText ? (
              <div className="voice-bubble-overlay">
                <div className={`voice-bubble ${speech.bargingIn ? "barging" : speech.warmingMic ? "warming" : speech.listening ? "listening" : speech.speaking ? "speaking" : "idle"} ${speech.loopActive ? "loop-on" : ""}`}>
                  <div className="voice-bubble-topline">
                    <div className="card-title">{speech.listening ? "You" : "Homie"}</div>
                    {speech.bargingIn ? <span className="voice-loop-chip">Reopening mic</span> : speech.warmingMic ? <span className="voice-loop-chip">Smoothing turn</span> : speech.bargeInReady ? <span className="voice-loop-chip">Cut in anytime</span> : speech.loopActive ? <span className="voice-loop-chip">Open mic</span> : null}
                  </div>
                  <div className="voice-bubble-text">{speech.bargingIn ? "Jumping back to you now…" : speech.warmingMic ? speech.bubbleText : speech.listening ? (speech.interimText || speech.bubbleText) : speech.bubbleText}</div>
                </div>
              </div>
            ) : null}
          </div>

          <CompanionStatusBar
            bridgeStatus={bridgeStatus}
            desktopStatus={desktopStatus}
            avatar={avatar}
            state={state}
          />

          <AvatarLoaderCard
            avatar={avatar}
            onLoadPath={handleLoadAvatarPath}
            onScaleChange={setAvatarScale}
            onUseFallback={handleUseFallbackBuddy}
            onRetry={handleRetryScene}
          />
        </div>

        <div className="panel-column">
          <CompanionConversation
            history={conversation}
            quickReplies={quickReplies}
            isResponding={isResponding}
            isListening={speech.listening}
            isSpeaking={speech.speaking}
            loopActive={speech.loopActive}
            bargeInReady={speech.bargeInReady}
            bargingIn={speech.bargingIn}
            warmingMic={speech.warmingMic}
            interimText={speech.interimText}
            voiceSupported={speechSupport}
            storyBridge={storyBridge}
            latestStoryAction={latestProjectAction}
            pendingStoryActions={pendingProjectActions.length}
            onSend={handleCompanionSend}
            onSaveLatestNote={handleSaveLatestNote}
            onBuildActiveRoom={handleBuildActiveRoom}
            onPrepRenderPacket={handlePrepRenderPacket}
            onQueueRenderJob={handleQueueRenderJob}
            onRefreshRenderQueue={handleRefreshRenderQueue}
            onImportLatestOutput={handleImportLatestOutput}
            onWatchLatestOutput={handleWatchLatestOutput}
            onSaveOutputReviewNote={handleSaveOutputReviewNote}
            onApproveOutput={handleApproveOutput}
            onReviseOutput={handleReviseOutput}
            onRerenderOutput={handleRerenderOutput}
            onPrepRevisionLoop={handlePrepRevisionLoop}
            onPrepRerenderPacket={handlePrepRerenderPacket}
            onPrepPublishPacket={handlePrepPublishPacket}
            onPrepReleaseBoard={handlePrepReleaseBoard}
            onPrepProviderRoute={handlePrepProviderRoute}
            onFinalExportDeliverables={handleFinalExportDeliverables}
            onReviewLatestOutput={handleReviewLatestOutput}
            onStartVoice={handleStartVoice}
            onStopVoice={handleStopVoice}
            onToggleVoiceLoop={handleToggleVoiceLoop}
            onInterruptVoice={handleInterruptVoice}
          />

          <CompanionControls
            state={state}
            speechStubNote={speech.error || speechStubNote()}
            onSetState={handleSetState}
            onSendSpeechEvent={handleSendSpeechEvent}
            onSendAlertEvent={handleSendAlertEvent}
          />

          <EventConsole events={recentEvents} onRefresh={refreshBridge} />
        </div>
      </div>
    </HomieShell>
  );
}
