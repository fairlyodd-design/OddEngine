import React, { useMemo, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import CardFrame from "../components/CardFrame";
import { buildMusicBundle, createMusicProject, generateMusicProject, getActiveMusicProjectId, getLastMusicBundle, listMusicProjects, setActiveMusicProjectId, updateMusicProject, type MusicAction, type MusicProject, type SectionDynamicsProfile, type StylePreset, type VocalMode } from "../lib/musicLab";
import { runOnePromptFlow } from "../lib/onePromptFlow";
import { clearMusicJobs, createMusicJobFromPayload, listMusicJobs } from "../lib/musicPreview";
import { getMusicProviderConfig, getMusicRuntimeDoctor, probeMusicProvider, runMusicModelSmokeTest, saveMusicProviderConfig } from "../lib/musicProviderBridge";
import MusicWaveform from "../components/MusicWaveform";
import { createPublisherJobFromMusicRelease, musicReleaseDragPayload, saveLatestMusicRelease } from "../lib/musicRelease";

export default function MusicLab({ onNavigate }: { onNavigate: (panelId: string) => void }) {
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [providerTick, setProviderTick] = useState(0);
  const [probe, setProbe] = useState<any>(null);
  const [runtimeDoctor, setRuntimeDoctor] = useState<any>(null);
  const [exportInfo, setExportInfo] = useState<any>(null);
  const [actionMsg, setActionMsg] = useState<string>("");
  const [releaseQueuedMsg, setReleaseQueuedMsg] = useState<string>("");
  const [smokeInfo, setSmokeInfo] = useState<any>(null);
  const projects = useMemo(() => { void tick; return listMusicProjects(); }, [tick]);
  const jobs = useMemo(() => { void tick; return listMusicJobs(); }, [tick]);
  const activeId = getActiveMusicProjectId() || projects[0]?.id || "";
  const active = projects.find((x) => x.id === activeId) || null;
  const bundle = getLastMusicBundle();
  void providerTick;
  const providerCfg = getMusicProviderConfig();

  const ensureProject = () => {
    if (active) return active;
    const next = createMusicProject({ title: "Neon Heartline", prompt: "An emotional anthem about rising through the dark and building a brighter future." });
    setTick((x) => x + 1);
    return next;
  };

  const update = (patch: Partial<MusicProject>) => {
    const base = ensureProject();
    const current = listMusicProjects().find((x) => x.id === base.id) || base;
    updateMusicProject(current.id, patch);
    setTick((x) => x + 1);
  };

async function mergeFinalRelease() {
  const base = String(providerCfg.endpoint || "").replace(/\/$/, "");
  if (!base) {
    setActionMsg("Final release failed: provider endpoint is empty.");
    return;
  }
  try {
    setActionMsg("Merging final release package...");
    const res = await fetch(`${base}/final-release/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: current.title || "Untitled release" }),
    });
    const json = await res.json().catch(() => ({}));
    setExportInfo(json);
    if (!res.ok || !json?.ok) {
      setActionMsg(`Final release failed: ${json?.error || `HTTP ${res.status}`}`);
      return;
    }
    const asset = saveLatestMusicRelease({
      folder: json?.folder || "",
      title: current.title || json?.metadata?.title || "Untitled release",
      files: json?.files || [],
      metadata: json?.metadata || null,
      latest: json?.latest || null,
      createdAt: Date.now(),
    });
    setReleaseQueuedMsg("");
    setActionMsg(`Final release ready: ${json?.folder || "release folder created"}`);
    setTick((x) => x + 1);
  } catch (e: any) {
    setActionMsg(`Final release failed: ${e?.message || String(e)}`);
  }
}

async function inspectLatestReleaseSource() {
  const base = String(providerCfg.endpoint || "").replace(/\/$/, "");
  if (!base) {
    setActionMsg("Inspect failed: provider endpoint is empty.");
    return;
  }
  try {
    setActionMsg("Inspecting latest render files...");
    const res = await fetch(`${base}/debug/files`);
    const json = await res.json().catch(() => ({}));
    setExportInfo(json);
    if (!res.ok || !json?.ok) {
      setActionMsg(`Inspect failed: ${json?.error || `HTTP ${res.status}`}`);
      return;
    }
    const latestFolder = json?.latest?.runRoot || "latest run unavailable";
    setActionMsg(`Inspect success: ${latestFolder}`);
  } catch (e: any) {
    setActionMsg(`Inspect failed: ${e?.message || String(e)}`);
  }
}

function queueLatestReleaseToPublisher() {
  const release = exportInfo?.folder ? {
    folder: exportInfo.folder,
    title: current.title || exportInfo?.metadata?.title || 'Untitled release',
    files: exportInfo?.files || [],
    metadata: exportInfo?.metadata || null,
    latest: exportInfo?.latest || null,
    createdAt: Date.now(),
  } : null;
  if (!release) {
    setReleaseQueuedMsg('Queue publish failed: merge the final release first.');
    return;
  }
  const asset = saveLatestMusicRelease(release);
  createPublisherJobFromMusicRelease(asset);
  setReleaseQueuedMsg(`Queued in Publisher Hub: ${asset.title}`);
}

function runtimeBadgeText() {
  const doctor = runtimeDoctor || probe?.runtime || null;
  if (!doctor) return "Runtime status not checked yet";
  if (doctor.status === "ready") return "Runtime Ready";
  if (doctor.runtimeLockPresent) return "Missing Dependency / Partial";
  return "Missing Dependency";
}


function updateSectionBar(name: "intro" | "verse" | "chorus" | "outro", value: string) {
  update({
    sectionBars: {
      ...(current.sectionBars || { intro: 2, verse: 4, chorus: 4, outro: 2 }),
      [name]: Number(value || 1),
    },
  } as Partial<MusicProject>);
}


function updateSectionDynamic(name: "intro" | "verse" | "chorus" | "outro", field: keyof SectionDynamicsProfile, value: string) {
  const currentDynamics = current.sectionDynamics || {
    intro: { energy: 54, density: 34, drums: 26, motion: "rise" },
    verse: { energy: 68, density: 58, drums: 56, motion: "drive" },
    chorus: { energy: 95, density: 88, drums: 90, motion: "explode" },
    outro: { energy: 48, density: 28, drums: 22, motion: "fall" },
  };
  update({
    sectionDynamics: {
      ...currentDynamics,
      [name]: {
        ...currentDynamics[name],
        [field]: field === "motion" ? value : Number(value || 0),
      },
    },
  } as Partial<MusicProject>);
}

async function runSmokeTestAndFirstSong() {
  const base = ensureProject();
  setBusy(true);
  try {
    setActionMsg("Running model smoke test and generating first real song...");
    const result = await runMusicModelSmokeTest({
      title: base.title || "OddEngine First Real Song",
      prompt: base.prompt,
      genre: base.genre,
      bpm: base.bpm,
      key: base.key,
      vibe: base.vibe,
      vocalProfile: base.vocalProfile,
      vocalMode: (base as any).vocalMode || "hybrid",
      mode: base.mode,
      lyrics: base.lyrics,
      arrangement: base.arrangement,
      renderBrief: base.renderBrief,
      songLengthSec: base.songLengthSec,
      sectionBars: base.sectionBars,
      sectionDynamics: base.sectionDynamics,
      enableVocals: base.enableVocals,
      stylePreset: base.stylePreset,
    });
    setSmokeInfo(result);
    setExportInfo(result?.release || null);
    if (result?.release?.folder) {
      const asset = saveLatestMusicRelease({
        folder: result.release.folder,
        title: base.title || result?.title || "Untitled release",
        files: result.release.files || [],
        metadata: result.release.metadata || null,
        latest: result.latest || null,
        createdAt: Date.now(),
      });
      createPublisherJobFromMusicRelease(asset);
      setReleaseQueuedMsg(`Queued in Publisher Hub: ${asset.title}`);
    }
    await createMusicJobFromPayload({
      title: base.title || "OddEngine First Real Song",
      prompt: base.prompt,
      genre: base.genre,
      bpm: base.bpm,
      key: base.key,
      vibe: base.vibe,
      vocalProfile: base.vocalProfile,
      vocalMode: (base as any).vocalMode || "hybrid",
      mode: base.mode,
      lyrics: base.lyrics,
      arrangement: base.arrangement,
      renderBrief: base.renderBrief,
      songLengthSec: base.songLengthSec,
      sectionBars: base.sectionBars,
      sectionDynamics: base.sectionDynamics,
      enableVocals: base.enableVocals,
      stylePreset: base.stylePreset,
    });
    setActionMsg(result?.ok ? `Smoke test passed: ${result?.release?.folder || "release ready"}` : `Smoke test failed: ${(result?.failReasons || []).join(", ")}`);
    setTick((x) => x + 1);
  } catch (e: any) {
    setActionMsg(`Smoke test failed: ${e?.message || String(e)}`);
  } finally {
    setBusy(false);
  }
}

  const runAction = async (action: MusicAction) => {
    const base = ensureProject();
    setBusy(true);
    try {
      const { project } = generateMusicProject(base, action);
      const handoff = buildMusicBundle(project);
      setTick((x) => x + 1);
      return handoff;
    } finally {
      setBusy(false);
    }
  };

  const runFullFlow = async () => {
    const handoff = await runAction(active?.mode === "instrumental" ? "make-instrumental" : "create-song");
    if (!handoff) return;
    runOnePromptFlow({
      handoff: handoff as any,
      autoPublish: true,
      autoDraftProducts: true,
      publishMode: "assisted",
    });
    const title = (handoff as any)?.title || active?.title || "Untitled song";
    await createMusicJobFromPayload({ title, prompt: current.prompt, genre: current.genre, bpm: current.bpm, key: current.key, vibe: current.vibe, vocalProfile: current.vocalProfile, vocalMode: (current as any).vocalMode || "hybrid", mode: current.mode, enableVocals: current.enableVocals, stylePreset: current.stylePreset, lyrics: current.lyrics, arrangement: current.arrangement, renderBrief: current.renderBrief, songLengthSec: current.songLengthSec, sectionBars: current.sectionBars, sectionDynamics: current.sectionDynamics });
    setTick((x) => x + 1);
    onNavigate("PublisherHub");
  };

  const current = active || ensureProject();

  return (
    <div className="panelRoot">
      <PanelHeader title="🎵 Music Lab" subtitle="Song prompt, render queue, audio preview, stems, cover art, and lyric-video lane." panelId="MusicLab" storagePrefix="oddengine:musiclab" showCopilot />
      <div className="writersGrid">
        <div className="writersLeft">
          <CardFrame title="Song prompt" subtitle="Prompt → lyrics → arrangement → render brief → publish pack" storageKey="musiclab:prompt" className="softCard">
            <div className="studioMetaGrid">
              <input className="input" value={current.title} onChange={(e) => update({ title: e.target.value, releaseMetadata: { ...current.releaseMetadata, releaseTitle: e.target.value } })} placeholder="Song title" />
              <input className="input" value={current.genre} onChange={(e) => update({ genre: e.target.value })} placeholder="Genre" />
              <input className="input" value={current.vibe} onChange={(e) => update({ vibe: e.target.value })} placeholder="Vibe / mood" />
              <input className="input" value={current.bpm} onChange={(e) => update({ bpm: e.target.value })} placeholder="BPM" />
              <input className="input" value={current.key} onChange={(e) => update({ key: e.target.value })} placeholder="Key" />
              <input className="input" value={String(current.songLengthSec)} onChange={(e) => update({ songLengthSec: Number(e.target.value || 150) })} placeholder="Song length seconds" />
            </div>
            <textarea className="textarea mt-5" rows={7} value={current.prompt} onChange={(e) => update({ prompt: e.target.value })} placeholder="Describe the song you want: theme, emotion, energy, references, story arc, instrumentation..." />
            <div className="studioMetaGrid mt-5">
              <select className="input" value={current.mode} onChange={(e) => update({ mode: e.target.value as any })}>
                <option value="song">Song / vocal</option>
                <option value="instrumental">Instrumental</option>
              </select>
              <select className="input" value={current.vocalProfile} onChange={(e) => update({ vocalProfile: e.target.value as any })}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="character">Character</option>
                <option value="duet">Duet</option>
                <option value="choir">Choir</option>
                <option value="none">None</option>
              </select>
              <select className="input" value={(current as any).vocalMode || "hybrid"} onChange={(e) => update({ vocalMode: e.target.value as VocalMode } as Partial<MusicProject>)}>
                <option value="spoken">Spoken</option>
                <option value="hybrid">Hybrid</option>
                <option value="sing">Sing</option>
              </select>
              <input className="input" value={String(current.chorusStrength)} onChange={(e) => update({ chorusStrength: Number(e.target.value || 80) })} placeholder="Chorus strength" />
              <select className="input" value={current.stylePreset} onChange={(e) => update({ stylePreset: e.target.value as StylePreset })}>
                <option value="default">Default</option>
                <option value="lofi">LoFi</option>
                <option value="cinematic">Cinematic</option>
                <option value="trap">Trap</option>
                <option value="edm">EDM</option>
              </select>
              <label className="cluster" style={{ alignItems: "center" }}>
                <input type="checkbox" checked={current.enableVocals} onChange={(e) => update({ enableVocals: e.target.checked, mode: e.target.checked ? current.mode : "instrumental" })} />
                <span>Enable vocals</span>
              </label>
              <label className="cluster" style={{ alignItems: "center" }}>
                <input type="checkbox" checked={current.explicit} onChange={(e) => update({ explicit: e.target.checked })} />
                <span>Explicit</span>
              </label>
            </div>
            <div className="studioMetaGrid mt-5">
              <input className="input" value={String(current.sectionBars?.intro ?? 2)} onChange={(e) => updateSectionBar("intro", e.target.value)} placeholder="Intro bars" />
              <input className="input" value={String(current.sectionBars?.verse ?? 4)} onChange={(e) => updateSectionBar("verse", e.target.value)} placeholder="Verse bars" />
              <input className="input" value={String(current.sectionBars?.chorus ?? 4)} onChange={(e) => updateSectionBar("chorus", e.target.value)} placeholder="Chorus bars" />
              <input className="input" value={String(current.sectionBars?.outro ?? 2)} onChange={(e) => updateSectionBar("outro", e.target.value)} placeholder="Outro bars" />
            </div>
            <div className="mt-5">
              <div className="small mb-2">True section-aware composer</div>
              {["intro", "verse", "chorus", "outro"].map((name) => {
                const cfg = (current.sectionDynamics as any)?.[name] || { energy: 50, density: 50, drums: 50, motion: "drive" };
                return (
                  <div key={name} className="studioMetaGrid" style={{ marginBottom: 8 }}>
                    <div className="small" style={{ textTransform: "capitalize", alignSelf: "center" }}>{name}</div>
                    <input className="input" value={String(cfg.energy ?? 50)} onChange={(e) => updateSectionDynamic(name as any, "energy", e.target.value)} placeholder={`${name} energy`} />
                    <input className="input" value={String(cfg.density ?? 50)} onChange={(e) => updateSectionDynamic(name as any, "density", e.target.value)} placeholder={`${name} density`} />
                    <input className="input" value={String(cfg.drums ?? 50)} onChange={(e) => updateSectionDynamic(name as any, "drums", e.target.value)} placeholder={`${name} drums`} />
                    <select className="input" value={cfg.motion || "drive"} onChange={(e) => updateSectionDynamic(name as any, "motion", e.target.value)}>
                      <option value="low">Low</option>
                      <option value="rise">Rise</option>
                      <option value="drive">Drive</option>
                      <option value="explode">Explode</option>
                      <option value="fall">Fall</option>
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="small mt-3">Basic song structure control: intro, verse, chorus, outro.</div>
            <div className="row wrap mt-5">
              <button className="tabBtn" disabled={busy} onClick={() => runAction("create-song")}>Create song</button>
              <button className="tabBtn" disabled={busy} onClick={() => runAction("extend-track")}>Extend track</button>
              <button className="tabBtn" disabled={busy} onClick={() => runAction("make-instrumental")}>Make instrumental</button>
              <button className="tabBtn" disabled={busy} onClick={() => runAction("remaster")}>Remaster</button>
              <button className="tabBtn" disabled={busy} onClick={() => runAction("alt-versions")}>Generate alt versions</button>
              <button className="tabBtn" disabled={busy} onClick={runFullFlow}>1 Prompt → Ship It</button>
              <button className="tabBtn" disabled={busy} onClick={runSmokeTestAndFirstSong}>Smoke test + first real song</button>
            </div>
            <div className="note mt-4">
              Prompt, vocal mode, singing mode, chorus boost FX, alt versions, render handoff, preview, and release packaging — all in your own OddEngine music lane.
            </div>
          </CardFrame>

          <CardFrame title="Projects" subtitle="Saved song ideas and in-progress releases" storageKey="musiclab:projects" className="softCard">
            <div className="row wrap">
              <button className="tabBtn" onClick={() => { createMusicProject({ title: "New song idea" }); setTick((x) => x + 1); }}>New project</button>
              <button className="tabBtn" onClick={() => onNavigate("RenderLab")}>Open Render Lab</button>
              <button className="tabBtn" onClick={() => onNavigate("PublisherHub")}>Open Publisher Hub</button>
            </div>
            <div className="grid mt-4">
              {projects.map((project) => (
                <div key={project.id} className="studioPipelineCard">
                  <div className="cluster spread">
                    <div>
                      <div className="h">{project.title}</div>
                      <div className="small">{project.genre} • {project.mode} • {project.vocalProfile}</div>
                    </div>
                    <button className="tabBtn" onClick={() => { setActiveMusicProjectId(project.id); setTick((x) => x + 1); }}>Open</button>
                  </div>
                </div>
              ))}
            </div>
          </CardFrame>
        </div>

        <div className="writersCenter">
          <CardFrame title="Lyrics + arrangement" subtitle="Generated song core" storageKey="musiclab:lyrics" className="softCard">
            <div className="studioSplitShell">
              <div className="studioExportBlock">
                <div className="small">Lyrics</div>
                <pre>{current.lyrics || "Run Create song to generate lyrics."}</pre>
              </div>
              <div className="studioExportBlock">
                <div className="small">Arrangement</div>
                <pre>{current.arrangement || "Arrangement details will appear here."}</pre>
              </div>
            </div>
          </CardFrame>

          
          <CardFrame title="Model smoke test" subtitle="Verify runtime, generate first song, waveform, stems, and final release" storageKey="musiclab:smoke" className="softCard">
            <div className="row wrap">
              <button className="tabBtn" disabled={busy} onClick={runSmokeTestAndFirstSong}>Run smoke test + first song</button>
            </div>
            <div className="small mt-3">{smokeInfo?.ok ? "PASS" : smokeInfo ? "FAIL" : "Not run yet"}</div>
            {smokeInfo ? (
              <div className="grid mt-3">
                <div className="studioPipelineCard"><div className="small">Audio exists: {String(!!smokeInfo?.checks?.audioExists)}</div><div className="small">Duration: {String(smokeInfo?.checks?.durationSeconds || 0)}s</div></div>
                <div className="studioPipelineCard"><div className="small">Waveform rendered: {String(!!smokeInfo?.checks?.waveformRendered)}</div><div className="small">Stems exist: {String(!!smokeInfo?.checks?.stemsExist)}</div><div className="small">Section-aware dynamics: {smokeInfo?.latest?.meta?.sectionDynamics ? "enabled" : "pending"}</div></div>
                <div className="studioPipelineCard"><div className="small">Merge works: {String(!!smokeInfo?.checks?.mergeWorks)}</div><div className="small">Release folder: {smokeInfo?.release?.folder || "n/a"}</div></div>
                {Array.isArray(smokeInfo?.failReasons) && smokeInfo.failReasons.length ? <div className="studioPipelineCard"><div className="small">Fail reasons: {smokeInfo.failReasons.join(", ")}</div></div> : null}
              </div>
            ) : null}
          </CardFrame>

<CardFrame title="Render queue + audio preview" subtitle="Actual queue cards, preview player, waveform, and stems" storageKey="musiclab:preview" className="softCard">
            <div className="row wrap">
              <button className="tabBtn" onClick={async () => { try { setActionMsg("Queueing music render..."); await createMusicJobFromPayload({ title: current.title || "Untitled render", prompt: current.prompt, genre: current.genre, bpm: current.bpm, key: current.key, vibe: current.vibe, vocalProfile: current.vocalProfile, vocalMode: (current as any).vocalMode || "hybrid", mode: current.mode, enableVocals: current.enableVocals, stylePreset: current.stylePreset, lyrics: current.lyrics, arrangement: current.arrangement, renderBrief: current.renderBrief, songLengthSec: current.songLengthSec, sectionBars: current.sectionBars, sectionDynamics: current.sectionDynamics }); setTick((x) => x + 1); setActionMsg("Render finished. Inspect latest render source to verify files or merge the final release."); } catch (e: any) { setActionMsg(`Render failed: ${e?.message || String(e)}`); } }}>Queue render</button>
              <button className="tabBtn" onClick={() => { clearMusicJobs(); setTick((x) => x + 1); }}>Clear queue</button>
            </div>
            <div className="grid mt-4">
              {jobs.length === 0 ? <div className="small">No render jobs yet.</div> : jobs.map((job) => (
                <div key={job.id} className="studioPipelineCard">
                  <div className="cluster spread">
                    <div>
                      <div className="h">{job.title}</div>
                      <div className="small">{job.status} • {job.progress}%</div>
                    </div>
                    <span className="studioPill">{new Date(job.createdAt).toLocaleTimeString()}</span>
                  </div>

                  <div className="row wrap mt-4" style={{ alignItems: "end", gap: 6 }}>
                    <MusicWaveform values={job.waveform} compact />
                  </div>

                  {job.audioUrl ? (
                    <div className="mt-4">
                      <div className="small">Main preview</div>
                      <audio controls className="mt-2" src={job.audioUrl} />
                    </div>
                  ) : null}

                  {job.stems ? (
                    <div className="studioSplitShell mt-4">
                      <div className="studioExportBlock">
                        <div className="small">Vocals</div>
                        <audio controls src={job.stems.vocals} />
                      </div>
                      <div className="studioExportBlock">
                        <div className="small">Instrumental</div>
                        <audio controls src={job.stems.instrumental} />
                      </div>
                      <div className="studioExportBlock">
                        <div className="small">Drums</div>
                        <audio controls src={job.stems.drums} />
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </CardFrame>
        </div>

        <div className="writersRight">
          <CardFrame title="Release pack" subtitle="Cover art + lyric video preview lane + distribution pack" storageKey="musiclab:release" className="softCard">
            <div className="row wrap">
              <button className="tabBtn" onClick={inspectLatestReleaseSource}>Inspect latest render source</button>
              <button className="tabBtn" onClick={mergeFinalRelease}>Download Final Release</button>
              <button className="tabBtn" onClick={queueLatestReleaseToPublisher}>Queue in Publisher Hub</button>
            </div>
            {actionMsg ? <div className="note mt-4">{actionMsg}</div> : null}
            {releaseQueuedMsg ? <div className="note mt-4">{releaseQueuedMsg}</div> : null}
            {jobs[0]?.waveform ? <MusicWaveform values={jobs[0].waveform} /> : null}

            {jobs[0]?.coverArtUrl ? (
              <div className="studioExportBlock">
                <div className="small">Cover art preview</div>
                <img src={jobs[0].coverArtUrl} alt="Cover art preview" style={{ width: "100%", borderRadius: 16, marginTop: 8 }} />
              </div>
            ) : null}

            {jobs[0]?.lyricVideoUrl ? (
              <div className="studioExportBlock mt-4">
                <div className="small">Lyric video preview lane</div>
                <img src={jobs[0].lyricVideoUrl} alt="Lyric video preview" style={{ width: "100%", borderRadius: 16, marginTop: 8 }} />
              </div>
            ) : null}

            {bundle ? (
              <>
                <div className="studioPillRow mt-4">
                  <span className="studioPill">{bundle.music.genre}</span>
                  <span className="studioPill">{bundle.music.bpm} BPM</span>
                  <span className="studioPill">{bundle.music.key}</span>
                  <span className="studioPill">{bundle.music.vocalProfile}</span>
                </div>
                <div className="studioExportBlock mt-4">
                  <div className="small">Requested assets</div>
                  <pre>{JSON.stringify(bundle.renderLab.requestedAssets, null, 2)}</pre>
                </div>
                <div className="studioExportBlock mt-4">
                  <div className="small">Distribution pack</div>
                  <pre>{JSON.stringify(bundle.distribution, null, 2)}</pre>
                </div>
              </>
            ) : (
              <div className="small">No music bundle yet. Create a song to generate the release pack.</div>
            )}
            {exportInfo ? <div className="studioExportBlock mt-4"><div className="small">Backend export + file visibility</div><pre>{JSON.stringify(exportInfo, null, 2)}</pre></div> : null}
            {exportInfo?.folder ? (
              <div
                className="studioPipelineCard mt-4"
                draggable
                onDragStart={(e) => {
                  const asset = {
                    folder: exportInfo.folder,
                    title: current.title || exportInfo?.metadata?.title || "Untitled release",
                    files: exportInfo?.files || [],
                    metadata: exportInfo?.metadata || null,
                    latest: exportInfo?.latest || null,
                    createdAt: Date.now(),
                  };
                  saveLatestMusicRelease(asset);
                  e.dataTransfer.setData("application/json", musicReleaseDragPayload(asset));
                  e.dataTransfer.effectAllowed = "copy";
                }}
              >
                <div className="h">Drag this final release into Publisher Hub</div>
                <div className="small mt-2">{exportInfo.folder}</div>
                <div className="studioPillRow mt-4">
                  {(exportInfo.files || []).slice(0, 8).map((file: string) => <span key={file} className="studioPill">{file}</span>)}
                </div>
              </div>
            ) : null}
          </CardFrame>

          <CardFrame title="Music provider bridge" subtitle="Swap internal simulation for local or remote music generation" storageKey="musiclab:providers" className="softCard">
            <div className="studioPipelineCard">
              <div className="h">Generation lanes</div>
              <div className="small mt-2">Song generation</div>
              <div className="small">Vocal generation</div>
              <div className="small">Mastering</div>
              <div className="small">Cover art</div>
              <div className="small">Lyric video</div>
            </div>
            <div className="studioMetaGrid mt-4">
              <select className="input" value={providerCfg.mode} onChange={(e) => { saveMusicProviderConfig({ mode: e.target.value as any }); setProviderTick((x) => x + 1); }}>
                <option value="stub">Stub / built-in fallback</option>
                <option value="local">Local bridge</option>
                <option value="webhook">Webhook / remote</option>
              </select>
              <input className="input" value={providerCfg.endpoint} onChange={(e) => { saveMusicProviderConfig({ endpoint: e.target.value }); setProviderTick((x) => x + 1); }} placeholder="Provider endpoint" />
              <select className="input" value={providerCfg.bridgeEngine || "auto"} onChange={(e) => { saveMusicProviderConfig({ bridgeEngine: e.target.value as any }); setProviderTick((x) => x + 1); }}><option value="auto">Auto detect best engine</option><option value="musicgen-cli">MusicGen model adapter</option><option value="bark-cli">Bark song adapter</option><option value="python-adapter">Procedural / Python adapter</option><option value="external-api-json">External API JSON</option><option value="command-json">Command JSON bridge</option><option value="stub">Stub fallback</option></select>
              <input className="input" value={providerCfg.model} onChange={(e) => { saveMusicProviderConfig({ model: e.target.value }); setProviderTick((x) => x + 1); }} placeholder="Model name" />
              <input className="input" value={providerCfg.healthPath} onChange={(e) => { saveMusicProviderConfig({ healthPath: e.target.value }); setProviderTick((x) => x + 1); }} placeholder="/health" />
              <input className="input" value={providerCfg.externalApiUrl || ""} onChange={(e) => { saveMusicProviderConfig({ externalApiUrl: e.target.value }); setProviderTick((x) => x + 1); }} placeholder="External API URL (optional)" />
              <input className="input" value={providerCfg.command || ""} onChange={(e) => { saveMusicProviderConfig({ command: e.target.value }); setProviderTick((x) => x + 1); }} placeholder="Command JSON template (optional)" />
            </div>
            <div className="row wrap mt-4">
              <label className="cluster" style={{ alignItems: "center" }}>
                <input type="checkbox" checked={providerCfg.enabled} onChange={(e) => { saveMusicProviderConfig({ enabled: e.target.checked }); setProviderTick((x) => x + 1); }} />
                <span>Enable provider bridge</span>
              </label>
              <button className="tabBtn" onClick={() => { saveMusicProviderConfig({ enabled: true, mode: "local", endpoint: "http://127.0.0.1:7010", providerName: "Local Music Bridge", model: "musicgen-adapter", healthPath: "/health", bridgeEngine: "auto" }); setProviderTick((x) => x + 1); }}>Use local preset</button>
              <button className="tabBtn" onClick={async () => { const r = await probeMusicProvider(); setProbe(r); setRuntimeDoctor(r?.runtime || null); }}>Probe provider</button>
              <button className="tabBtn" onClick={async () => { const r = await getMusicRuntimeDoctor(); setRuntimeDoctor(r); }}>Refresh runtime doctor</button>
            </div>
            <div className="small mt-4">Preserves the current queue + preview flow, but now supports a real execution-adapter swap. The included local bridge can run a python adapter that writes actual WAV files and preview assets, then feeds them back into the same UI.</div>
            <div className="studioPipelineCard mt-4">
              <div className="cluster spread">
                <div>
                  <div className="h">Local runtime doctor</div>
                  <div className="small mt-2">{runtimeBadgeText()}</div>
                </div>
                <span className="studioPill">{(runtimeDoctor || probe?.runtime)?.selectedEngine || providerCfg.bridgeEngine || "auto"}</span>
              </div>
              <div className="studioPillRow mt-4">
                <span className="studioPill">{(runtimeDoctor || probe?.runtime)?.status === "ready" ? "Runtime Ready" : "Missing Dependency"}</span>
                <span className="studioPill">{(runtimeDoctor || probe?.runtime)?.models?.musicgen?.loaded ? "MusicGen Model Loaded" : "MusicGen Not Loaded"}</span>
                <span className="studioPill">{(runtimeDoctor || probe?.runtime)?.models?.bark?.loaded ? "Bark Model Loaded" : "Bark Not Loaded"}</span>
              </div>
              <div className="small mt-4">{(runtimeDoctor || probe?.runtime)?.guidance || "Run INSTALL_WINDOWS_MUSIC_RUNTIME.bat inside backend_scaffold, then start RUN_MUSIC_PROVIDER_BRIDGE_RUNTIME.bat."}</div>
              {(runtimeDoctor || probe?.runtime)?.install ? <pre className="mt-4">{JSON.stringify((runtimeDoctor || probe?.runtime).install, null, 2)}</pre> : null}
            </div>
            {probe ? <pre className="mt-4">{JSON.stringify(probe, null, 2)}</pre> : null}
            {runtimeDoctor ? <pre className="mt-4">{JSON.stringify(runtimeDoctor, null, 2)}</pre> : null}
          </CardFrame>
        </div>
      </div>
    </div>
  );
}
