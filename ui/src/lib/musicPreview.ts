import { renderViaMusicProvider } from "./musicProviderBridge";

export type MusicStem = "vocals" | "instrumental" | "drums";

export type MusicRenderJob = {
  id: string;
  title: string;
  status: "queued" | "rendering" | "done" | "failed";
  progress: number;
  createdAt: number;
  audioUrl?: string;
  stems?: Record<MusicStem, string>;
  coverArtUrl?: string;
  lyricVideoUrl?: string;
  waveform?: number[];
  provider?: string;
  error?: string;
};

const KEY = "oddengine:music:renderjobs:v1";

function load(): MusicRenderJob[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(v: MusicRenderJob[]) {
  localStorage.setItem(KEY, JSON.stringify(v));
}

function updateJob(id: string, patch: Partial<MusicRenderJob>) {
  const jobs = load();
  const job = jobs.find((x) => x.id === id);
  if (!job) return null;
  Object.assign(job, patch);
  save(jobs);
  return job;
}

function makeToneWavDataUrl(freq = 220, seconds = 2.4) {
  const sampleRate = 22050;
  const samples = Math.max(1, Math.floor(sampleRate * seconds));
  const bytesPerSample = 2;
  const dataSize = samples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, i / 2000) * Math.max(0.15, 1 - i / samples);
    const sample =
      0.42 * Math.sin(2 * Math.PI * freq * t) +
      0.22 * Math.sin(2 * Math.PI * freq * 2 * t) +
      0.12 * Math.sin(2 * Math.PI * freq * 0.5 * t);
    const value = Math.max(-1, Math.min(1, sample * env));
    view.setInt16(offset, Math.floor(value * 32767), true);
    offset += 2;
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}


