
import React, { useEffect, useMemo, useState } from "react";
import { autoAdvanceStudioJob, createStudioJob, advanceStudioJob, StudioJob, StudioOutputType, stageLabel, markStudioJobBridged } from "../lib/studioPipeline";
import { getCreativeBackendBase, setCreativeBackendBase, probeCreativeBackend, submitCreativeJob } from "../lib/creativeBackendBridge";
import { listCreativeQueue, listCreativeOutputs } from "../lib/creativeQueueBridge";
import ArtifactPreviewPanel from "./ArtifactPreviewPanel";

const TYPES: StudioOutputType[] = ["video", "book", "song", "cartoon", "script"];

export default function StudioPipelinePanel() {
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<StudioOutputType>("video");
  const [jobs, setJobs] = useState<StudioJob[]>([]);
  const [backendBase, setBackendBaseState] = useState(getCreativeBackendBase());
  const [backendStatus, setBackendStatus] = useState<{ ok: boolean; status: string; detail?: string }>({ ok: false, status: "unknown" });
  const [queueJobs, setQueueJobs] = useState<any[]>([]);
  const [outputs, setOutputs] = useState<any[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<any>(null);

  const active = useMemo(() => jobs[0], [jobs]);

  useEffect(() => {
    refreshBackend();
    refreshQueueAndOutputs();
  }, []);


async function refreshQueueAndOutputs() {
  try {
    const [q, o] = await Promise.all([
      listCreativeQueue(backendBase),
      listCreativeOutputs(backendBase),
    ]);
    setQueueJobs(q);
    setOutputs(o);
  } catch {
    setQueueJobs([]);
    setOutputs([]);
  }
}

async function refreshBackend() {

    const health = await probeCreativeBackend(backendBase);
    setBackendStatus(health);
  }

  function persistBackendBase(next: string) {
    setBackendBaseState(next);
    setCreativeBackendBase(next);
  }

  function startJob() {
    if (!prompt.trim()) return;
    const job = createStudioJob(prompt, type);
    setJobs([job, ...jobs]);
    setPrompt("");
  }

  function advance(id: string) {
    setJobs(jobs.map(j => j.id === id ? advanceStudioJob(j) : j));
  }

  function autopilot(id: string) {
    setJobs(jobs.map(j => j.id === id ? autoAdvanceStudioJob(j) : j));
  }

  async function bridgeJob(id: string) {
    const target = jobs.find(j => j.id === id);
    if (!target) return;
    try {
      const result = await submitCreativeJob({
        prompt: target.prompt,
        type: target.type,
        title: target.title,
      }, backendBase);
      const backendJobId = String(result.id || result.jobId || result.job_id || "submitted");
      setJobs(jobs.map(j => j.id === id ? markStudioJobBridged(j, backendJobId) : j));
    } catch (err: any) {
      setJobs(jobs.map(j => j.id === id ? {
        ...j,
        notes: [...j.notes, `Live creative backend bridge failed: ${String(err?.message || err)}`],
      } : j));
    }
  }

  return (
    <div style={{ padding: 14, color: "#dff0ff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0 }}>🎬 Live Creative Backend Bridge</h3>
          <div style={{ opacity: .82, marginTop: 6 }}>One prompt → internal pipeline → optional live backend handoff.</div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ fontSize: 12, opacity: .9 }}>Creative Backend URL</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={backendBase}
              onChange={e => persistBackendBase(e.target.value)}
              style={{ flex: 1, minWidth: 320, padding: "8px 10px", borderRadius: 10, background: "rgba(11,18,31,.95)", color: "#eef7ff", border: "1px solid rgba(120,180,255,.18)" }}
            />
            <button onClick={refreshBackend} style={btnSecondary}>Probe Backend</button>
            <button onClick={refreshQueueAndOutputs} style={btnSecondary}>Refresh Queue</button>
          </div>
          <div style={{ opacity: .85 }}>
            Status: <strong>{backendStatus.status}</strong>{backendStatus.detail ? ` • ${backendStatus.detail}` : ""}
          </div>
        </div>

        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the finished thing you want to create..."
          style={{ width: "100%", minHeight: 90, borderRadius: 12, background: "rgba(11,18,31,.95)", color: "#eef7ff", border: "1px solid rgba(120,180,255,.18)", padding: 12 }}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={type}
            onChange={e => setType(e.target.value as StudioOutputType)}
            style={{ padding: "8px 10px", borderRadius: 10, background: "rgba(15,23,36,.95)", color: "#eef7ff", border: "1px solid rgba(120,180,255,.18)" }}
          >
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <button onClick={startJob} style={btnPrimary}>Create Job</button>
          {active && <button onClick={() => autopilot(active.id)} style={btnAccent}>Autopilot Active Job</button>}
          {active && <button onClick={() => bridgeJob(active.id)} style={btnBridge}>Bridge Active Job</button>}
        </div>
      </div>


<div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
  <div style={{ border: "1px solid rgba(120,180,255,.18)", borderRadius: 14, background: "rgba(8,14,24,.84)", padding: 12 }}>
    <div style={{ fontWeight: 800, marginBottom: 8 }}>Live Creative Queue</div>
    <div style={{ display: "grid", gap: 8 }}>
      {queueJobs.length ? queueJobs.map((job, idx) => (
        <div key={job.id || idx} style={{ padding: 10, borderRadius: 10, background: "rgba(15,23,36,.84)", border: "1px solid rgba(120,180,255,.12)" }}>
          <div><strong>{job.title || job.id || "Job"}</strong></div>
          <div style={{ opacity: .82 }}>{job.type || "unknown"} • {job.status || "queued"}</div>
        </div>
      )) : <div style={{ opacity: .72 }}>No queue jobs detected.</div>}
    </div>
  </div>

  <div style={{ border: "1px solid rgba(120,180,255,.18)", borderRadius: 14, background: "rgba(8,14,24,.84)", padding: 12 }}>
    <div style={{ fontWeight: 800, marginBottom: 8 }}>Completed Outputs</div>
    <div style={{ display: "grid", gap: 8 }}>
      {outputs.length ? outputs.map((out, idx) => (
        <div key={out.id || out.path || idx} style={{ padding: 10, borderRadius: 10, background: "rgba(15,23,36,.84)", border: "1px solid rgba(120,180,255,.12)" }}>
          <div><strong>{out.title || out.name || out.id || "Output"}</strong></div>
          <div style={{ opacity: .82 }}>{out.type || "artifact"} • {out.path || out.outputPath || "available"}</div>
          <button onClick={() => setSelectedArtifact(out)} style={{ ...btnSecondary, marginTop: 8 }}>Preview</button>
        </div>
      )) : <div style={{ opacity: .72 }}>No completed outputs detected.</div>}
    </div>
  </div>
</div>


      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {jobs.map(job => (
          <div key={job.id} style={{ border: "1px solid rgba(120,180,255,.18)", borderRadius: 14, background: "rgba(8,14,24,.84)", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <strong style={{ fontSize: 16 }}>{job.title}</strong>
                <div style={{ opacity: .8, marginTop: 4 }}>{job.type.toUpperCase()} • {stageLabel(job.status)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {job.status !== "complete" && <button onClick={() => advance(job.id)} style={btnSecondary}>Advance Stage</button>}
                {job.status !== "complete" && <button onClick={() => autopilot(job.id)} style={btnAccent}>Autopilot</button>}
                <button onClick={() => bridgeJob(job.id)} style={btnBridge}>Bridge Job</button>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ height: 10, background: "rgba(255,255,255,.08)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${job.progress}%`, height: "100%", background: "linear-gradient(90deg, rgba(120,180,255,.6), rgba(120,255,190,.8))" }} />
              </div>
            </div>

            <div style={{ marginTop: 10, whiteSpace: "pre-wrap", opacity: .95 }}>{job.prompt}</div>

            <div style={{ marginTop: 12, borderTop: "1px solid rgba(120,180,255,.12)", paddingTop: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Pipeline Log</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {job.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>

            {job.result && (
              <div style={{ marginTop: 12, borderTop: "1px solid rgba(120,180,255,.12)", paddingTop: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Final Output Pack</div>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{job.result}</pre>
              </div>
            )}
          </div>
        ))}

      <div style={{ marginTop: 16 }}>
        <ArtifactPreviewPanel artifact={selectedArtifact} />
      </div>
    
      </div>
    </div>
  );
}

const btnBase: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(120,180,255,.18)",
  cursor: "pointer",
  color: "#eef7ff",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(180deg, rgba(33,66,120,.92), rgba(22,40,80,.92))",
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: "rgba(15,23,36,.92)",
};

const btnAccent: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(180deg, rgba(20,90,70,.92), rgba(11,53,41,.92))",
};

const btnBridge: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(180deg, rgba(90,70,20,.92), rgba(64,46,11,.92))",
};
