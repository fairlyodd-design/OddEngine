import React, { useEffect, useMemo, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";

type Props = {
  onNavigate?: (panelId: string) => void;
};

const BRIDGE = "http://127.0.0.1:8776";
const DRAFT_KEY = "oddengine:homieCloneStudio:draft:v1";

async function getJson(path: string) {
  const res = await fetch(BRIDGE + path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return await res.json();
}

async function postJson(path: string, body: any) {
  const res = await fetch(BRIDGE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return await res.json();
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveDraft(value: any) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}
function linesToArray(value: string) {
  return String(value || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}
function safeNumber(value: string, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function HomieCloneStudio({ onNavigate }: Props) {
  const [status, setStatus] = useState("Idle.");
  const [health, setHealth] = useState<any>(null);
  const [trainingWorkflow, setTrainingWorkflow] = useState<any>(null);
  const [working, setWorking] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [relation, setRelation] = useState("");
  const [mission, setMission] = useState("");
  const [signatureTone, setSignatureTone] = useState("");
  const [likeness, setLikeness] = useState("");
  const [priorities, setPriorities] = useState("");
  const [emotionalLane, setEmotionalLane] = useState("");
  const [humorStyle, setHumorStyle] = useState("");
  const [warmRate, setWarmRate] = useState("0.88");
  const [focusedRate, setFocusedRate] = useState("0.89");
  const [brightRate, setBrightRate] = useState("0.95");
  const [concernedRate, setConcernedRate] = useState("0.86");
  const [openers, setOpeners] = useState("");
  const [closers, setClosers] = useState("");
  const [avoid, setAvoid] = useState("");
  const [phrasesJson, setPhrasesJson] = useState("[]");
  const [previewText, setPreviewText] = useState("Open Render Lab and tell me the next move for the family-safe workflow.");
  const [previewResult, setPreviewResult] = useState("");

  const consentChecklist = useMemo(
    () => [
      "Only train your own voice or family voices with clear permission.",
      "Do not use this workflow for impersonation or deception.",
      "Use this to preserve tone, warmth, phrases, and legacy intent.",
      "Review generated manifests before any provider training step.",
    ],
    []
  );

  async function loadAll() {
    setWorking(true);
    setStatus("Loading clone bridge…");
    try {
      const [healthRes, profileRes, phrasesRes, trainingRes] = await Promise.all([
        getJson("/health"),
        getJson("/clone-profile"),
        getJson("/family-phrases"),
        getJson("/training-workflow"),
      ]);

      setHealth(healthRes);
      setTrainingWorkflow(trainingRes.trainingWorkflow || null);

      const draft = loadDraft();
      const p = draft?.profile || profileRes.profile || {};
      const fp = draft?.phrases ?? (phrasesRes.familyPhrases?.phrases || []);

      setDisplayName(p.identity?.displayName || "");
      setRelation(p.identity?.relation || "");
      setMission(p.identity?.mission || "");
      setSignatureTone(p.cloneDesign?.signatureTone || "");
      setLikeness((p.cloneDesign?.userLikenessNotes || []).join("\n"));
      setPriorities((p.cloneDesign?.familyPriorities || []).join(", "));
      setEmotionalLane(p.cloneDesign?.emotionalLane || "");
      setHumorStyle(p.cloneDesign?.humorStyle || "");
      setWarmRate(String(p.voice?.cadence?.warmRate ?? "0.88"));
      setFocusedRate(String(p.voice?.cadence?.focusedRate ?? "0.89"));
      setBrightRate(String(p.voice?.cadence?.brightRate ?? "0.95"));
      setConcernedRate(String(p.voice?.cadence?.concernedRate ?? "0.86"));
      setOpeners((p.voice?.phrases?.openers || []).join("\n"));
      setClosers((p.voice?.phrases?.closers || []).join("\n"));
      setAvoid((p.voice?.phrases?.avoid || []).join("\n"));
      setPhrasesJson(JSON.stringify(fp, null, 2));

      setStatus("Clone bridge loaded.");
    } catch (error: any) {
      setStatus(String(error?.message || error));
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    saveDraft({
      profile: {
        identity: { displayName, relation, mission },
        cloneDesign: {
          signatureTone,
          userLikenessNotes: linesToArray(likeness),
          familyPriorities: priorities.split(",").map((x) => x.trim()).filter(Boolean),
          emotionalLane,
          humorStyle,
        },
        voice: {
          cadence: {
            warmRate: safeNumber(warmRate, 0.88),
            focusedRate: safeNumber(focusedRate, 0.89),
            brightRate: safeNumber(brightRate, 0.95),
            concernedRate: safeNumber(concernedRate, 0.86),
          },
          phrases: {
            openers: linesToArray(openers),
            closers: linesToArray(closers),
            avoid: linesToArray(avoid),
          },
        },
      },
      phrases: (() => {
        try { return JSON.parse(phrasesJson || "[]"); } catch { return []; }
      })(),
      previewText,
    });
  }, [
    displayName, relation, mission, signatureTone, likeness, priorities, emotionalLane,
    humorStyle, warmRate, focusedRate, brightRate, concernedRate, openers, closers, avoid,
    phrasesJson, previewText
  ]);

  async function saveProfileToBridge() {
    setWorking(true);
    setStatus("Saving clone profile…");
    try {
      const body = {
        identity: {
          displayName: displayName.trim(),
          relation: relation.trim(),
          mission: mission.trim(),
        },
        cloneDesign: {
          signatureTone: signatureTone.trim(),
          userLikenessNotes: linesToArray(likeness),
          familyPriorities: priorities.split(",").map((x) => x.trim()).filter(Boolean),
          emotionalLane: emotionalLane.trim(),
          humorStyle: humorStyle.trim(),
        },
        voice: {
          cadence: {
            warmRate: safeNumber(warmRate, 0.88),
            focusedRate: safeNumber(focusedRate, 0.89),
            brightRate: safeNumber(brightRate, 0.95),
            concernedRate: safeNumber(concernedRate, 0.86),
          },
          phrases: {
            openers: linesToArray(openers),
            closers: linesToArray(closers),
            avoid: linesToArray(avoid),
          },
        },
      };
      await postJson("/clone-profile", body);
      setStatus("Clone profile saved.");
    } catch (error: any) {
      setStatus(String(error?.message || error));
    } finally {
      setWorking(false);
    }
  }

  async function saveFamilyPhrasesToBridge() {
    setWorking(true);
    setStatus("Saving family phrases…");
    try {
      const phrases = JSON.parse(phrasesJson || "[]");
      await postJson("/family-phrases", { phrases });
      setStatus("Family phrases saved.");
    } catch (error: any) {
      setStatus(String(error?.message || error));
    } finally {
      setWorking(false);
    }
  }

  async function runPreview() {
    setWorking(true);
    setStatus("Running preview…");
    try {
      const res = await postJson("/preview", { text: previewText });
      setPreviewResult(JSON.stringify(res, null, 2));
      setStatus("Preview ready.");
    } catch (error: any) {
      setStatus(String(error?.message || error));
    } finally {
      setWorking(false);
    }
  }

  async function generateManifest() {
    setWorking(true);
    setStatus("Generating training manifest…");
    try {
      const res = await postJson("/generate-training-manifest", {});
      setTrainingWorkflow((prev: any) => ({
        ...(prev || {}),
        sampleCount: res.trainingManifest?.sampleCount || 0,
        manifestPreview: res.trainingManifest || null,
      }));
      setStatus("Training manifest generated.");
    } catch (error: any) {
      setStatus(String(error?.message || error));
    } finally {
      setWorking(false);
    }
  }

  const badges = [
    { label: health?.providerConfigured ? "Neural provider ready" : "Preview mode", tone: health?.providerConfigured ? "good" : "warn" },
    { label: `Memories: ${health?.memoryCount ?? 0}`, tone: "muted" },
    { label: `Family phrases: ${health?.phraseCount ?? 0}`, tone: "muted" },
    { label: `Voice samples: ${health?.trainingSampleCount ?? 0}`, tone: "muted" },
  ] as any;

  return (
    <div className="page" style={{ maxWidth: 1220, margin: "0 auto" }}>
      <PanelHeader
        panelId="HomieCloneStudio"
        title="Homie Clone Studio"
        subtitle="Inside-OS clone profile editor + guided family voice workflow"
        badges={badges}
        rightSlot={
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="tabBtn" onClick={loadAll} disabled={working}>Refresh</button>
            <button className="tabBtn" onClick={() => onNavigate?.("Homie")}>Open Homie</button>
            <button className="tabBtn" onClick={() => onNavigate?.("Books")}>Open Writers Lounge</button>
          </div>
        }
      />

      <div className="card softCard" data-homie-clone-os-editor="v10.36.89" style={{ marginTop: 12, borderColor: "rgba(154,230,255,0.22)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="h">Design the companion from inside the OS</div>
            <div className="sub">
              This is the consent-first clone workflow: shape Homie with your tone, phrases, priorities, memories, and approved training samples.
            </div>
          </div>
          <span className={`badge ${health?.providerConfigured ? "good" : "warn"}`}>{status}</span>
        </div>
        <div className="small" style={{ marginTop: 8 }}>
          Honest mode: this shapes tone and workflow. It does not pretend a perfect identity clone already exists.
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start", marginTop: 12 }}>
        <div className="card softCard">
          <div className="h">Clone identity + tone</div>
          <div className="sub">Make Homie feel more like you without sounding fake, corporate, or over-produced.</div>

          <div className="grid2" style={{ marginTop: 12 }}>
            <div>
              <label className="small">Display name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div>
              <label className="small">Relation</label>
              <input value={relation} onChange={(e) => setRelation(e.target.value)} />
            </div>
          </div>

          <label className="small" style={{ display: "block", marginTop: 12 }}>Mission</label>
          <textarea value={mission} onChange={(e) => setMission(e.target.value)} rows={4} />

          <label className="small" style={{ display: "block", marginTop: 12 }}>Signature tone</label>
          <textarea value={signatureTone} onChange={(e) => setSignatureTone(e.target.value)} rows={4} />

          <label className="small" style={{ display: "block", marginTop: 12 }}>User likeness notes (one per line)</label>
          <textarea value={likeness} onChange={(e) => setLikeness(e.target.value)} rows={5} />

          <label className="small" style={{ display: "block", marginTop: 12 }}>Family priorities (comma separated)</label>
          <input value={priorities} onChange={(e) => setPriorities(e.target.value)} />

          <label className="small" style={{ display: "block", marginTop: 12 }}>Emotional lane</label>
          <textarea value={emotionalLane} onChange={(e) => setEmotionalLane(e.target.value)} rows={3} />

          <label className="small" style={{ display: "block", marginTop: 12 }}>Humor style</label>
          <input value={humorStyle} onChange={(e) => setHumorStyle(e.target.value)} />

          <div className="grid2" style={{ marginTop: 12 }}>
            <div>
              <label className="small">Warm rate</label>
              <input value={warmRate} onChange={(e) => setWarmRate(e.target.value)} />
            </div>
            <div>
              <label className="small">Focused rate</label>
              <input value={focusedRate} onChange={(e) => setFocusedRate(e.target.value)} />
            </div>
          </div>
          <div className="grid2" style={{ marginTop: 12 }}>
            <div>
              <label className="small">Bright rate</label>
              <input value={brightRate} onChange={(e) => setBrightRate(e.target.value)} />
            </div>
            <div>
              <label className="small">Concerned rate</label>
              <input value={concernedRate} onChange={(e) => setConcernedRate(e.target.value)} />
            </div>
          </div>

          <label className="small" style={{ display: "block", marginTop: 12 }}>Openers (one per line)</label>
          <textarea value={openers} onChange={(e) => setOpeners(e.target.value)} rows={4} />

          <label className="small" style={{ display: "block", marginTop: 12 }}>Closers (one per line)</label>
          <textarea value={closers} onChange={(e) => setClosers(e.target.value)} rows={4} />

          <label className="small" style={{ display: "block", marginTop: 12 }}>Avoid phrases (one per line)</label>
          <textarea value={avoid} onChange={(e) => setAvoid(e.target.value)} rows={4} />

          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button className="tabBtn active" onClick={saveProfileToBridge} disabled={working}>Save profile</button>
            <button className="tabBtn" onClick={runPreview} disabled={working}>Preview voice shaping</button>
          </div>
        </div>

        <div className="card softCard">
          <div className="h">Family phrases + consent-first voice workflow</div>
          <div className="sub">Put the recognizable “this sounds like me” lines here, then build a training manifest only from approved samples.</div>

          <label className="small" style={{ display: "block", marginTop: 12 }}>Family phrases JSON</label>
          <textarea value={phrasesJson} onChange={(e) => setPhrasesJson(e.target.value)} rows={14} />
          <div className="small" style={{ marginTop: 6 }}>
            Format: [{"text":"Keep the room calm.","lane":"family","notes":"core tone"}]
          </div>

          <div className="card" data-homie-clone-consent-guide="v10.36.89" style={{ marginTop: 12, background: "rgba(255,212,121,0.06)", borderColor: "rgba(255,212,121,0.18)" }}>
            <div className="h">Guided voice consent workflow</div>
            <div className="small" style={{ marginTop: 8 }}>
              Use this only for your own voice or family members who clearly agree. This is for legacy, warmth, and familiarity — not deception.
            </div>
            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              {consentChecklist.map((item) => (
                <span key={item} className="badge warn">{item}</span>
              ))}
            </div>
            <div className="timelineCard" style={{ marginTop: 12 }}>
              <b>Training drop folder:</b><br />
              {trainingWorkflow?.dropDir || "C:\OddEngine\backend_scaffold\homie_clone_voice_training_drop"}
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              Add clean .wav / .mp3 / .m4a / .flac / .ogg samples plus matching .txt transcript sidecars, then generate the manifest.
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button className="tabBtn active" onClick={generateManifest} disabled={working}>Generate training manifest</button>
              <button className="tabBtn" onClick={saveFamilyPhrasesToBridge} disabled={working}>Save family phrases</button>
            </div>
          </div>

          <div className="grid2" style={{ marginTop: 12, alignItems: "start" }}>
            <div className="timelineCard">
              <b>Bridge summary</b>
              <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
{JSON.stringify({
  providerConfigured: !!health?.providerConfigured,
  memoryCount: health?.memoryCount ?? 0,
  phraseCount: health?.phraseCount ?? 0,
  trainingSampleCount: health?.trainingSampleCount ?? 0,
  profileName: health?.profileName || "Homie",
}, null, 2)}
              </pre>
            </div>
            <div className="timelineCard">
              <b>Training workflow</b>
              <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
{JSON.stringify(trainingWorkflow || {}, null, 2)}
              </pre>
            </div>
          </div>

          <label className="small" style={{ display: "block", marginTop: 12 }}>Preview text</label>
          <textarea value={previewText} onChange={(e) => setPreviewText(e.target.value)} rows={4} />

          <label className="small" style={{ display: "block", marginTop: 12 }}>Preview result</label>
          <textarea value={previewResult} onChange={(e) => setPreviewResult(e.target.value)} rows={14} />
        </div>
      </div>

      <div className="card softCard" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="h">Best next move</div>
            <div className="sub">Fill in the profile first, save 5–10 family phrases, then generate a clean training manifest from approved samples.</div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="tabBtn" onClick={() => onNavigate?.("Books")}>Seed Writers Lounge</button>
            <button className="tabBtn" onClick={() => onNavigate?.("Homie")}>Back to Homie</button>
          </div>
        </div>
      </div>
    </div>
  );
}