function makeWavDataUrlFromSamples(samples: number[], sampleRate = 22050) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  let peak = 0.001;
  for (const s of samples) peak = Math.max(peak, Math.abs(s || 0));
  const gain = Math.min(0.95 / peak, 1.8);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, (samples[i] || 0) * gain));
    view.setInt16(offset, Math.floor(value * 32767), true);
    offset += 2;
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function buildProceduralSongBundle(seedFreq = 220, bpm = 118) {
  const sampleRate = 22050;
  const beatDur = 60 / Math.max(70, Math.min(180, Number(bpm) || 118));
  const sections = [2, 4, 4, 4, 4, 2];
  const totalBeats = sections.reduce((a, bars) => a + bars * 4, 0);
  const totalSamples = Math.floor(totalBeats * beatDur * sampleRate);
  const lead = new Array<number>(totalSamples).fill(0);
  const inst = new Array<number>(totalSamples).fill(0);
  const drums = new Array<number>(totalSamples).fill(0);
  const progression = [0, 7, 9, 5];
  const chorusPattern = [4, 4, 5, 7, 4, 2, 0, 2];
  const versePattern = [0, 2, 4, 2, 0, 2, 5, 4];
  const addSine = (buf: number[], start: number, len: number, freq: number, amp: number, attack = 0.01, release = 0.15, detune = 0) => {
    const attackN = Math.max(1, Math.floor(len * attack));
    const releaseN = Math.max(1, Math.floor(len * release));
    const sustainN = Math.max(0, len - attackN - releaseN);
    let phase2 = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      const env = i < attackN ? i / attackN : i < attackN + sustainN ? 1 : Math.max(0, 1 - (i - attackN - sustainN) / releaseN);
      let sample = (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(2 * Math.PI * freq * 2 * t) + 0.1 * Math.sin(2 * Math.PI * freq * 0.5 * t)) / 1.35;
      if (detune) { phase2 += 2 * Math.PI * (freq * (1 + detune)) / sampleRate; sample = (sample + 0.4 * Math.sin(phase2)) / 1.4; }
      const idx = start + i;
      if (idx >= 0 && idx < buf.length) buf[idx] += sample * amp * env;
    }
  };
  const addNoise = (buf: number[], start: number, len: number, amp: number) => {
    let seed = (start * 1103515245 + 12345) & 0x7fffffff;
    for (let i = 0; i < len; i++) {
      seed = (1103515245 * seed + 12345) & 0x7fffffff;
      const white = (seed / 0x7fffffff) * 2 - 1;
      const env = Math.pow(Math.max(0, 1 - i / Math.max(1, len)), 2.6);
      const idx = start + i;
      if (idx >= 0 && idx < buf.length) buf[idx] += white * amp * env;
    }
  };
  let beatIndex = 0;
  const note = (semitones: number, octave = 0) => seedFreq * Math.pow(2, semitones / 12) * Math.pow(2, octave);
  sections.forEach((bars, sectionIdx) => {
    const energy = [0.55, 0.72, 0.95, 0.76, 1.0, 0.55][sectionIdx] || 0.8;
    const pattern = sectionIdx === 2 || sectionIdx === 4 ? chorusPattern : versePattern;
    for (let bar = 0; bar < bars; bar++) {
      const prog = progression[(beatIndex / 4 + bar) % progression.length];
      const barStartBeat = beatIndex + bar * 4;
      const barStart = Math.floor(barStartBeat * beatDur * sampleRate);
      addSine(inst, barStart, Math.floor(beatDur * 4 * sampleRate), note(prog - 12), 0.10 * energy, 0.04, 0.35, 0.003);
      addSine(inst, barStart, Math.floor(beatDur * 4 * sampleRate), note(prog - 5), 0.08 * energy, 0.04, 0.35, -0.002);
      addSine(inst, barStart, Math.floor(beatDur * 4 * sampleRate), note(prog + 2), 0.07 * energy, 0.04, 0.35, 0.001);
      for (let beat = 0; beat < 4; beat++) {
        const start = Math.floor((barStartBeat + beat) * beatDur * sampleRate);
        addSine(inst, start, Math.floor(beatDur * 0.9 * sampleRate), note(prog - 24 + (beat % 2 === 0 ? 0 : 7)), 0.18 * energy, 0.01, 0.25);
        addNoise(drums, start, Math.floor(sampleRate * 0.05), 0.14 + 0.08 * energy);
        if (beat === 0 || beat === 2) addSine(drums, start, Math.floor(sampleRate * 0.28), 90, 0.7 * energy, 0.001, 0.8);
        if (beat === 1 || beat === 3) addNoise(drums, start, Math.floor(sampleRate * 0.18), 0.4 * energy + 0.16);
      }
      for (let step = 0; step < 8; step++) {
        const start = Math.floor((barStartBeat + step * 0.5) * beatDur * sampleRate);
        addSine(lead, start, Math.floor(beatDur * 0.42 * sampleRate), note(pattern[(bar * 8 + step) % pattern.length]), 0.18 * energy + (sectionIdx >= 2 ? 0.05 : 0), 0.02, 0.35, 0.004);
      }
    }
    beatIndex += bars * 4;
  });
  const main = lead.map((v, i) => v + inst[i] + drums[i]);
  const instrumental = inst.map((v, i) => v + drums[i]);
  const waveform = Array.from({ length: 72 }, (_, i) => {
    const start = Math.floor((i / 72) * main.length);
    const end = Math.floor(((i + 1) / 72) * main.length);
    const chunk = main.slice(start, Math.max(start + 1, end));
    const avg = chunk.reduce((a, b) => a + Math.abs(b), 0) / Math.max(1, chunk.length);
    return Math.max(10, Math.min(96, Math.round(avg * 140)));
  });
  return {
    audioUrl: makeWavDataUrlFromSamples(main, sampleRate),
    stems: {
      vocals: makeWavDataUrlFromSamples(lead, sampleRate),
      instrumental: makeWavDataUrlFromSamples(instrumental, sampleRate),
      drums: makeWavDataUrlFromSamples(drums, sampleRate),
    },
    waveform,
  };
}

