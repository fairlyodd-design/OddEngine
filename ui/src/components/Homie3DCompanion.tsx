import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isDesktop, oddApi } from "../lib/odd";

// data-homie-3d-companion=v10.36.61
// data-homie-mic-camera-presence=v10.36.61
// data-homie-camera-truth-layer=v10.36.61
// data-homie-3d-typecheck-hotfix=v10.36.61b
// data-homie-soft-body-avatar=v10.36.62
// data-homie-not-orb-mode=v10.36.62

type Mood = "calm" | "listening" | "thinking" | "speaking" | "watching" | "error";

type CameraState = {
  state: "off" | "starting" | "ready" | "error";
  message: string;
  brightness: number;
  motion: number;
  lastSeenAt?: number;
};

type MicState = {
  state: "off" | "requesting" | "ready" | "listening" | "error";
  message: string;
  transcript: string;
  interim: string;
  engine: "speech-recognition" | "permission-only" | "none";
};

type CompanionMessage = {
  id: string;
  role: "you" | "homie" | "system";
  text: string;
  ts: number;
};

type Props = {
  activePanelId?: string;
  onNavigate: (panelId: string) => void;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
}

function roundPct(n: number) {
  return Math.round(clamp(n) * 100);
}

function stopStream(stream: MediaStream | null) {
  try {
    stream?.getTracks?.().forEach((track) => track.stop());
  } catch {
    // ignore
  }
}

function cameraTruth(camera: CameraState) {
  if (camera.state !== "ready") return "Camera is not active. Do not claim visual observations.";
  return [
    "Camera is active, but only simple local signals are available.",
    "Allowed observations: brightness level and rough movement amount only.",
    "Do not identify faces, people, objects, emotions, text, locations, or private details.",
    `Brightness: ${roundPct(camera.brightness)}%.`,
    `Motion: ${roundPct(camera.motion)}%.`,
  ].join(" ");
}

function fallbackCompanionReply(prompt: string, camera: CameraState, activePanelId?: string) {
  const p = prompt.toLowerCase();
  const panel = activePanelId || "Home";
  if (p.includes("camera") || p.includes("see") || p.includes("look")) {
    return camera.state === "ready"
      ? `I have the camera lane on, but I’m keeping it honest: I can only sense rough brightness (${roundPct(camera.brightness)}%) and movement (${roundPct(camera.motion)}%). I’m not identifying people or objects yet.`
      : "Camera is off right now. Turn it on and I can use a safe local signal layer: brightness and rough movement only.";
  }
  if (p.includes("where") || p.includes("panel") || p.includes("next")) {
    return `I’m here. Current panel is ${panel}. Best move: tell me what you want to do, or use the quick route buttons and I’ll keep it plain-English.`;
  }
  return "I’m here with you. Mic/cam presence is staged, and the local AI lane will give the deeper answer when Desktop/Ollama is available.";
}

