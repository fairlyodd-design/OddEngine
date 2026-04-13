import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const PALETTE = [
  '#0f172a',
  '#1e293b',
  '#172554',
  '#1d4ed8',
  '#4c1d95',
  '#7c2d12',
  '#14532d',
  '#111827',
];

const HEART_WORDS = [
  'family', 'love', 'heart', 'home', 'legacy', 'remember', 'memory', 'always', 'together', 'keep', 'hope', 'gentle', 'warm',
];
const WEIGHTED_WORDS = [
  'goodbye', 'loss', 'hard', 'heal', 'grief', 'miss', 'forever', 'promise', 'strength', 'faith', 'carry', 'guide', 'light',
];

const STOP_WORDS = new Set([
  'the','and','that','with','this','from','your','their','there','have','will','what','when','where','while','about','into','through','after','before','because','could','would','should','these','those','just','than','then','them','they','were','been','being','ours','ourselves','our','for','you','are','was','his','her','she','him','its','who','why','how','all','any','each','every','still','only','more','most','some','such','very','much','many','onto','upon','over','under','again','ever','made','make','keeps','keep'
]);

const VISUAL_PALETTES = [
  { base: '#0f172a', panel: '#111827', accent: '#93c5fd', overlay: '#1d4ed8', chip: '#0b1220' },
  { base: '#111827', panel: '#172554', accent: '#c4b5fd', overlay: '#4c1d95', chip: '#140f24' },
  { base: '#1f2937', panel: '#7c2d12', accent: '#fdba74', overlay: '#ea580c', chip: '#2a1308' },
  { base: '#0b1220', panel: '#14532d', accent: '#86efac', overlay: '#166534', chip: '#07150d' },
  { base: '#172554', panel: '#1e293b', accent: '#f9a8d4', overlay: '#be185d', chip: '#190917' },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function rel(base, target) {
  return path.relative(base, target).replace(/\\/g, '/');
}

function wordCount(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 0;
  return clean.split(' ').filter(Boolean).length;
}

function wrapText(text, maxLen = 26) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return 'Untitled';
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLen && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

function cleanSentence(value, max = 180) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function splitIntoSentences(value) {
  return String(value || '')
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((line) => cleanSentence(line))
    .filter(Boolean);
}

function dedupeSentences(lines, limit = 12) {
  const out = [];
  const seen = new Set();
  for (const line of lines) {
    const key = String(line || '').toLowerCase();
    if (key.length < 5 || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}

function fallbackChunks(text) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += 10) {
    chunks.push(words.slice(i, i + 10).join(' '));
    if (chunks.length >= 8) break;
  }
  return chunks;
}

function buildScenePlan({ title, prompt, script, videoBrief, finalOutput }) {
  const raw = [prompt, videoBrief, script, finalOutput]
    .filter(Boolean)
    .join('\n')
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((line) => cleanSentence(line))
    .filter(Boolean);

  const beats = dedupeSentences(raw, 6);
  if (!beats.length) {
    beats.push(...fallbackChunks([prompt, script, videoBrief, finalOutput, title].filter(Boolean).join(' ')).map((x) => cleanSentence(x)));
  }

  const sceneCount = Math.max(1, Math.min(6, beats.length || 1));
  const scenes = beats.slice(0, sceneCount).map((beat, idx) => ({
    id: `scene-${idx + 1}`,
    title: `Scene ${idx + 1}`,
    beat,
  }));

  if (!scenes.length) {
    scenes.push({ id: 'scene-1', title: 'Scene 1', beat: cleanSentence(prompt || title || 'A family memory worth keeping alive.', 140) });
  }

  return {
    titleCard: { id: 'title-card', title: 'Title', beat: `Legacy Mode\n${cleanSentence(title || 'Untitled legacy film', 80)}` },
    scenes,
    outro: { id: 'outro', title: 'Outro', beat: cleanSentence(finalOutput || script || prompt || 'Keep building what lasts.', 150) },
  };
}

function buildNarrationText({ title, prompt, script, finalOutput, plan, narrationText }) {
  const explicit = cleanSentence(narrationText || '', 5000);
  if (explicit) return explicit;

  const titleLine = cleanSentence(title || 'A family legacy message', 120);
  const seedSentences = dedupeSentences([
    ...splitIntoSentences(prompt),
    ...splitIntoSentences(script),
    ...splitIntoSentences(finalOutput),
    ...plan.scenes.map((scene) => cleanSentence(scene.beat, 160)),
    cleanSentence(plan.outro?.beat || '', 160),
  ], 8);

  const lines = [
    `This is ${titleLine}.`,
    ...seedSentences,
    'This message was made to last for the family.',
  ];

  return lines
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1400);
}

