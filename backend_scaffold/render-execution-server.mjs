import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 8899);
const HOST = process.env.HOST || "127.0.0.1";
const runtimeRoot = path.join(__dirname, "runtime", "render_jobs");
const jobs = new Map();

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runtimeJobDir(jobId) {
  return path.join(runtimeRoot, jobId);
}

function makeArtifact(kind, label, filePath, baseUrl, jobId) {
  return {
    kind,
    label,
    path: filePath,
    url: `${baseUrl}/files/${encodeURIComponent(jobId)}/${encodeURIComponent(path.basename(filePath))}`,
  };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeLine(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function escapeDrawText(input) {
  return String(input || "")
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/%/g, "\\%");
}

function trimSpeech(text) {
  const cleaned = sanitizeLine(text);
  if (!cleaned) return "This scene has no spoken dialogue.";
  return cleaned.slice(0, 900);
}

function quoteForConcat(filePath) {
  return String(filePath).replace(/'/g, "'\\''");
}

function lineWrap(text, width = 38, maxLines = 5) {
  const words = sanitizeLine(text).split(" ").filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines.slice(0, maxLines);
}

function hashString(input) {
  let h = 2166136261;
  const s = String(input || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rgbToHex(r, g, b) {
  return `0x${[r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("")}`;
}

function hslToRgb(h, s, l) {
  const hh = ((h % 360) + 360) % 360 / 360;
  const ss = Math.max(0, Math.min(1, s));
  const ll = Math.max(0, Math.min(1, l));
  if (ss === 0) {
    const v = ll * 255;
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  return [
    hue2rgb(p, q, hh + 1 / 3) * 255,
    hue2rgb(p, q, hh) * 255,
    hue2rgb(p, q, hh - 1 / 3) * 255,
  ];
}

function paletteFor(seedText) {
  const h = hashString(seedText || "scene");
  const base = h % 360;
  const alt = (base + 35 + (h % 70)) % 360;
  const accent = (base + 160 + (h % 40)) % 360;
  const dark = rgbToHex(...hslToRgb(base, 0.45, 0.12));
  const mid = rgbToHex(...hslToRgb(alt, 0.58, 0.28));
  const glow = rgbToHex(...hslToRgb(accent, 0.80, 0.62));
  const soft = rgbToHex(...hslToRgb((accent + 25) % 360, 0.70, 0.74));
  return { dark, mid, glow, soft };
}

function ffmpegEscapeColor(value) {
  return String(value || "0xffffff").replace(/\s+/g, "");
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], shell: false, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => { stdout += String(d); });
    child.stderr?.on("data", (d) => { stderr += String(d); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr, code });
      else reject(new Error(`${command} exited with code ${code}${stderr ? `\n${stderr}` : ""}`));
    });
  });
}

async function hasCommand(command, args = ["-version"]) {
  try {
    await runCommand(command, args);
    return true;
  } catch {
    return false;
  }
}

