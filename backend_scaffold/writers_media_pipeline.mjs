#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

function log(msg){ process.stdout.write(String(msg).replace(/\n?$/, "") + "\n"); }
function ensureDir(p){ fs.mkdirSync(p, { recursive:true }); }
function sanitizeName(s){ return String(s||"").replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "").slice(0,80) || "untitled"; }
function hashCode(str){ let h=0; for (let i=0;i<str.length;i++) h = ((h<<5)-h) + str.charCodeAt(i) | 0; return Math.abs(h); }
function bgColor(seed){ const colors=["0x14213D","0x1D3557","0x3A0CA3","0x264653","0x003049","0x1B4332","0x4A4E69","0x5A189A"]; return colors[seed % colors.length]; }
function argsMap(argv){ const out={}; for(let i=2;i<argv.length;i++){ const a=argv[i]; if(a.startsWith('--')){ const k=a.slice(2); const v=(i+1<argv.length && !argv[i+1].startsWith('--')) ? argv[++i] : '1'; out[k]=v; } } return out; }
function run(cmd, args, opts={}){
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { shell:false, windowsHide:true, ...opts });
    let stdout="", stderr="";
    p.stdout?.on('data', d => { stdout += d.toString(); if(opts.pipeStdout) process.stdout.write(d); });
    p.stderr?.on('data', d => { stderr += d.toString(); if(opts.pipeStderr) process.stderr.write(d); });
    p.on('close', code => resolve({ ok: code===0, code, stdout, stderr }));
    p.on('error', err => resolve({ ok:false, code:-1, stdout, stderr: String(err) }));
  });
}
async function findCmd(name){
  const probe = await run(process.platform === 'win32' ? 'where' : 'which', [name]);
  if(!probe.ok) return null;
  const first = String(probe.stdout||'').split(/\r?\n/).map(s=>s.trim()).find(Boolean);
  return first || null;
}
function escapePsSingle(s){ return String(s).replace(/'/g, "''"); }
function ffPath(p){ return String(p).replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g, "\\\\'"); }
function wavDurationSeconds(wavPath){
  const b = fs.readFileSync(wavPath);
  if(String(b.slice(0,4)) !== 'RIFF' || String(b.slice(8,12)) !== 'WAVE') return 1;
  const byteRate = b.readUInt32LE(28);
  const dataSize = b.readUInt32LE(40);
  if(!byteRate) return 1;
  return Math.max(1, dataSize / byteRate);
}
async function tryOllamaScenes(prompt){
  try{
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12000);
    const res = await fetch('http://127.0.0.1:11434/api/chat', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        model:'llama3.1:8b',
        stream:false,
        format:'json',
        messages:[
          { role:'system', content:'Return valid JSON only with shape {"title":string,"scenes":[{"title":string,"narration":string}]}. Create 4 short cinematic scenes. Each narration should be 1-3 sentences, vivid, family-safe, and directly based on the prompt.' },
          { role:'user', content: prompt }
        ]
      }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if(!res.ok) return null;
    const data = await res.json();
    const raw = data?.message?.content || data?.response || '';
    const parsed = JSON.parse(raw);
    if(!parsed || !Array.isArray(parsed.scenes) || !parsed.scenes.length) return null;
    return parsed;
  }catch{ return null; }
}
function fallbackScenes(prompt){
  const clean = String(prompt||'').trim();
  const sentenceBits = clean.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
  const seeds = sentenceBits.length ? sentenceBits : [clean || 'A new cinematic story'];
  const title = seeds[0].slice(0, 64) || 'Untitled Story';
  const labels = ['Opening beat','Rising motion','Big turn','Final payoff'];
  const scenes = labels.map((label, i) => {
    const src = seeds[i % seeds.length];
    return {
      title: label,
      narration: i === 0 ? `We open on ${src.replace(/[.!?]+$/,'')}. The mood locks in fast and the world starts moving.`
        : i === labels.length-1 ? `Everything resolves around ${src.replace(/[.!?]+$/,'')}. The ending lands clean and memorable.`
        : `The story pushes forward through ${src.replace(/[.!?]+$/,'')}. Stakes rise and the scene keeps the momentum alive.`
    };
  });
  return { title, scenes };
}
async function synthesizeVoice(scene, wavPath){
  const script = [
    "Add-Type -AssemblyName System.Speech",
    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "$s.Rate = 0",
    "$s.Volume = 100",
    `$s.SetOutputToWaveFile('${escapePsSingle(wavPath)}')`,
    `$text = '${escapePsSingle(scene.narration)}'`,
    "$s.Speak($text)",
    "$s.Dispose()"
  ].join('; ');
  return await run('powershell', ['-NoProfile','-ExecutionPolicy','Bypass','-Command', script]);
}
async function renderSceneClip(ffmpeg, scene, wavPath, clipPath, titleTxt, bodyTxt){
  const duration = Math.max(3, Math.ceil(wavDurationSeconds(wavPath)) + 1);
  const vf = [
    `drawbox=x=48:y=48:w=1184:h=624:color=black@0.28:t=fill`,
    `drawtext=textfile='${ffPath(titleTxt)}':fontcolor=0xFBBF24:fontsize=42:x=72:y=86:line_spacing=8`,
    `drawtext=textfile='${ffPath(bodyTxt)}':fontcolor=white:fontsize=30:x=72:y=180:line_spacing=12`
  ].join(',');
  return await run(ffmpeg, [
    '-y',
    '-f','lavfi','-i',`color=c=${bgColor(hashCode(scene.title + scene.narration))}:s=1280x720:d=${duration}`,
    '-i', wavPath,
    '-vf', vf,
    '-c:v','libx264',
    '-tune','stillimage',
    '-c:a','aac',
    '-pix_fmt','yuv420p',
    '-shortest',
    clipPath,
  ]);
}