function makeSvgDataUrl(label: string, accent: string, subtitle: string) {
  const safe = (v: string) => String(v || "").replace(/[<&>"]/g, "");
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#081425"/>
        <stop offset="50%" stop-color="${accent}"/>
        <stop offset="100%" stop-color="#090212"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="1200" fill="url(#g)"/>
    <circle cx="950" cy="210" r="180" fill="rgba(255,255,255,0.08)"/>
    <circle cx="300" cy="880" r="240" fill="rgba(255,255,255,0.05)"/>
    <text x="80" y="230" font-size="84" font-family="Arial, Helvetica, sans-serif" fill="#ffffff" font-weight="700">${safe(label)}</text>
    <text x="86" y="310" font-size="30" font-family="Arial, Helvetica, sans-serif" fill="#d6d6ff">${safe(subtitle)}</text>
    <g transform="translate(90 450)">
      ${Array.from({length: 24}).map((_, i) => {
        const h = 40 + ((i * 37) % 240);
        const y = 260 - h / 2;
        return `<rect x="${i * 38}" y="${y}" width="22" height="${h}" rx="11" fill="rgba(255,255,255,0.82)"/>`;
      }).join("")}
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function makeWaveform(freq = 220) {
  return Array.from({ length: 48 }, (_, i) => Math.max(8, Math.round(28 + 18 * Math.sin((i / 48 * freq) / 22) + 10 * Math.sin((i / 48) * 15))));
}

export function listMusicJobs(): MusicRenderJob[] {
  return load();
}

export function createMusicJob(title: string): MusicRenderJob {
  const baseFreq = 180 + (String(title || "").length % 8) * 25;
  const job: MusicRenderJob = {
    id: Date.now().toString(16) + Math.random().toString(16).slice(2, 8),
    title: title || "Untitled render",
    status: "queued",
    progress: 0,
    createdAt: Date.now(),
    waveform: makeWaveform(baseFreq),
  };
  const jobs = [job, ...load()];
  save(jobs);
  simulate(job.id, baseFreq);
  return job;
}

export async function createMusicJobFromPayload(payload: {
  title: string;
  prompt?: string;
  genre?: string;
  bpm?: string;
  key?: string;
  vibe?: string;
  vocalProfile?: string;
  vocalMode?: string;
  mode?: string;
  enableVocals?: boolean;
  stylePreset?: string;
  lyrics?: string;
  arrangement?: string;
  renderBrief?: string;
  songLengthSec?: number;
  sectionBars?: { intro?: number; verse?: number; chorus?: number; outro?: number };
  sectionDynamics?: {
    intro?: { energy?: number; density?: number; drums?: number; motion?: string };
    verse?: { energy?: number; density?: number; drums?: number; motion?: string };
    chorus?: { energy?: number; density?: number; drums?: number; motion?: string };
    outro?: { energy?: number; density?: number; drums?: number; motion?: string };
  };
}) {
  const title = payload.title || "Untitled render";
  const baseFreq = 180 + (String(title || "").length % 8) * 25;
  const job: MusicRenderJob = {
    id: Date.now().toString(16) + Math.random().toString(16).slice(2, 8),
    title,
    status: "queued",
    progress: 0,
    createdAt: Date.now(),
    waveform: makeWaveform(baseFreq),
  };
  save([job, ...load()]);
  updateJob(job.id, { status: "rendering", progress: 22 });
  try {
    const result = await renderViaMusicProvider(payload);
    if (!result) {
      simulate(job.id, baseFreq, Number(payload.bpm || 118));
      return job;
    }
    const audio = result?.audioUrl || result?.outputs?.[0]?.url || result?.outputs?.[0]?.base64DataUrl || result?.audio?.main || "";
    const stems = result?.stems || {};
    const normalizedStems = {
      vocals: stems?.vocals || "",
      instrumental: stems?.instrumental || "",
      drums: stems?.drums || "",
    };
    updateJob(job.id, {
      status: "done",
      progress: 100,
      audioUrl: audio || makeToneWavDataUrl(baseFreq, 2.8),
      stems: {
        vocals: normalizedStems.vocals || makeToneWavDataUrl(baseFreq * 1.05, 2.2),
        instrumental: normalizedStems.instrumental || makeToneWavDataUrl(baseFreq * 0.78, 2.2),
        drums: normalizedStems.drums || makeToneWavDataUrl(baseFreq * 1.6, 1.4),
      },
      coverArtUrl: result?.coverArtUrl || makeSvgDataUrl(title, "#6a3cff", "Music provider cover"),
      lyricVideoUrl: result?.lyricVideoUrl || makeSvgDataUrl(title, "#0fdc7a", "Music provider lyric video"),
      provider: result?.provider || result?.service || "music-provider",
      waveform: result?.waveform || makeWaveform(baseFreq),
    });
  } catch (e: any) {
    updateJob(job.id, {
      status: "failed",
      progress: 100,
      error: e?.message || String(e),
    });
  }
  return job;
}

function simulate(id: string, baseFreq: number, bpm = 118) {
  let progress = 0;
  const interval = window.setInterval(() => {
    const jobs = load();
    const job = jobs.find((x) => x.id === id);
    if (!job) {
      window.clearInterval(interval);
      return;
    }
    progress += 25;
    job.progress = Math.min(100, progress);
    job.status = progress >= 100 ? "done" : "rendering";

    if (job.status === "done") {
      const bundle = buildProceduralSongBundle(baseFreq, bpm);
      job.audioUrl = bundle.audioUrl;
      job.stems = bundle.stems;
      job.coverArtUrl = makeSvgDataUrl(job.title, "#6a3cff", "OddEngine Music Lab cover");
      job.lyricVideoUrl = makeSvgDataUrl(job.title, "#0fdc7a", "Lyric video placeholder");
      job.waveform = bundle.waveform;
      window.clearInterval(interval);
    }
    save(jobs);
  }, 700);
}

export function clearMusicJobs() {
  save([]);
}