function HomieAvatarScene({ mood, talking, cameraReady, micLive }: { mood: Mood; talking: boolean; cameraReady: boolean; micLive: boolean }) {
  const root = useRef<THREE.Group | null>(null);
  const head = useRef<THREE.Mesh | null>(null);
  const torso = useRef<THREE.Mesh | null>(null);
  const chestCore = useRef<THREE.Mesh | null>(null);
  const aura = useRef<THREE.Mesh | null>(null);
  const leftEye = useRef<THREE.Mesh | null>(null);
  const rightEye = useRef<THREE.Mesh | null>(null);
  const mouth = useRef<THREE.Mesh | null>(null);
  const leftArm = useRef<THREE.Group | null>(null);
  const rightArm = useRef<THREE.Group | null>(null);
  const leftWing = useRef<THREE.Mesh | null>(null);
  const rightWing = useRef<THREE.Mesh | null>(null);
  const antenna = useRef<THREE.Group | null>(null);

  useFrame(({ clock, mouse }) => {
    const t = clock.getElapsedTime();
    const breathe = Math.sin(t * 1.7) * 0.035;
    const alert = mood === "listening" ? 0.1 : mood === "thinking" ? 0.065 : mood === "speaking" ? 0.085 : mood === "watching" ? 0.05 : 0.025;

    if (root.current) {
      root.current.position.y = breathe * 0.55;
      root.current.rotation.y = Math.sin(t * 0.38) * 0.08 + mouse.x * 0.08;
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.72) * 0.18 + mouse.x * 0.14;
      head.current.rotation.x = Math.sin(t * 0.55) * 0.07 - mouse.y * 0.06;
      head.current.position.y = 0.8 + breathe;
    }
    if (torso.current) {
      torso.current.scale.set(1 + breathe * 0.26, 1 + breathe * 0.72, 1 + breathe * 0.26);
      torso.current.rotation.y = Math.sin(t * 0.45) * 0.045;
    }
    if (chestCore.current) {
      const core = 1 + Math.sin(t * 3.2) * 0.08 + alert;
      chestCore.current.scale.setScalar(core);
    }
    if (aura.current) {
      const s = 1.48 + Math.sin(t * 1.05) * 0.05 + alert;
      aura.current.scale.set(s * 0.82, s * 1.08, s * 0.82);
      aura.current.rotation.z = Math.sin(t * 0.35) * 0.04;
    }
    if (leftArm.current && rightArm.current) {
      leftArm.current.rotation.z = 0.32 + Math.sin(t * 1.2) * 0.055 + (micLive ? 0.08 : 0);
      rightArm.current.rotation.z = -0.32 - Math.sin(t * 1.12) * 0.055 - (talking ? 0.12 : 0);
      rightArm.current.rotation.x = talking ? Math.sin(t * 7) * 0.08 : 0;
    }
    if (leftWing.current && rightWing.current) {
      const flap = Math.sin(t * (cameraReady || micLive ? 2.15 : 1.25)) * 0.055;
      leftWing.current.rotation.y = -0.48 + flap;
      rightWing.current.rotation.y = 0.48 - flap;
    }
    if (leftEye.current && rightEye.current) {
      const x = Math.sin(t * 0.85) * 0.018 + mouse.x * 0.018;
      const y = Math.cos(t * 0.73) * 0.012 - mouse.y * 0.012;
      leftEye.current.position.x = -0.16 + x;
      rightEye.current.position.x = 0.16 + x;
      leftEye.current.position.y = 0.87 + y;
      rightEye.current.position.y = 0.87 + y;
    }
    if (mouth.current) {
      const open = talking ? 0.035 + Math.abs(Math.sin(t * 12)) * 0.095 : mood === "listening" ? 0.035 : 0.018;
      mouth.current.scale.set(0.22, open, 0.035);
    }
    if (antenna.current) {
      antenna.current.rotation.z = Math.sin(t * 0.9) * 0.08;
      antenna.current.rotation.x = Math.cos(t * 0.72) * 0.035;
    }
  });

  const coreColor = mood === "error" ? "#fb7185" : mood === "speaking" ? "#facc15" : mood === "listening" ? "#38bdf8" : mood === "thinking" ? "#a78bfa" : cameraReady ? "#34d399" : "#c4b5fd";
  const auraColor = cameraReady && micLive ? "#22d3ee" : cameraReady ? "#34d399" : micLive ? "#60a5fa" : "#a78bfa";

  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[2.3, 3.2, 3.4]} intensity={2.4} />
      <pointLight position={[-2.4, 0.4, 2.3]} intensity={0.85} color="#a78bfa" />
      <pointLight position={[0, -1.6, 1.8]} intensity={0.55} color="#22d3ee" />

      <mesh ref={aura} position={[0, -0.08, -0.2]}>
        <sphereGeometry args={[1.18, 64, 64]} />
        <meshStandardMaterial color={auraColor} transparent opacity={0.135} roughness={0.32} metalness={0.08} />
      </mesh>

      <group ref={root} position={[0, -0.12, 0]} scale={[1.05, 1.05, 1.05]}>
        <mesh ref={leftWing} position={[-0.52, 0.22, -0.24]} rotation={[0.05, -0.5, 0.3]} scale={[0.7, 0.34, 0.08]}>
          <sphereGeometry args={[0.42, 32, 24]} />
          <meshStandardMaterial color="#7dd3fc" transparent opacity={0.22} roughness={0.24} metalness={0.18} />
        </mesh>
        <mesh ref={rightWing} position={[0.52, 0.22, -0.24]} rotation={[0.05, 0.5, -0.3]} scale={[0.7, 0.34, 0.08]}>
          <sphereGeometry args={[0.42, 32, 24]} />
          <meshStandardMaterial color="#c084fc" transparent opacity={0.2} roughness={0.24} metalness={0.18} />
        </mesh>

        <mesh ref={torso} position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.34, 0.44, 0.88, 42]} />
          <meshStandardMaterial color="#151427" roughness={0.28} metalness={0.56} emissive="#090912" emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[0, 0.26, 0]} scale={[0.56, 0.18, 0.48]}>
          <sphereGeometry args={[0.5, 40, 24]} />
          <meshStandardMaterial color="#21193f" roughness={0.22} metalness={0.48} />
        </mesh>
        <mesh ref={chestCore} position={[0, -0.03, 0.39]}>
          <sphereGeometry args={[0.09, 28, 28]} />
          <meshStandardMaterial color={coreColor} emissive={coreColor} emissiveIntensity={0.9} roughness={0.16} metalness={0.12} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.13, 0.16, 0.18, 26]} />
          <meshStandardMaterial color="#1f1a35" roughness={0.26} metalness={0.42} />
        </mesh>

        <group ref={leftArm} position={[-0.43, 0.2, 0]} rotation={[0.04, 0, 0.34]}>
          <mesh position={[0, -0.28, 0]} rotation={[0, 0, 0.05]}>
            <cylinderGeometry args={[0.07, 0.085, 0.62, 24]} />
            <meshStandardMaterial color="#1f1a35" roughness={0.32} metalness={0.42} />
          </mesh>
          <mesh position={[0.02, -0.63, 0.02]}>
            <sphereGeometry args={[0.095, 24, 20]} />
            <meshStandardMaterial color={coreColor} roughness={0.2} metalness={0.42} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.43, 0.2, 0]} rotation={[0.04, 0, -0.34]}>
          <mesh position={[0, -0.28, 0]} rotation={[0, 0, -0.05]}>
            <cylinderGeometry args={[0.07, 0.085, 0.62, 24]} />
            <meshStandardMaterial color="#1f1a35" roughness={0.32} metalness={0.42} />
          </mesh>
          <mesh position={[-0.02, -0.63, 0.02]}>
            <sphereGeometry args={[0.095, 24, 20]} />
            <meshStandardMaterial color={coreColor} roughness={0.2} metalness={0.42} />
          </mesh>
        </group>

        <mesh position={[-0.17, -0.78, 0]} rotation={[0.06, 0, 0.06]}>
          <cylinderGeometry args={[0.075, 0.095, 0.55, 22]} />
          <meshStandardMaterial color="#141827" roughness={0.34} metalness={0.38} />
        </mesh>
        <mesh position={[0.17, -0.78, 0]} rotation={[0.06, 0, -0.06]}>
          <cylinderGeometry args={[0.075, 0.095, 0.55, 22]} />
          <meshStandardMaterial color="#141827" roughness={0.34} metalness={0.38} />
        </mesh>
        <mesh position={[-0.2, -1.08, 0.08]} scale={[0.18, 0.07, 0.28]}>
          <sphereGeometry args={[0.5, 24, 16]} />
          <meshStandardMaterial color="#23213a" roughness={0.3} metalness={0.36} />
        </mesh>
        <mesh position={[0.2, -1.08, 0.08]} scale={[0.18, 0.07, 0.28]}>
          <sphereGeometry args={[0.5, 24, 16]} />
          <meshStandardMaterial color="#23213a" roughness={0.3} metalness={0.36} />
        </mesh>

        <mesh ref={head} position={[0, 0.8, 0]} scale={[0.86, 0.96, 0.82]}>
          <sphereGeometry args={[0.38, 64, 48]} />
          <meshStandardMaterial color={coreColor} roughness={0.18} metalness={0.62} emissive={coreColor} emissiveIntensity={0.08} />
        </mesh>
        <mesh position={[0, 0.79, 0.325]} scale={[0.62, 0.44, 0.06]}>
          <sphereGeometry args={[0.38, 36, 24]} />
          <meshStandardMaterial color="#f8fafc" transparent opacity={0.18} roughness={0.18} metalness={0.2} />
        </mesh>
        <mesh ref={leftEye} position={[-0.16, 0.87, 0.34]}>
          <sphereGeometry args={[0.055, 28, 24]} />
          <meshStandardMaterial color="#03111d" emissive="#38bdf8" emissiveIntensity={0.55} />
        </mesh>
        <mesh ref={rightEye} position={[0.16, 0.87, 0.34]}>
          <sphereGeometry args={[0.055, 28, 24]} />
          <meshStandardMaterial color="#03111d" emissive="#38bdf8" emissiveIntensity={0.55} />
        </mesh>
        <mesh position={[-0.16, 0.965, 0.337]} rotation={[0, 0, 0.12]} scale={[0.14, 0.025, 0.018]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={0.18} />
        </mesh>
        <mesh position={[0.16, 0.965, 0.337]} rotation={[0, 0, -0.12]} scale={[0.14, 0.025, 0.018]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={0.18} />
        </mesh>
        <mesh ref={mouth} position={[0, 0.68, 0.355]}>
          <sphereGeometry args={[0.09, 24, 12]} />
          <meshStandardMaterial color="#0f172a" emissive="#f8fafc" emissiveIntensity={talking ? 0.18 : 0.04} />
        </mesh>

        <group ref={antenna} position={[0, 1.16, 0]}>
          <mesh position={[0, 0.13, 0]} rotation={[0.32, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.026, 0.34, 16]} />
            <meshStandardMaterial color="#d8b4fe" roughness={0.22} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0.34, 0.055]}>
            <sphereGeometry args={[0.055, 24, 20]} />
            <meshStandardMaterial color={coreColor} emissive={coreColor} emissiveIntensity={0.82} roughness={0.18} metalness={0.2} />
          </mesh>
        </group>
      </group>

      <mesh position={[0, -1.39, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.82, 72]} />
        <meshBasicMaterial color={auraColor} transparent opacity={0.45} />
      </mesh>
    </>
  );
}