async function main(){
  const args = argsMap(process.argv);
  const prompt = Buffer.from(String(args.promptB64 || ''), 'base64').toString('utf8').trim();
  const projectRoot = path.resolve(String(args.projectRoot || process.cwd()));
  if(!prompt){ log('ERROR=Missing prompt'); process.exit(1); }
  const ffmpeg = await findCmd('ffmpeg');
  if(!ffmpeg){ log('ERROR=ffmpeg not found on PATH'); process.exit(1); }
  const outRoot = path.join(projectRoot, 'backend_scaffold', 'outputs', 'writers_media_runs');
  ensureDir(outRoot);
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const outDir = path.join(outRoot, `${stamp}_${sanitizeName(prompt.slice(0,40))}`);
  ensureDir(outDir);
  ensureDir(path.join(outDir,'scenes'));
  ensureDir(path.join(outDir,'voice'));
  log(`RUN_DIR=${outDir}`);
  log('STAGE:structure:running');
  const structured = await tryOllamaScenes(prompt) || fallbackScenes(prompt);
  fs.writeFileSync(path.join(outDir, 'story.json'), JSON.stringify(structured, null, 2));
  log('STAGE:structure:done');

  const sceneClips = [];
  let i = 0;
  for(const scene of structured.scenes.slice(0, 6)){
    i += 1;
    log(`STAGE:scene_${i}:running`);
    const wavPath = path.join(outDir, 'voice', `scene_${String(i).padStart(2,'0')}.wav`);
    const titlePath = path.join(outDir, 'scenes', `scene_${String(i).padStart(2,'0')}_title.txt`);
    const bodyPath = path.join(outDir, 'scenes', `scene_${String(i).padStart(2,'0')}_body.txt`);
    const clipPath = path.join(outDir, 'scenes', `scene_${String(i).padStart(2,'0')}.mp4`);
    fs.writeFileSync(titlePath, scene.title + '\n');
    fs.writeFileSync(bodyPath, scene.narration + '\n');

    log(`STAGE:voice_${i}:running`);
    const voice = await synthesizeVoice(scene, wavPath);
    if(!voice.ok){
      log(`ERROR=Voice synthesis failed for scene ${i}: ${voice.stderr || voice.stdout || voice.code}`);
      process.exit(1);
    }
    log(`STAGE:voice_${i}:done`);

    log(`STAGE:render_${i}:running`);
    const clip = await renderSceneClip(ffmpeg, scene, wavPath, clipPath, titlePath, bodyPath);
    if(!clip.ok){
      log(`ERROR=Scene render failed for scene ${i}: ${clip.stderr || clip.stdout || clip.code}`);
      process.exit(1);
    }
    log(`STAGE:render_${i}:done`);
    log(`STAGE:scene_${i}:done`);
    sceneClips.push(clipPath);
  }

  log('STAGE:assembly:running');
  const concatPath = path.join(outDir, 'concat.txt');
  fs.writeFileSync(concatPath, sceneClips.map(p => `file '${String(p).replace(/\\/g,'/')}'`).join('\n'));
  const finalVideo = path.join(outDir, 'final_story.mp4');
  const assembled = await run(ffmpeg, ['-y','-f','concat','-safe','0','-i',concatPath,'-c','copy',finalVideo]);
  if(!assembled.ok){
    log(`ERROR=Final assembly failed: ${assembled.stderr || assembled.stdout || assembled.code}`);
    process.exit(1);
  }
  const manifest = {
    ok: true,
    prompt,
    title: structured.title,
    outDir,
    finalVideo,
    scenes: structured.scenes.slice(0,6).map((scene, idx) => ({ index: idx+1, title: scene.title, narration: scene.narration, clip: sceneClips[idx] })),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  log('STAGE:assembly:done');
  log('STAGE:import:done');
  log(`FINAL_OUTPUT=${finalVideo}`);
  log(`MANIFEST=${path.join(outDir, 'manifest.json')}`);
}

main().catch((err) => {
  log(`ERROR=${err?.stack || err?.message || String(err)}`);
  process.exit(1);
});