function resolveFontPath() {
  const candidates = process.platform === 'win32'
    ? [
        'C:/Windows/Fonts/arial.ttf',
        'C:/Windows/Fonts/segoeui.ttf',
        'C:/Windows/Fonts/calibri.ttf',
      ]
    : [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
        '/System/Library/Fonts/Supplemental/Arial.ttf',
      ];
  return candidates.find((file) => fs.existsSync(file)) || '';
}

function ffmpegEscapePath(filePath) {
  return String(filePath)
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

function commandExists(cmd, args = ['--version']) {
  try {
    const res = spawnSync(cmd, args, { stdio: 'ignore' });
    return typeof res.status === 'number';
  } catch {
    return false;
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stderr = '';
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk || ''); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk || ''); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `${cmd} exited with code ${code}`));
    });
  });
}

async function probeDuration(ffprobeBin, filePath) {
  try {
    const { stdout } = await run(ffprobeBin, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const value = Number(String(stdout || '').trim());
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function punctuationPause(text) {
  const value = String(text || '');
  const commas = (value.match(/[,;:]/g) || []).length * 0.12;
  const stops = (value.match(/[.!?]/g) || []).length * 0.28;
  const ellipsis = (value.match(/\.\.\.|…/g) || []).length * 0.35;
  return commas + stops + ellipsis;
}

function emotionWeight(text) {
  const lower = String(text || '').toLowerCase();
  let score = 0;
  for (const word of HEART_WORDS) if (lower.includes(word)) score += 0.08;
  for (const word of WEIGHTED_WORDS) if (lower.includes(word)) score += 0.11;
  if (lower.includes('!')) score += 0.08;
  if (lower.includes('?')) score += 0.06;
  return Math.min(score, 0.65);
}

function estimateNarrationSeconds(text) {
  const words = wordCount(text);
  if (!words) return 2.6;
  const spoken = words / 2.35; // ~141 wpm
  const pause = punctuationPause(text);
  const emotion = emotionWeight(text);
  return Math.max(2.2, spoken + pause + emotion + 0.28);
}

function estimateVisualHoldSeconds(text, role) {
  const words = wordCount(text);
  const base = role === 'title' ? 2.9 : role === 'outro' ? 2.8 : 2.15;
  const density = Math.min(1.2, words * 0.045);
  return base + density + emotionWeight(text) * 0.5;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distributeLines(lines, bucketCount) {
  if (bucketCount <= 0) return [];
  if (!lines.length) return Array.from({ length: bucketCount }, () => []);
  const buckets = Array.from({ length: bucketCount }, () => []);
  lines.forEach((line, idx) => {
    const bucketIndex = Math.min(bucketCount - 1, Math.floor((idx * bucketCount) / lines.length));
    buckets[bucketIndex].push(line);
  });
  return buckets;
}

function buildNarrationSegments(text) {
  const sentences = dedupeSentences(splitIntoSentences(text), 12);
  if (!sentences.length) return fallbackChunks(text).slice(0, 8);
  return sentences.slice(0, 8);
}

function buildTimedSegments({ cards, narrationLines, narrationDuration }) {
  const titleLine = narrationLines[0] || cards[0]?.beat || 'Legacy mode.';
  const outroLine = narrationLines.length > 1 ? narrationLines[narrationLines.length - 1] : cards[cards.length - 1]?.beat || 'Keep building what lasts.';
  const middleLines = narrationLines.length > 2 ? narrationLines.slice(1, -1) : [];
  const middleCards = cards.slice(1, -1);
  const grouped = distributeLines(middleLines, middleCards.length);

  const segments = cards.map((card, idx) => {
    let narrationLine = card.beat;
    let role = 'scene';
    if (idx === 0) {
      role = 'title';
      narrationLine = titleLine;
    } else if (idx === cards.length - 1) {
      role = 'outro';
      narrationLine = outroLine;
    } else {
      narrationLine = (grouped[idx - 1] || []).join(' ').trim() || card.beat;
    }
    const raw = Math.max(estimateNarrationSeconds(narrationLine), estimateVisualHoldSeconds(card.beat, role));
    const min = role === 'scene' ? 1.2 : 1.8;
    const max = role === 'scene' ? 7.0 : 5.4;
    const structural = role === 'title' ? 0.14 : role === 'outro' ? 0.2 : idx === 1 ? 0.08 : idx === cards.length - 2 ? 0.1 : 0;
    return {
      ...card,
      role,
      narrationLine,
      rawDuration: clamp(raw + structural, min, max),
      duration: 0,
      startSec: 0,
      endSec: 0,
    };
  });

  const rawTotal = segments.reduce((sum, s) => sum + s.rawDuration, 0) || 1;
  const targetTotal = Number.isFinite(narrationDuration) && narrationDuration > 0.5 ? narrationDuration + 0.12 : rawTotal;
  const scale = targetTotal / rawTotal;

  segments.forEach((segment) => {
    const min = segment.role === 'scene' ? 1.2 : 1.8;
    const max = segment.role === 'scene' ? 7.2 : 5.6;
    segment.duration = clamp(segment.rawDuration * scale, min, max);
  });

  let currentTotal = segments.reduce((sum, s) => sum + s.duration, 0);
  if (Number.isFinite(narrationDuration) && narrationDuration > 0.5 && currentTotal > targetTotal + 0.02) {
    let overflow = currentTotal - targetTotal;
    const shrinkable = segments
      .map((segment) => ({ segment, min: segment.role === 'scene' ? 1.2 : 1.8 }))
      .sort((a, b) => (b.segment.duration - b.min) - (a.segment.duration - a.min));
    for (const item of shrinkable) {
      if (overflow <= 0.001) break;
      const room = Math.max(0, item.segment.duration - item.min);
      if (!room) continue;
      const take = Math.min(room, overflow);
      item.segment.duration -= take;
      overflow -= take;
    }
  } else if (Number.isFinite(narrationDuration) && narrationDuration > 0.5 && currentTotal < targetTotal - 0.02) {
    let extra = targetTotal - currentTotal;
    const extendable = [...segments].sort((a, b) => emotionWeight(b.narrationLine || b.beat) - emotionWeight(a.narrationLine || a.beat));
    for (let i = 0; i < extendable.length && extra > 0.001; i += 1) {
      const segment = extendable[i];
      const max = segment.role === 'scene' ? 7.2 : 5.8;
      const room = Math.max(0, max - segment.duration);
      if (!room) continue;
      const give = Math.min(room, extra / Math.max(1, extendable.length - i));
      segment.duration += give;
      extra -= give;
    }
    if (extra > 0.001) segments[segments.length - 1].duration += extra;
  }

  let cursor = 0;
  segments.forEach((segment) => {
    segment.startSec = cursor;
    cursor += segment.duration;
    segment.endSec = cursor;
  });

  return segments;
}


function captionsFromSegments(segments) {
  const fmt = (value) => {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const seconds = Math.floor(value % 60);
    const millis = Math.round((value - Math.floor(value)) * 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  };
  return segments.map((segment, idx) => {
    const text = wrapText(segment.narrationLine || segment.beat, 34);
    return `${idx + 1}\n${fmt(segment.startSec)} --> ${fmt(segment.endSec)}\n${text}\n`;
  }).join('\n');
}

function titleCaseWord(value) {
  const raw = String(value || '');
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
}

function extractKeywordChips(text, limit = 4) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  const unique = [];
  const seen = new Set();
  for (const word of words) {
    const key = String(word || '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(titleCaseWord(word));
    if (unique.length >= limit) break;
  }
  return unique;
}

function buildHeadline(text, fallback = 'Legacy Memory') {
  const chips = extractKeywordChips(text, 4);
  if (chips.length >= 2) return chips.slice(0, 3).join(' ');
  const clean = cleanSentence(text, 90);
  if (!clean) return fallback;
  return clean.split(/\s+/).slice(0, 5).join(' ');
}

function pickVisualPalette(text, idx, role) {
  const emotional = emotionWeight(text);
  let paletteIndex = idx % VISUAL_PALETTES.length;
  if (role === 'title') paletteIndex = 4;
  else if (role === 'outro') paletteIndex = 2;
  else if (emotional > 0.45) paletteIndex = 2;
  else if (String(text || '').toLowerCase().includes('home') || String(text || '').toLowerCase().includes('family')) paletteIndex = 3;
  return VISUAL_PALETTES[paletteIndex];
}

async function makeBeatFrameImage({ ffmpegBin, metaTextFile, titleTextFile, bodyTextFile, chipTextFile, outFile, palette, fontPath, role }) {
  const font = fontPath ? `fontfile='${ffmpegEscapePath(fontPath)}':` : '';
  const filters = [
    `drawbox=x=0:y=0:w=1280:h=720:color=${palette.base}@1:t=fill`,
    `drawbox=x=58:y=64:w=1164:h=592:color=${palette.panel}@0.42:t=fill`,
    `drawbox=x=58:y=64:w=16:h=224:color=${palette.accent}@0.96:t=fill`,
    `drawbox=x=58:y=500:w=1164:h=156:color=${palette.chip}@0.62:t=fill`,
    `drawbox=x=84:y=106:w=1018:h=2:color=${palette.accent}@0.58:t=fill`,
    `drawbox=x=84:y=608:w=1018:h=2:color=${palette.accent}@0.38:t=fill`,
    `drawtext=${font}textfile='${ffmpegEscapePath(metaTextFile)}':reload=1:fontcolor=${palette.accent}:fontsize=22:x=92:y=84`,
    `drawtext=${font}textfile='${ffmpegEscapePath(titleTextFile)}':reload=1:fontcolor=white:fontsize=${role === 'title' ? 64 : 58}:line_spacing=12:x=92:y=${role === 'title' ? 180 : 206}`,
    `drawtext=${font}textfile='${ffmpegEscapePath(bodyTextFile)}':reload=1:fontcolor=white:fontsize=28:line_spacing=10:x=92:y=530`,
    `drawtext=${font}textfile='${ffmpegEscapePath(chipTextFile)}':reload=1:fontcolor=${palette.accent}:fontsize=22:x=92:y=625`,
  ];
  await run(ffmpegBin, [
    '-y',
    '-f', 'lavfi',
    '-i', 'color=c=black:s=1280x720:d=1',
    '-vf', filters.join(','),
    '-frames:v', '1',
    outFile,
  ]);
}

async function makeBeatImageClip({ ffmpegBin, imageFile, outFile, duration }) {
  const fadeOutStart = Math.max(0.1, Number(duration || 3) - 0.45).toFixed(2);
  await run(ffmpegBin, [
    '-y',
    '-loop', '1',
    '-t', String(duration),
    '-i', imageFile,
    '-vf', `fps=30,scale=1280:720,fade=t=in:st=0:d=0.28,fade=t=out:st=${fadeOutStart}:d=0.35`,
    '-r', '30',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outFile,
  ]);
}

function pickVoiceLabel(raw) {
  const value = String(raw || '').trim();
  if (!value) return 'Family Narrator';
  return value;
}

function normalizeEspeakVoice(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return 'en-us';
  if (value.includes('female')) return 'en-us+f3';
  if (value.includes('male')) return 'en-us+m3';
  if (value.includes('family')) return 'en-us';
  if (value.includes('mom')) return 'en-us+f3';
  if (value.includes('dad')) return 'en-us+m3';
  if (/^[a-z-+0-9_]+$/i.test(value)) return value;
  return 'en-us';
}

async function synthesizeNarration({ ffmpegBin, tempDir, narrationText, familyVoiceName, logger }) {
  const log = typeof logger === 'function' ? logger : () => {};
  const text = String(narrationText || '').replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, reason: 'empty narration text' };

  const voiceLabel = pickVoiceLabel(familyVoiceName);
  const textFile = path.join(tempDir, 'legacy-local-narration.txt');
  fs.writeFileSync(textFile, text, 'utf8');
  const wavPath = path.join(tempDir, 'legacy-local-narration.wav');

  if (process.platform === 'win32') {
    const powershell = commandExists('powershell', ['-Version']) ? 'powershell' : (commandExists('pwsh', ['-Version']) ? 'pwsh' : '');
    if (powershell) {
      const scriptPath = path.join(tempDir, 'legacy-local-tts.ps1');
      fs.writeFileSync(scriptPath, [
        'param([string]$TextFile,[string]$OutFile,[string]$VoiceName="")',
        'Add-Type -AssemblyName System.Speech',
        '$text = Get-Content -Raw -Path $TextFile',
        '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
        'if ($VoiceName) { try { $s.SelectVoice($VoiceName) } catch {} }',
        '$s.Rate = -1',
        '$s.SetOutputToWaveFile($OutFile)',
        '$s.Speak($text)',
        '$s.Dispose()',
      ].join('\r\n'), 'utf8');
      try {
        log(`legacy-local: narration via ${powershell} System.Speech`);
        await run(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-TextFile', textFile, '-OutFile', wavPath, '-VoiceName', voiceLabel]);
        if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 0) {
          return { ok: true, path: wavPath, engine: 'system-speech', voice: voiceLabel, text };
        }
      } catch (error) {
        log(`legacy-local: powershell TTS failed (${error?.message || error})`);
      }
    }
  }

  if (commandExists('espeak')) {
    const espeakVoice = normalizeEspeakVoice(voiceLabel);
    try {
      log(`legacy-local: narration via espeak (${espeakVoice})`);
      await run('espeak', ['-w', wavPath, '-s', '145', '-v', espeakVoice, text]);
      if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 0) {
        return { ok: true, path: wavPath, engine: 'espeak', voice: espeakVoice, text };
      }
    } catch (error) {
      log(`legacy-local: espeak failed (${error?.message || error})`);
    }
  }

  if (process.platform === 'darwin' && commandExists('say', ['-v', '?'])) {
    const aiffPath = path.join(tempDir, 'legacy-local-narration.aiff');
    try {
      log('legacy-local: narration via macOS say');
      await run('say', ['-o', aiffPath, text]);
      await run(ffmpegBin, ['-y', '-i', aiffPath, wavPath]);
      if (fs.existsSync(wavPath) && fs.statSync(wavPath).size > 0) {
        return { ok: true, path: wavPath, engine: 'say', voice: voiceLabel, text };
      }
    } catch (error) {
      log(`legacy-local: say failed (${error?.message || error})`);
    }
  }

  return { ok: false, reason: 'no local TTS engine available', voice: voiceLabel, text };
}

export async function renderLegacyLocalVideo({
  outputRootDir,
  title,
  prompt,
  script,
  videoBrief,
  visualBrief,
  finalOutput,
  narrationEnabled = true,
  narrationText = '',
  familyVoiceName = '',
  timingMode = 'image_beat_frames_v1',
  logger,
}) {
  const log = typeof logger === 'function' ? logger : () => {};
  const ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg';
  const ffprobeBin = process.env.FFPROBE_PATH || 'ffprobe';
  const fontPath = resolveFontPath();
  const plan = buildScenePlan({ title, prompt, script, videoBrief, finalOutput });
  const legacyDir = ensureDir(path.join(outputRootDir, 'provider', 'video', 'legacy_local'));
  const tempDir = ensureDir(path.join(legacyDir, 'tmp'));
  const sceneDir = ensureDir(path.join(tempDir, 'scenes'));
  const manifestDir = ensureDir(path.join(outputRootDir, 'video'));
  const frameDir = ensureDir(path.join(manifestDir, 'frames'));
  const releaseDir = ensureDir(path.join(outputRootDir, 'release'));

  const derivedNarrationText = buildNarrationText({ title, prompt, script, finalOutput, plan, narrationText });
  let narration = { ok: false, reason: 'disabled', voice: pickVoiceLabel(familyVoiceName), text: derivedNarrationText };
  if (narrationEnabled !== false) {
    narration = await synthesizeNarration({
      ffmpegBin,
      tempDir,
      narrationText: derivedNarrationText,
      familyVoiceName,
      logger: log,
    });
  }
  const narrationDuration = narration.ok && narration.path ? await probeDuration(ffprobeBin, narration.path) : 0;

  const narrationLines = buildNarrationSegments(derivedNarrationText);
  const desiredSceneCount = narrationLines.length >= 3 ? Math.max(1, Math.min(plan.scenes.length, narrationLines.length - 2)) : plan.scenes.length;
  const cards = [plan.titleCard, ...plan.scenes.slice(0, desiredSceneCount), plan.outro];
  const segments = buildTimedSegments({ cards, narrationLines, narrationDuration });

  for (let idx = 0; idx < segments.length; idx += 1) {
    const segment = segments[idx];
    const clipPath = path.join(sceneDir, `${String(idx + 1).padStart(2, '0')}-${segment.id}.mp4`);
    const framePath = path.join(frameDir, `${String(idx + 1).padStart(2, '0')}-${segment.id}.png`);
    const metaTextPath = path.join(tempDir, `${String(idx + 1).padStart(2, '0')}-${segment.id}-meta.txt`);
    const titleTextPath = path.join(tempDir, `${String(idx + 1).padStart(2, '0')}-${segment.id}-title.txt`);
    const bodyTextPath = path.join(tempDir, `${String(idx + 1).padStart(2, '0')}-${segment.id}-body.txt`);
    const chipTextPath = path.join(tempDir, `${String(idx + 1).padStart(2, '0')}-${segment.id}-chips.txt`);
    const palette = pickVisualPalette(segment.narrationLine || segment.beat, idx, segment.role);
    const chips = extractKeywordChips(`${segment.narrationLine || ''} ${segment.beat || ''}`, 4);
    const headline = segment.role === 'title'
      ? buildHeadline(title || segment.beat || 'Legacy Memory', title || 'Legacy Memory')
      : segment.role === 'outro'
        ? buildHeadline(segment.narrationLine || segment.beat || 'Keep building what lasts.', 'Keep Building What Lasts')
        : buildHeadline(segment.beat || segment.narrationLine || segment.title || `Scene ${idx + 1}`, segment.title || `Scene ${idx + 1}`);
    const body = wrapText(segment.narrationLine || segment.beat || '', 40);
    const meta = segment.role === 'title'
      ? `Legacy Mode • Opening Beat`
      : segment.role === 'outro'
        ? `Legacy Mode • Closing Beat`
        : `Legacy Mode • ${segment.title}`;
    fs.writeFileSync(metaTextPath, meta, 'utf8');
    fs.writeFileSync(titleTextPath, wrapText(headline, segment.role === 'title' ? 18 : 22), 'utf8');
    fs.writeFileSync(bodyTextPath, body, 'utf8');
    fs.writeFileSync(chipTextPath, (chips.length ? chips.join('   •   ') : 'Family   •   Memory   •   Legacy'), 'utf8');
    log(`legacy-local: rendering image beat ${segment.id} (${segment.duration.toFixed(2)}s)`);
    await makeBeatFrameImage({
      ffmpegBin,
      metaTextFile: metaTextPath,
      titleTextFile: titleTextPath,
      bodyTextFile: bodyTextPath,
      chipTextFile: chipTextPath,
      outFile: framePath,
      palette,
      fontPath,
      role: segment.role,
    });
    segment.clipPath = clipPath;
    segment.framePath = framePath;
    segment.headline = headline;
    segment.chips = chips;
  }

  const slideshowFile = path.join(tempDir, 'slideshow.txt');
  const slideshowLines = [];
  segments.forEach((segment) => {
    slideshowLines.push(`file '${String(segment.framePath || '').replace(/'/g, "'\''")}'`);
    slideshowLines.push(`duration ${Number(segment.duration || 0).toFixed(3)}`);
  });
  if (segments.length) slideshowLines.push(`file '${String(segments[segments.length - 1].framePath || '').replace(/'/g, "'\''")}'`);
  fs.writeFileSync(slideshowFile, slideshowLines.join('\n'), 'utf8');
  const totalDuration = segments.reduce((sum, segment) => sum + Number(segment.duration || 0), 0);
  const videoOnlyPath = path.join(legacyDir, 'legacy-local-video-only.mp4');
  const silentAudioPath = path.join(legacyDir, 'legacy-local-silent.wav');
  const finalPath = path.join(legacyDir, 'legacy-local-video.mp4');
  const posterPath = path.join(legacyDir, 'legacy-local-poster.png');
  const summaryPath = path.join(manifestDir, 'legacy-mode-summary.md');
  const planPath = path.join(manifestDir, 'legacy-scene-plan.json');
  const captionsPath = path.join(manifestDir, 'legacy-captions.srt');
  const narrationScriptPath = path.join(manifestDir, 'legacy-narration.txt');
  const responsePath = path.join(outputRootDir, 'provider', 'video', 'legacy-local-response.json');
  const releasePath = path.join(releaseDir, 'final-video.mp4');
  const releaseNarrationWavPath = path.join(releaseDir, 'family-narration.wav');
  const releaseNarrationMp3Path = path.join(releaseDir, 'family-narration.mp3');

  log('legacy-local: assembling image-beat slideshow');
  await run(ffmpegBin, [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', slideshowFile,
    '-vf', 'fps=30,format=yuv420p',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    videoOnlyPath,
  ]);

  let videoForMux = videoOnlyPath;
  let audioForMux = silentAudioPath;
  let usedNarration = false;
  const videoDuration = await probeDuration(ffprobeBin, videoOnlyPath) || totalDuration;

  if (narration.ok && narration.path) {
    usedNarration = true;
    fs.copyFileSync(narration.path, releaseNarrationWavPath);
    try {
      await run(ffmpegBin, ['-y', '-i', narration.path, '-codec:a', 'libmp3lame', '-q:a', '4', releaseNarrationMp3Path]);
    } catch (error) {
      log(`legacy-local: narration mp3 export skipped (${error?.message || error})`);
    }
    if (narrationDuration > videoDuration + 0.12 && (narrationDuration - videoDuration) < 6.0) {
      const extendedVideoPath = path.join(legacyDir, 'legacy-local-video-extended.mp4');
      const pad = Math.max(0, narrationDuration - videoDuration + 0.2);
      log(`legacy-local: extending outro hold by ${pad.toFixed(2)}s to finish narration cleanly`);
      await run(ffmpegBin, [
        '-y',
        '-i', videoOnlyPath,
        '-vf', `tpad=stop_mode=clone:stop_duration=${pad.toFixed(2)}`,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        extendedVideoPath,
      ]);
      videoForMux = extendedVideoPath;
    }
    audioForMux = narration.path;
  } else {
    log(`legacy-local: narration unavailable (${narration.reason || 'unknown'}), using silent fallback`);
    await run(ffmpegBin, [
      '-y',
      '-f', 'lavfi',
      '-t', String(videoDuration || totalDuration),
      '-i', 'anullsrc=r=44100:cl=stereo',
      '-c:a', 'pcm_s16le',
      silentAudioPath,
    ]);
  }

  log('legacy-local: muxing final mp4');
  await run(ffmpegBin, [
    '-y',
    '-i', videoForMux,
    '-i', audioForMux,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-shortest',
    '-movflags', '+faststart',
    finalPath,
  ]);

  await run(ffmpegBin, ['-y', '-i', finalPath, '-frames:v', '1', posterPath]);

  fs.copyFileSync(finalPath, releasePath);
  fs.writeFileSync(narrationScriptPath, derivedNarrationText, 'utf8');
  fs.writeFileSync(captionsPath, captionsFromSegments(segments), 'utf8');
  fs.writeFileSync(planPath, JSON.stringify({
    timingMode,
    title,
    narrationDuration,
    videoDuration: await probeDuration(ffprobeBin, finalPath),
    frameCount: segments.length,
    segments: segments.map((segment, idx) => ({
      index: idx + 1,
      id: segment.id,
      role: segment.role,
      title: segment.title,
      beat: segment.beat,
      narrationLine: segment.narrationLine,
      duration: Number(segment.duration.toFixed(3)),
      startSec: Number(segment.startSec.toFixed(3)),
      endSec: Number(segment.endSec.toFixed(3)),
      headline: segment.headline || '',
      chips: segment.chips || [],
      framePath: segment.framePath ? rel(outputRootDir, segment.framePath) : null,
    })),
  }, null, 2), 'utf8');

  const summary = [
    `# ${title || 'Legacy Mode Video'}`,
    '',
    '## Prompt',
    prompt || '',
    '',
    '## Timing mode',
    timingMode,
    '',
    '## Visual treatment',
    'Per-beat generated image frames with layered title, caption, and emotional keyword chips.',
    '',
    '## Narration',
    narrationEnabled === false ? 'Narration disabled.' : usedNarration ? `Generated with ${narration.engine || 'local TTS'} using voice ${narration.voice || pickVoiceLabel(familyVoiceName)}.` : `Requested but unavailable. Fallback reason: ${narration.reason || 'unknown'}.`,
    '',
    '## Narration text',
    derivedNarrationText || '',
    '',
    '## Beat timing',
    ...segments.map((segment, idx) => `${idx + 1}. [${segment.startSec.toFixed(2)}s → ${segment.endSec.toFixed(2)}s] ${segment.title} — ${segment.narrationLine} (${segment.headline || ''})`),
    '',
    '## Final output',
    finalOutput || script || prompt || '',
  ].join('\n');
  fs.writeFileSync(summaryPath, summary, 'utf8');

  const artifacts = [
    rel(outputRootDir, finalPath),
    rel(outputRootDir, posterPath),
    rel(outputRootDir, summaryPath),
    rel(outputRootDir, captionsPath),
    rel(outputRootDir, planPath),
    rel(outputRootDir, narrationScriptPath),
    rel(outputRootDir, releasePath),
    ...segments.map((segment) => segment.framePath ? rel(outputRootDir, segment.framePath) : null).filter(Boolean),
  ];
  if (fs.existsSync(releaseNarrationWavPath)) artifacts.push(rel(outputRootDir, releaseNarrationWavPath));
  if (fs.existsSync(releaseNarrationMp3Path)) artifacts.push(rel(outputRootDir, releaseNarrationMp3Path));

  const response = {
    ok: true,
    provider: 'legacy-local',
    title,
    timingMode,
    usedNarration,
    narrationEnabled: narrationEnabled !== false,
    narrationVoice: narration.voice || pickVoiceLabel(familyVoiceName),
    visualMode: 'image-beat-frames',
    narrationEngine: narration.engine || null,
    narrationReason: narration.reason || null,
    narrationText: derivedNarrationText,
    narrationDuration,
    artifacts,
  };
  fs.writeFileSync(responsePath, JSON.stringify(response, null, 2), 'utf8');

  return response;
}