export default function Homie3DCompanion({ activePanelId, onNavigate }: Props) {
  const desktop = isDesktop();
  const [mood, setMood] = useState<Mood>("calm");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [talking, setTalking] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<CompanionMessage[]>([
    { id: "boot", role: "system", text: "Homie 3D presence is awake. Mic/cam are opt-in and honest: camera only reports brightness/motion in this pass.", ts: Date.now() },
  ]);

  const [camera, setCamera] = useState<CameraState>({ state: "off", message: "Camera off", brightness: 0, motion: 0 });
  const [mic, setMic] = useState<MicState>({ state: "off", message: "Mic off", transcript: "", interim: "", engine: "none" });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
  const lastSampleRef = useRef(0);

  const micLive = mic.state === "listening" || mic.state === "ready";
  const cameraReady = camera.state === "ready";

  const statusLine = useMemo(() => {
    const cam = cameraReady ? `cam ${roundPct(camera.brightness)}% light / ${roundPct(camera.motion)}% motion` : "cam off";
    const micText = micLive ? `mic ${mic.engine === "speech-recognition" ? "speech" : "permission"}` : "mic off";
    return `${cam} • ${micText} • ${desktop ? "desktop AI ready" : "web fallback"}`;
  }, [camera.brightness, camera.motion, cameraReady, desktop, mic.engine, micLive]);

  useEffect(() => () => {
    stopStream(videoStreamRef.current);
    stopStream(audioStreamRef.current);
    try { recognitionRef.current?.stop?.(); } catch {}
    try { window.speechSynthesis?.cancel?.(); } catch {}
  }, []);

  useEffect(() => {
    if (camera.state !== "ready") return;
    let raf = 0;
    const sample = () => {
      raf = requestAnimationFrame(sample);
      const now = performance.now();
      if (now - lastSampleRef.current < 420) return;
      lastSampleRef.current = now;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const width = 80;
      const height = 45;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
      if (!ctx) return;
      try {
        ctx.drawImage(video, 0, 0, width, height);
        const image = ctx.getImageData(0, 0, width, height);
        const data = image.data;
        let sum = 0;
        let diff = 0;
        const prev = previousFrameRef.current;
        for (let i = 0; i < data.length; i += 4) {
          const lum = (data[i] + data[i + 1] + data[i + 2]) / (255 * 3);
          sum += lum;
          if (prev) diff += Math.abs(data[i] - prev[i]) + Math.abs(data[i + 1] - prev[i + 1]) + Math.abs(data[i + 2] - prev[i + 2]);
        }
        const pixels = data.length / 4;
        previousFrameRef.current = new Uint8ClampedArray(data);
        const brightness = clamp(sum / pixels);
        const motion = clamp(prev ? diff / (pixels * 255 * 3) : 0);
        setCamera((cur) => ({ ...cur, brightness, motion, lastSeenAt: Date.now(), message: motion > 0.12 ? "Movement signal detected" : brightness < 0.18 ? "Low light signal" : "Camera signal steady" }));
      } catch (error: any) {
        setCamera((cur) => ({ ...cur, state: "error", message: String(error?.message || error) }));
        setMood("error");
      }
    };
    raf = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(raf);
  }, [camera.state]);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera((cur) => ({ ...cur, state: "error", message: "Camera API is not available in this runtime." }));
      setMood("error");
      return;
    }
    setCamera((cur) => ({ ...cur, state: "starting", message: "Requesting camera permission…" }));
    setMood("watching");
    try {
      stopStream(videoStreamRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: "user" }, audio: false });
      videoStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => undefined);
      }
      previousFrameRef.current = null;
      setCamera({ state: "ready", message: "Camera active — brightness/motion only", brightness: 0, motion: 0, lastSeenAt: Date.now() });
    } catch (error: any) {
      setCamera((cur) => ({ ...cur, state: "error", message: String(error?.message || error) }));
      setMood("error");
    }
  }

  function stopCamera() {
    stopStream(videoStreamRef.current);
    videoStreamRef.current = null;
    previousFrameRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera({ state: "off", message: "Camera off", brightness: 0, motion: 0 });
    if (!micLive) setMood("calm");
  }

  async function startMic() {
    setMic((cur) => ({ ...cur, state: "requesting", message: "Requesting mic permission…", interim: "" }));
    setMood("listening");
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (Recognition) {
      try {
        const recognition = new Recognition();
        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event: any) => {
          let finalText = "";
          let interimText = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const phrase = event.results[i]?.[0]?.transcript || "";
            if (event.results[i]?.isFinal) finalText += phrase;
            else interimText += phrase;
          }
          if (interimText) setMic((cur) => ({ ...cur, state: "listening", interim: interimText, message: "Listening…" }));
          const cleaned = finalText.trim();
          if (cleaned) {
            setMic((cur) => ({ ...cur, state: "ready", transcript: cleaned, interim: "", message: "Heard you", engine: "speech-recognition" }));
            void askCompanion(cleaned);
          }
        };
        recognition.onerror = (event: any) => {
          setMic((cur) => ({ ...cur, state: "error", message: String(event?.error || "Speech recognition error"), engine: "speech-recognition" }));
          setMood("error");
        };
        recognition.onend = () => {
          setMic((cur) => cur.state === "listening" ? { ...cur, state: "ready", interim: "", message: "Mic ready" } : cur);
          setMood((cur) => cur === "listening" ? "calm" : cur);
        };
        recognitionRef.current = recognition;
        setMic({ state: "listening", message: "Listening…", transcript: "", interim: "", engine: "speech-recognition" });
        recognition.start();
        return;
      } catch (error: any) {
        setMic((cur) => ({ ...cur, state: "error", message: String(error?.message || error), engine: "speech-recognition" }));
      }
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Mic API is not available in this runtime.");
      stopStream(audioStreamRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioStreamRef.current = stream;
      setMic({ state: "ready", message: "Mic permission granted. Browser speech recognition unavailable; use text or global voice bridge.", transcript: "", interim: "", engine: "permission-only" });
      setMood("calm");
    } catch (error: any) {
      setMic((cur) => ({ ...cur, state: "error", message: String(error?.message || error), engine: "none" }));
      setMood("error");
    }
  }

  function stopMic() {
    try { recognitionRef.current?.stop?.(); } catch {}
    recognitionRef.current = null;
    stopStream(audioStreamRef.current);
    audioStreamRef.current = null;
    setMic({ state: "off", message: "Mic off", transcript: "", interim: "", engine: "none" });
    if (!cameraReady) setMood("calm");
  }

  function speak(text: string) {
    if (!ttsEnabled || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 900));
      utterance.rate = 0.96;
      utterance.pitch = 1.02;
      utterance.volume = 0.92;
      utterance.onstart = () => { setTalking(true); setMood("speaking"); };
      utterance.onend = () => { setTalking(false); setMood(cameraReady ? "watching" : "calm"); };
      utterance.onerror = () => { setTalking(false); setMood(cameraReady ? "watching" : "calm"); };
      window.speechSynthesis.speak(utterance);
    } catch { setTalking(false); }
  }

  async function askCompanion(raw?: string) {
    const text = (raw || input).trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMood("thinking");
    setMessages((prev) => [...prev.slice(-12), { id: uid(), role: "you", text, ts: Date.now() }]);
    const context = [
      `Active OddEngine panel: ${activePanelId || "unknown"}.`,
      cameraTruth(camera),
      `Mic state: ${mic.state}; mic engine: ${mic.engine}.`,
      "The user wants Homie to feel warm, alive, practical, family-safe, and clearly non-human.",
    ].join("\n");
    try {
      let reply = "";
      if (desktop) {
        const result = await oddApi().homieChat({
          model: "llama3.1:8b",
          temperature: 0.28,
          system: [
            "You are Homie, a warm non-human AI companion inside FairlyOdd OS.",
            "Be practical, emotionally grounded, and brief.",
            "You may respond to mic/camera context, but never pretend to identify people, faces, objects, private details, or camera observations beyond the explicit brightness/motion signals provided.",
            "If the user asks what you see, explain the honest camera limits.",
          ].join("\n"),
          messages: [{ role: "user", content: `${text}\n\n[Homie 3D mic/cam context]\n${context}` }],
        } as any);
        reply = result?.ok ? String(result.reply || "").trim() : "";
      }
      if (!reply) reply = fallbackCompanionReply(text, camera, activePanelId);
      setMessages((prev) => [...prev.slice(-12), { id: uid(), role: "homie", text: reply, ts: Date.now() }]);
      speak(reply);
    } catch (error: any) {
      const reply = `I hit a local AI hiccup: ${String(error?.message || error)}. The 3D presence is still alive; try typed chat or check Ollama.`;
      setMessages((prev) => [...prev.slice(-12), { id: uid(), role: "homie", text: reply, ts: Date.now() }]);
      setMood("error");
      speak(reply);
    } finally {
      setBusy(false);
      setMood((cur) => cur === "thinking" ? (cameraReady ? "watching" : "calm") : cur);
    }
  }

  return (
    <section className="homie3dShell" data-homie-3d-companion="v10.36.61" data-homie-mic-camera-presence="v10.36.61">
      <style>{`
        .homie3dShell{position:relative;overflow:hidden;border-radius:28px;margin:12px 0 14px;padding:18px;border:1px solid rgba(147,197,253,.22);background:radial-gradient(circle at 18% 12%,rgba(56,189,248,.22),transparent 30%),radial-gradient(circle at 82% 10%,rgba(168,85,247,.18),transparent 34%),linear-gradient(135deg,rgba(8,13,28,.96),rgba(20,21,42,.92));box-shadow:0 28px 80px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.08)}
        .homie3dGrid{display:grid;grid-template-columns:minmax(280px,.95fr) minmax(320px,1.05fr);gap:16px;align-items:stretch}.homie3dStage{min-height:440px;border-radius:26px;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,.10);background:radial-gradient(circle at 50% 40%,rgba(125,211,252,.14),transparent 32%),linear-gradient(180deg,rgba(15,23,42,.72),rgba(3,7,18,.78))}.homie3dCanvas{position:absolute;inset:0}.homie3dStageBadges{position:absolute;left:14px;top:14px;display:flex;gap:8px;flex-wrap:wrap;z-index:2}.homie3dPill{border-radius:999px;padding:6px 10px;font-size:12px;border:1px solid rgba(255,255,255,.12);background:rgba(15,23,42,.66);color:rgba(255,255,255,.88);backdrop-filter:blur(12px)}.homie3dPill.good{border-color:rgba(52,211,153,.34);color:#bbf7d0}.homie3dPill.warn{border-color:rgba(250,204,21,.34);color:#fef3c7}.homie3dPill.bad{border-color:rgba(251,113,133,.34);color:#fecdd3}.homie3dCamPreview{position:absolute;right:14px;bottom:14px;width:128px;height:78px;object-fit:cover;border-radius:16px;border:1px solid rgba(255,255,255,.16);box-shadow:0 16px 40px rgba(0,0,0,.32);transform:scaleX(-1);background:rgba(15,23,42,.72);z-index:2}.homie3dControls{display:flex;flex-direction:column;gap:12px}.homie3dCard{border-radius:22px;padding:14px;border:1px solid rgba(255,255,255,.10);background:rgba(15,23,42,.52)}.homie3dTitle{font-weight:900;letter-spacing:.01em}.homie3dSub{font-size:12px;opacity:.76;line-height:1.35;margin-top:4px}.homie3dRow{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.homie3dBtn{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:rgba(255,255,255,.9);border-radius:999px;padding:8px 11px;cursor:pointer}.homie3dBtn:hover{background:rgba(255,255,255,.10)}.homie3dBtn.active{border-color:rgba(56,189,248,.44);background:rgba(14,165,233,.18)}.homie3dBtn.danger{border-color:rgba(251,113,133,.40);background:rgba(244,63,94,.12)}.homie3dInput{width:100%;min-height:78px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(2,6,23,.55);color:rgba(255,255,255,.92);padding:10px;resize:vertical}.homie3dTranscript{max-height:184px;overflow:auto;display:grid;gap:8px;padding-right:3px}.homie3dMsg{border-radius:16px;padding:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.055);white-space:pre-wrap;font-size:13px;line-height:1.35}.homie3dMsg.you{border-color:rgba(56,189,248,.22)}.homie3dMsg.homie{border-color:rgba(52,211,153,.22)}.homie3dMeter{height:8px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08)}.homie3dMeter>span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,rgba(56,189,248,.75),rgba(52,211,153,.85))}@media(max-width:860px){.homie3dGrid{grid-template-columns:1fr}.homie3dStage{min-height:360px}}
      `}</style>
      <div className="homie3dGrid">
        <div className="homie3dStage">
          <div className="homie3dStageBadges">
            <span className="homie3dPill good" data-homie-not-orb-mode="v10.36.62">Full body avatar</span>
            <span className={`homie3dPill ${desktop ? "good" : "warn"}`}>{desktop ? "Desktop AI lane" : "Web fallback"}</span>
            <span className={`homie3dPill ${cameraReady ? "good" : camera.state === "error" ? "bad" : ""}`}>{camera.message}</span>
            <span className={`homie3dPill ${micLive ? "good" : mic.state === "error" ? "bad" : ""}`}>{mic.message}</span>
          </div>
          <Canvas className="homie3dCanvas" camera={{ position: [0, 0, 3.4], fov: 46 }}>
            <HomieAvatarScene mood={mood} talking={talking || busy} cameraReady={cameraReady} micLive={micLive} />
          </Canvas>
          <video ref={videoRef} className="homie3dCamPreview" playsInline muted />
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
        <div className="homie3dControls">
          <div className="homie3dCard"><div className="homie3dTitle">Homie 3D Companion — full body mode</div><div className="homie3dSub">Soft non-human 3D companion with face, body, arms, wings, mic/cam presence, and honest camera limits. Definitely not just an orb anymore lol.</div><div className="homie3dRow" style={{ marginTop: 12 }}><button className={`homie3dBtn ${micLive ? "active" : ""}`} onClick={micLive ? stopMic : startMic}>{micLive ? "Stop Mic" : "Start Mic"}</button><button className={`homie3dBtn ${cameraReady ? "active" : ""}`} onClick={cameraReady ? stopCamera : startCamera}>{cameraReady ? "Stop Cam" : "Start Cam"}</button><button className="homie3dBtn" onClick={() => setTtsEnabled((v) => !v)}>Voice out: {ttsEnabled ? "on" : "off"}</button><button className="homie3dBtn danger" onClick={() => { stopMic(); stopCamera(); try { window.speechSynthesis?.cancel?.(); } catch {}; setTalking(false); }}>Privacy off</button></div><div className="homie3dSub" style={{ marginTop: 10 }}>{statusLine}</div></div>
          <div className="homie3dCard" data-homie-camera-truth-layer="v10.36.61"><div className="homie3dTitle">Camera signal</div><div className="homie3dSub">No fake vision. This pass only reads local signal strength.</div><div className="homie3dSub" style={{ marginTop: 10 }}>Brightness {roundPct(camera.brightness)}%</div><div className="homie3dMeter"><span style={{ width: `${roundPct(camera.brightness)}%` }} /></div><div className="homie3dSub" style={{ marginTop: 10 }}>Motion {roundPct(camera.motion)}%</div><div className="homie3dMeter"><span style={{ width: `${roundPct(camera.motion)}%` }} /></div></div>
          <div className="homie3dCard"><div className="homie3dTitle">Talk to Homie</div><div className="homie3dSub">{mic.interim ? `Hearing: ${mic.interim}` : mic.transcript ? `Last heard: ${mic.transcript}` : "Use Start Mic, or type here."}</div><textarea className="homie3dInput" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Homie something…" /><div className="homie3dRow" style={{ marginTop: 8 }}><button className="homie3dBtn active" disabled={busy} onClick={() => askCompanion()}>{busy ? "Thinking…" : "Ask Homie"}</button><button className="homie3dBtn" onClick={() => onNavigate(activePanelId || "Home")}>Open current panel</button><button className="homie3dBtn" onClick={() => onNavigate("Preferences")}>Voice settings</button></div></div>
          <div className="homie3dCard"><div className="homie3dTitle">Presence transcript</div><div className="homie3dTranscript" style={{ marginTop: 10 }}>{messages.slice(-6).map((msg) => (<div key={msg.id} className={`homie3dMsg ${msg.role}`}><b>{msg.role === "you" ? "You" : msg.role === "homie" ? "Homie" : "System"}:</b> {msg.text}</div>))}</div></div>
        </div>
      </div>
    </section>
  );
}