function makeWavBuffer(durationSec = 2, sampleRate = 16000) {
  const dur = Math.max(1, Number(durationSec) || 1);
  const sampleCount = Math.floor(sampleRate * dur);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

async function writeSilentWav(target, durationSec = 2) {
  await fs.writeFile(target, makeWavBuffer(durationSec));
}

async function synthesizeSpeechPowershell(text, outFile) {
  const script = [
    "Add-Type -AssemblyName System.Speech",
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "$synth.Rate = 0",
    "$synth.Volume = 100",
    `$synth.SetOutputToWaveFile('${String(outFile).replace(/'/g, "''")}')`,
    `$synth.Speak('${String(text).replace(/'/g, "''")}')`,
    "$synth.Dispose()",
  ].join("; ");
  await runCommand("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script]);
}

async function appendLog(job, line) {
  const jobDir = runtimeJobDir(job.jobId);
  const logPath = path.join(jobDir, "pipeline.log");
  const text = `[${nowIso()}] ${line}\n`;
  await fs.appendFile(logPath, text, "utf8");
}

async function updateJob(job, baseUrl, status, detail) {
  job.status = status;
  job.detail = detail;
  job.updatedAt = Date.now();
  await appendLog(job, `${status} :: ${detail}`);
  await writeJobSummary(job, baseUrl);
}

async function generateVoiceAsset(scene, jobDir, ffmpegAvailable) {
  const wavPath = path.join(jobDir, path.basename(scene.voiceAssetFile || `${scene.sceneId}_voice.wav`));
  const transcriptPath = path.join(jobDir, `${scene.sceneId}_transcript.txt`);
  const speech = trimSpeech(scene.voiceText || scene.voiceAsset?.transcript || scene.sceneTitle);
  await fs.writeFile(transcriptPath, speech, "utf8");

  let engine = "silent-fallback";
  try {
    if (process.platform === "win32") {
      await synthesizeSpeechPowershell(speech, wavPath);
      engine = "powershell-system-speech";
    } else if (ffmpegAvailable) {
      await runCommand("ffmpeg", [
        "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono",
        "-t", String(Math.max(2, scene.voiceAsset?.durationSec || scene.durationSec || 2)),
        "-acodec", "pcm_s16le", wavPath,
      ]);
      engine = "ffmpeg-silence";
    } else {
      await writeSilentWav(wavPath, Math.max(2, scene.voiceAsset?.durationSec || scene.durationSec || 2));
    }
  } catch {
    await writeSilentWav(wavPath, Math.max(2, scene.voiceAsset?.durationSec || scene.durationSec || 2));
  }
  return { wavPath, transcriptPath, engine, speech };
}

function sceneTextBundle(scene, index) {
  const title = sanitizeLine(scene.sceneTitle, `Scene ${index + 1}`);
  const visual = sanitizeLine(scene.visualPrompt, "Cinematic scene");
  const motion = sanitizeLine(scene.motionPrompt || scene.cameraPlan, "Slow camera move");
  const speech = trimSpeech(scene.voiceText || scene.voiceAsset?.transcript || title);
  const keywords = Array.from(new Set(`${title} ${visual} ${motion}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => word.length > 3)
    .slice(0, 6)));
  return {
    title,
    visual,
    motion,
    speech,
    visualLines: lineWrap(visual, 34, 2),
    motionLines: lineWrap(motion, 42, 2),
    speechLines: lineWrap(speech, 42, 2),
    keywordLabel: keywords.join(" • "),
  };
}


async function generateScenePoster(scene, index, jobDir, ffmpegAvailable) {
  const posterPath = path.join(jobDir, `${scene.sceneId || `scene_${index + 1}`}_poster.png`);
  const palette = paletteFor(`${scene.sceneTitle || "scene"} ${scene.visualPrompt || ""}`);
  const text = sceneTextBundle(scene, index);

  if (!ffmpegAvailable) {
    await fs.writeFile(posterPath.replace(/\.png$/, ".txt"), JSON.stringify({ scene, palette, text }, null, 2), "utf8");
    return { posterPath: posterPath.replace(/\.png$/, ".txt"), palette, text, generatedWith: "fallback-text" };
  }

  const horizonY = 420 + ((index % 3) * 18);
  const subjectX = 870 + ((index % 2) * 90);
  const accentX = 130 + ((index % 4) * 40);
  const filters = [
    `drawbox=x=0:y=0:w=1280:h=720:color=${ffmpegEscapeColor(palette.dark)}:t=fill`,
    `drawbox=x=0:y=0:w=1280:h=${horizonY}:color=${ffmpegEscapeColor(palette.mid)}@0.72:t=fill`,
    `drawbox=x=0:y=${horizonY}:w=1280:h=${720 - horizonY}:color=0x05070b@0.95:t=fill`,
    `drawbox=x=0:y=${horizonY - 8}:w=1280:h=8:color=${ffmpegEscapeColor(palette.glow)}@0.35:t=fill`,
    `drawbox=x=${accentX}:y=84:w=8:h=462:color=${ffmpegEscapeColor(palette.glow)}@0.92:t=fill`,
    `drawbox=x=72:y=74:w=1136:h=572:color=white@0.02:t=2`,
    `drawbox=x=${subjectX}:y=166:w=170:h=330:color=black@0.54:t=fill`,
    `drawbox=x=${subjectX + 24}:y=132:w=122:h=122:color=black@0.60:t=fill`,
    `drawbox=x=${subjectX - 36}:y=210:w=242:h=36:color=${ffmpegEscapeColor(palette.soft)}@0.08:t=fill`,
    `drawbox=x=${subjectX - 52}:y=480:w=300:h=32:color=black@0.46:t=fill`,
    `drawbox=x=112:y=526:w=782:h=112:color=0x07090d@0.34:t=fill`,
    `drawbox=x=112:y=120:w=670:h=230:color=black@0.08:t=fill`,
    `drawbox=x=1010:y=94:w=170:h=120:color=${ffmpegEscapeColor(palette.glow)}@0.09:t=fill`,
    `drawgrid=width=120:height=120:thickness=1:color=white@0.03`,
    `noise=alls=5:allf=t+u`,
    `gblur=sigma=0.5`,
  ];

  filters.push(`drawtext=text='SCENE ${index + 1}':fontcolor=${ffmpegEscapeColor(palette.soft)}:fontsize=24:x=118:y=102`);
  filters.push(`drawtext=text='${escapeDrawText(text.title)}':fontcolor=white:fontsize=58:x=118:y=142`);
  if (text.keywordLabel) {
    filters.push(`drawtext=text='${escapeDrawText(text.keywordLabel.slice(0, 68))}':fontcolor=${ffmpegEscapeColor(palette.soft)}@0.92:fontsize=22:x=120:y=220`);
  }
  text.visualLines.slice(0, 2).forEach((line, i) => {
    filters.push(`drawtext=text='${escapeDrawText(line)}':fontcolor=white@0.92:fontsize=30:x=120:y=${284 + i * 40}`);
  });
  text.motionLines.slice(0, 1).forEach((line, i) => {
    filters.push(`drawtext=text='${escapeDrawText(line)}':fontcolor=${ffmpegEscapeColor(palette.soft)}@0.85:fontsize=22:x=120:y=${548 + i * 30}`);
  });
  filters.push(`drawtext=text='FairlyOdd Studio':fontcolor=white@0.28:fontsize=18:x=1044:y=648`);

  await runCommand("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", "color=c=black:s=1280x720:d=1",
    "-vf", filters.join(","),
    "-frames:v", "1",
    posterPath,
  ]);

  return { posterPath, palette, text, generatedWith: "ffmpeg-scene-visual" };
}

async function renderMovieLikeScene(scene, index, voiceWav, poster, jobDir, ffmpegAvailable) {
  const videoPath = path.join(jobDir, path.basename(scene.outputFile || `${scene.sceneId || `scene_${index + 1}`}.mp4`));
  const duration = Math.max(3, Number(scene.durationSec) || Number(scene.voiceAsset?.durationSec) || 5);

  if (!ffmpegAvailable || !String(poster.posterPath).toLowerCase().endsWith(".png")) {
    await fs.writeFile(videoPath.replace(/\.mp4$/, ".txt"), `Fallback scene output for ${scene.sceneTitle || `Scene ${index + 1}`}`, "utf8");
    return { videoPath: videoPath.replace(/\.mp4$/, ".txt"), mode: "fallback-text" };
  }

  const zoomExpr = index % 2 === 0 ? "zoom+0.0008" : "zoom+0.0005";
  const filters = [
    `scale=1520:856,zoompan=z='min(${zoomExpr},1.16)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.max(1, Math.round(duration * 24))}:s=1280x720:fps=24`,
    "eq=saturation=1.18:contrast=1.06:brightness=0.015",
    "gblur=sigma=0.35",
    `drawbox=x=0:y=0:w=1280:h=70:color=black@0.16:t=fill`,
    `drawbox=x=0:y=650:w=1280:h=70:color=black@0.22:t=fill`,
    `drawtext=text='${escapeDrawText(sanitizeLine(scene.sceneTitle, `Scene ${index + 1}`))}':fontcolor=white@0.94:fontsize=24:x=72:y=670`,
    `drawtext=text='${escapeDrawText(sanitizeLine(scene.cameraPlan || scene.motionPrompt, "cinematic move").slice(0, 56))}':fontcolor=white@0.50:fontsize=17:x=72:y=698`,
    "fade=t=in:st=0:d=0.4",
    `fade=t=out:st=${Math.max(0, duration - 0.5)}:d=0.5`,
  ];

  await runCommand("ffmpeg", [
    "-y",
    "-loop", "1",
    "-i", poster.posterPath,
    "-i", voiceWav,
    "-filter_complex", `[0:v]${filters.join(",")}[v]`,
    "-map", "[v]",
    "-map", "1:a",
    "-t", String(duration),
    "-r", "24",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-shortest",
    videoPath,
  ]);

  return { videoPath, mode: "ffmpeg-scene-visuals" };
}

async function assembleEpisode(jobDir, sceneVideoPaths, targetFinalPath, ffmpegAvailable) {
  const concatList = path.join(jobDir, "concat_list.txt");
  await fs.writeFile(concatList, sceneVideoPaths.map((file) => `file '${quoteForConcat(file)}'`).join("\n"), "utf8");

  const finalPath = path.join(jobDir, path.basename(targetFinalPath || "final_episode.mp4"));
  if (ffmpegAvailable && sceneVideoPaths.every((item) => /\.(mp4|mov|m4v|webm)$/i.test(item))) {
    await runCommand("ffmpeg", [
      "-y", "-f", "concat", "-safe", "0", "-i", concatList,
      "-c", "copy", finalPath,
    ]);
  } else {
    await fs.writeFile(finalPath.replace(/\.mp4$/, ".txt"), sceneVideoPaths.join("\n"), "utf8");
    return { finalPath: finalPath.replace(/\.mp4$/, ".txt"), concatList };
  }
  return { finalPath, concatList };
}


function pickTags(job, scenes) {
  const bag = [
    sanitizeLine(job.payload?.projectTitle || ''),
    sanitizeLine(job.payload?.prompt || ''),
    ...scenes.map((scene) => sanitizeLine(scene.sceneTitle || '')),
    ...scenes.map((scene) => sanitizeLine(scene.visualPrompt || '')),
  ].join(' ').toLowerCase();
  const tags = new Set(['fairlyodd', 'oddengine', 'writers-lounge', 'animatic']);
  const checks = [
    ['mystery', ['mystery','secret','unknown']],
    ['thriller', ['thriller','danger','tense']],
    ['comedy', ['funny','comedy','laugh']],
    ['scifi', ['sci-fi','science fiction','future','cyber','space','robot']],
    ['fantasy', ['fantasy','magic','dragon','kingdom']],
    ['drama', ['drama','family','relationship','heart']],
    ['action', ['action','fight','chase','battle']],
    ['horror', ['horror','haunted','monster','fear']],
    ['animation', ['animated','animation','cartoon','stylized']],
    ['cinematic', ['cinematic','film','movie']],
  ];
  for (const [tag, words] of checks) {
    if (words.some((word) => bag.includes(word))) tags.add(tag);
  }
  return Array.from(tags).slice(0, 10);
}

function deriveProductMeta(job, scenes, finalPath) {
  const rawTitle = sanitizeLine(job.payload?.projectTitle || job.payload?.seriesTitle || scenes[0]?.sceneTitle || 'FairlyOdd Episode');
  const title = rawTitle.length > 72 ? rawTitle.slice(0, 72).trim() : rawTitle;
  const summarySource = sanitizeLine(job.payload?.logline || job.payload?.prompt || scenes.map((scene) => scene.visualPrompt || scene.sceneTitle || '').join(' '));
  const summary = summarySource.length > 240 ? `${summarySource.slice(0, 237).trim()}...` : summarySource;
  const tags = pickTags(job, scenes);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'fairlyodd-episode';
  return {
    title,
    summary,
    tags,
    slug,
    finalPath,
    mode: 'animatic',
    releaseLabel: `${title} | FairlyOdd Studio`,
    youtubeDescription: `${summary}

Made in FairlyOdd Studio / OddEngine.

#${tags.slice(0,5).join(' #')}`,
    gumroadDescription: `Includes the final animatic video, execution artifacts, voice manifest, and scene plan for ${title}.

${summary}`,
  };
}

async function generateThumbnail(jobDir, meta, firstPosterPath, ffmpegAvailable) {
  const thumbPath = path.join(jobDir, `${meta.slug}_thumbnail.png`);
  if (ffmpegAvailable && firstPosterPath && /\.png$/i.test(firstPosterPath)) {
    const filters = [
      `drawbox=x=0:y=0:w=1280:h=720:color=black@0.26:t=fill`,
      `drawbox=x=60:y=480:w=1160:h=180:color=0x10131b@0.78:t=fill`,
      `drawtext=text='${escapeDrawText(meta.title)}':fontcolor=white:fontsize=58:x=84:y=520`,
      `drawtext=text='${escapeDrawText(meta.summary.slice(0, 110))}':fontcolor=0xd8dff2:fontsize=26:x=88:y=596`,
      `drawtext=text='ANIMATIC PREVIEW':fontcolor=0x66d9ff:fontsize=28:x=86:y=470`,
      `drawbox=x=980:y=72:w=230:h=70:color=0x0d1624@0.75:t=fill`,
      `drawtext=text='FairlyOdd Studio':fontcolor=white:fontsize=26:x=1008:y=94`,
    ];
    await runCommand('ffmpeg', [
      '-y', '-loop', '1', '-i', firstPosterPath,
      '-vf', filters.join(','), '-frames:v', '1', thumbPath,
    ]);
    return thumbPath;
  }
  const fallback = `${thumbPath}.txt`;
  await fs.writeFile(fallback, JSON.stringify(meta, null, 2), 'utf8');
  return fallback;
}

async function writeProductPack(job, jobDir, baseUrl, scenes, finalPath, posterPath, ffmpegAvailable) {
  const meta = deriveProductMeta(job, scenes, finalPath);
  const thumbPath = await generateThumbnail(jobDir, meta, posterPath, ffmpegAvailable);
  const productPackPath = path.join(jobDir, `${meta.slug}_product_pack.json`);
  const youtubeTxtPath = path.join(jobDir, `${meta.slug}_youtube_ready.txt`);
  const gumroadTxtPath = path.join(jobDir, `${meta.slug}_gumroad_ready.txt`);
  const payload = {
    ...meta,
    thumbnailPath: thumbPath,
    finalVideoPath: finalPath,
    createdAt: nowIso(),
  };
  await fs.writeFile(productPackPath, JSON.stringify(payload, null, 2), 'utf8');
  await fs.writeFile(youtubeTxtPath, `${meta.releaseLabel}

${meta.youtubeDescription}

Tags: ${meta.tags.join(', ')}`, 'utf8');
  await fs.writeFile(gumroadTxtPath, `${meta.title} Production Pack

${meta.gumroadDescription}

Tags: ${meta.tags.join(', ')}`, 'utf8');
  return [
    makeArtifact('thumbnail', 'Episode thumbnail', thumbPath, baseUrl, job.jobId),
    makeArtifact('product-pack', 'Product pack', productPackPath, baseUrl, job.jobId),
    makeArtifact('youtube-prep', 'YouTube ready copy', youtubeTxtPath, baseUrl, job.jobId),
    makeArtifact('gumroad-prep', 'Gumroad ready copy', gumroadTxtPath, baseUrl, job.jobId),
  ];
}

async function writeJobSummary(job, baseUrl) {
  const jobDir = runtimeJobDir(job.jobId);
  const summaryPath = path.join(jobDir, "job-summary.json");
  const receiptPath = path.join(jobDir, "receipt.json");
  const logPath = path.join(jobDir, "pipeline.log");
  if (!(await fileExists(logPath))) await fs.writeFile(logPath, "", "utf8");
  await fs.writeFile(summaryPath, JSON.stringify(job.payload, null, 2), "utf8");
  await fs.writeFile(receiptPath, JSON.stringify({
    jobId: job.jobId,
    status: job.status,
    detail: job.detail,
    artifacts: job.artifacts,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }, null, 2), "utf8");
  const summaryArtifact = makeArtifact("summary", "Job summary", summaryPath, baseUrl, job.jobId);
  const receiptArtifact = makeArtifact("receipt", "Execution receipt", receiptPath, baseUrl, job.jobId);
  const logArtifact = makeArtifact("log", "Pipeline log", logPath, baseUrl, job.jobId);
  const existing = Array.isArray(job.artifacts)
    ? job.artifacts.filter((item) => !["summary", "receipt", "log"].includes(item.kind))
    : [];
  job.artifacts = [summaryArtifact, receiptArtifact, logArtifact, ...existing];
}

async function processJob(job, baseUrl) {
  const jobDir = runtimeJobDir(job.jobId);
  await ensureDir(jobDir);
  const ffmpegAvailable = await hasCommand("ffmpeg", ["-version"]);
  await appendLog(job, `accepted :: ffmpeg available = ${ffmpegAvailable}`);

  const scenes = Array.isArray(job.payload?.scenes) ? job.payload.scenes : [];
  const artifacts = [];
  const voiceManifestLines = [];
  const shotManifestLines = [];
  const sceneVideoPaths = [];
  let firstPosterPath = '';

  await updateJob(job, baseUrl, "voice-generation", `Generating voice WAV files for ${scenes.length} scene(s)`);

  for (const [index, scene] of scenes.entries()) {
    const voice = await generateVoiceAsset(scene, jobDir, ffmpegAvailable);
    artifacts.push(makeArtifact("voice", `Scene ${index + 1} voice`, voice.wavPath, baseUrl, job.jobId));
    artifacts.push(makeArtifact("transcript", `Scene ${index + 1} transcript`, voice.transcriptPath, baseUrl, job.jobId));
    voiceManifestLines.push(`Scene ${index + 1}: ${voice.wavPath} • ${voice.engine}`);
    voiceManifestLines.push(`Speech: ${voice.speech}`);
    job.artifacts = artifacts;
    await appendLog(job, `voice :: scene ${index + 1} -> ${path.basename(voice.wavPath)} (${voice.engine})`);
  }

  const voiceManifestPath = path.join(jobDir, "voice_manifest.txt");
  await fs.writeFile(voiceManifestPath, voiceManifestLines.join("\n"), "utf8");
  artifacts.push(makeArtifact("voice-manifest", "Voice manifest", voiceManifestPath, baseUrl, job.jobId));
  await writeJobSummary(job, baseUrl);

  await updateJob(job, baseUrl, "scene-render", ffmpegAvailable
    ? "Generating scene visuals and cinematic clips"
    : "ffmpeg missing; generating fallback scene records");

  for (const [index, scene] of scenes.entries()) {
    const voiceArtifact = artifacts.find((item) => item.kind === "voice" && item.label === `Scene ${index + 1} voice`);
    const poster = await generateScenePoster(scene, index, jobDir, ffmpegAvailable);
    artifacts.push(makeArtifact("scene-poster", `Scene ${index + 1} poster`, poster.posterPath, baseUrl, job.jobId));
    if (!firstPosterPath) firstPosterPath = poster.posterPath;
    shotManifestLines.push(`Scene ${index + 1}: ${sanitizeLine(scene.cameraPlan || scene.motionPrompt, "cinematic move")}`);
    shotManifestLines.push(`Visual: ${sanitizeLine(scene.visualPrompt, scene.sceneTitle || `Scene ${index + 1}`)}`);
    const rendered = await renderMovieLikeScene(
      scene,
      index,
      voiceArtifact?.path || path.join(jobDir, path.basename(scene.voiceAssetFile || `${scene.sceneId}_voice.wav`)),
      poster,
      jobDir,
      ffmpegAvailable,
    );
    sceneVideoPaths.push(rendered.videoPath);
    artifacts.push(makeArtifact("scene-video", `Scene ${index + 1} video`, rendered.videoPath, baseUrl, job.jobId));
    job.artifacts = artifacts;
    await appendLog(job, `render :: scene ${index + 1} -> ${path.basename(rendered.videoPath)} (${rendered.mode})`);
  }

  const shotManifestPath = path.join(jobDir, "shot_manifest.txt");
  await fs.writeFile(shotManifestPath, shotManifestLines.join("\n"), "utf8");
  artifacts.push(makeArtifact("shot-manifest", "Shot manifest", shotManifestPath, baseUrl, job.jobId));
  await writeJobSummary(job, baseUrl);
  await wait(200);

  await updateJob(job, baseUrl, "final-assembly", ffmpegAvailable
    ? "Assembling final movie-like episode MP4"
    : "ffmpeg missing; writing fallback final artifact");

  const { finalPath, concatList } = await assembleEpisode(jobDir, sceneVideoPaths, job.payload?.finalEpisodeFile || `${job.jobId}_final_episode.mp4`, ffmpegAvailable);
  const assemblyRecipePath = path.join(jobDir, "assembly_recipe.txt");
  await fs.writeFile(assemblyRecipePath, [
    `ffmpeg available: ${ffmpegAvailable}`,
    `render mode: scene visuals + cinematic clips`,
    `job: ${job.jobId}`,
    `created: ${nowIso()}`,
    `final file: ${finalPath}`,
    `scenes: ${sceneVideoPaths.length}`,
    ...sceneVideoPaths.map((item, i) => `Scene ${i + 1}: ${item}`),
  ].join("\n"), "utf8");

  artifacts.push(makeArtifact("concat-list", "Concat list", concatList, baseUrl, job.jobId));
  artifacts.push(makeArtifact("assembly", "Assembly recipe", assemblyRecipePath, baseUrl, job.jobId));
  artifacts.push(makeArtifact("final-video", /\.(mp4|mov|m4v|webm)$/i.test(finalPath) ? "Final episode video" : "Final episode fallback", finalPath, baseUrl, job.jobId));
  const productArtifacts = await writeProductPack(job, jobDir, baseUrl, scenes, finalPath, firstPosterPath, ffmpegAvailable);
  artifacts.push(...productArtifacts);

  job.artifacts = artifacts;
  await updateJob(job, baseUrl, "completed", /\.(mp4|mov|m4v|webm)$/i.test(finalPath)
    ? "Final animatic assembled with product pack + thumbnail"
    : "Fallback artifacts generated; install ffmpeg for real MP4 output");
}

async function startJob(job, baseUrl) {
  if (job.processing) return;
  job.processing = true;
  processJob(job, baseUrl).catch(async (error) => {
    job.status = "failed";
    job.detail = error instanceof Error ? error.message : "Execution failed";
    job.updatedAt = Date.now();
    const errPath = path.join(runtimeJobDir(job.jobId), "error.txt");
    await ensureDir(runtimeJobDir(job.jobId));
    await fs.writeFile(errPath, job.detail, "utf8");
    const existing = Array.isArray(job.artifacts) ? job.artifacts : [];
    job.artifacts = [makeArtifact("error", "Execution error", errPath, baseUrl, job.jobId), ...existing];
    await appendLog(job, `failed :: ${job.detail}`);
    await writeJobSummary(job, baseUrl);
  }).finally(() => {
    job.processing = false;
  });
}

function matchFileRoute(urlPath) {
  const match = urlPath.match(/^\/files\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { jobId: decodeURIComponent(match[1]), filename: decodeURIComponent(match[2]) };
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json") return "application/json; charset=utf-8";
  if ([".txt", ".md", ".log"].includes(ext)) return "text/plain; charset=utf-8";
  if (ext === ".wav") return "audio/wav";
  if ([".png", ".jpg", ".jpeg"].includes(ext)) return `image/${ext.replace(".", "")}`;
  if ([".mp4", ".m4v"].includes(ext)) return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  return "application/octet-stream";
}

const server = http.createServer(async (req, res) => {
  const baseUrl = `http://${HOST}:${PORT}`;
  const url = new URL(req.url || "/", baseUrl);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, { ok: true, status: "ready", service: "oddengine-true-render-execution", port: PORT, mode: "scene-visual-generation" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/render/jobs") {
    const body = await readBody(req);
    const jobId = String(body.jobId || `render_${Date.now()}`);
    const now = Date.now();
    const existing = jobs.get(jobId);
    const job = existing || {
      jobId,
      status: "queued",
      detail: "Render job accepted",
      createdAt: now,
      updatedAt: now,
      payload: body,
      artifacts: [],
      processing: false,
    };
    job.payload = body;
    job.status = "queued";
    job.detail = "Render job accepted";
    job.updatedAt = now;
    jobs.set(jobId, job);
    await ensureDir(runtimeJobDir(jobId));
    await appendLog(job, "queued :: render job accepted");
    await writeJobSummary(job, baseUrl);
    startJob(job, baseUrl);
    json(res, 200, { ok: true, jobId, status: job.status, detail: job.detail });
    return;
  }

  const match = url.pathname.match(/^\/render\/jobs\/([^/]+)(\/artifacts)?$/);
  if (req.method === "GET" && match) {
    const jobId = decodeURIComponent(match[1]);
    const job = jobs.get(jobId);
    if (!job) {
      json(res, 404, { ok: false, error: "Job not found", jobId });
      return;
    }
    json(res, 200, { ok: true, jobId, status: job.status, detail: job.detail, artifacts: job.artifacts || [] });
    return;
  }

  const fileRoute = matchFileRoute(url.pathname);
  if (req.method === "GET" && fileRoute) {
    const filePath = path.join(runtimeJobDir(fileRoute.jobId), path.basename(fileRoute.filename));
    if (!(await fileExists(filePath))) {
      json(res, 404, { ok: false, error: "File not found", file: fileRoute.filename });
      return;
    }
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": contentTypeFor(filePath),
      "Content-Length": data.length,
    });
    res.end(data);
    return;
  }

  json(res, 404, { ok: false, error: "Missing route", path: url.pathname, method: req.method });
});

server.listen(PORT, HOST, async () => {
  await ensureDir(runtimeRoot);
  console.log(`[OddEngine True Render Execution] listening on http://${HOST}:${PORT}`);
  console.log(`[OddEngine True Render Execution] ffmpeg available: ${await hasCommand("ffmpeg", ["-version"])}`);
  console.log("[OddEngine True Render Execution] mode: scene visuals + WAV voice + MP4 assembly");
});
