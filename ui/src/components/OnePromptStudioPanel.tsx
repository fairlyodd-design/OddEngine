import React, { useEffect, useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { seedHomieDraft } from "../lib/homieCore";
import { createOnePromptProject, autopilotOnePromptProject, advanceOnePromptProject, markOnePromptProjectBridged, markOnePromptProjectBridgeFailed, type OnePromptProject } from "../lib/creationOrchestrator";
import { getCreativeBackendBase, probeCreativeBackend, submitCreativeJob } from "../lib/creativeBackendBridge";
import type { StudioOutputType } from "../lib/studioPipeline";
import OutputLibraryPanel from "./OutputLibraryPanel";
import { getSelectedArtifactId, listMaterializedArtifacts, maybeMaterializeProject, setSelectedArtifactId, type MaterializedArtifact } from "../lib/artifactMaterializer";
import { createSystemRun, touchSystemRunBySource } from "../lib/systemRunRegistry";
import { logSystemEvent } from "../lib/systemEventLog";
import { recordActionReceipt } from "../lib/actionReceipts";
import { verifyConnector } from "../lib/connectorVerification";

const KEY = "oddengine:studio:oneprompt:v1";

function toStudioType(mode: OnePromptProject["classification"]["mode"]): StudioOutputType {
  if (mode === "book") return "book";
  if (mode === "video") return "video";
  if (mode === "audio") return "song";
  if (mode === "script") return "script";
  return "script";
}

export default function OnePromptStudioPanel({ onNavigate }: { onNavigate: (panelId: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [projects, setProjects] = useState<OnePromptProject[]>(() => loadJSON<OnePromptProject[]>(KEY, []));
  const [busy, setBusy] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{ ok: boolean; status: string; detail?: string }>({ ok: false, status: "unknown" });
  const [artifacts, setArtifacts] = useState<MaterializedArtifact[]>(() => listMaterializedArtifacts());
  const [selectedArtifactId, setSelectedArtifactState] = useState<string>(() => getSelectedArtifactId());

  useEffect(() => {
    saveJSON(KEY, projects);
  }, [projects]);

  useEffect(() => {
    probeCreativeBackend(getCreativeBackendBase()).then((result) => {
      setBackendStatus(result);
      verifyConnector("creative-backend", "Creative backend", !!result?.ok, result?.status || result?.detail || "unknown");
    }).catch(() => {
      setBackendStatus({ ok: false, status: "unreachable" });
      verifyConnector("creative-backend", "Creative backend", false, "unreachable");
    });
    syncArtifacts();
  }, []);

  const active = useMemo(() => projects[0] || null, [projects]);

  function createProject() {
    if (!prompt.trim()) return;
    const project = createOnePromptProject(prompt);
    createSystemRun({ scope: "studio-one-prompt", title: project.productTitle, panelId: "Books", source: "one-prompt-project", sourceId: project.id, status: "running", explanation: project.operatorLine });
    recordActionReceipt({ action: "create-one-prompt-project", scope: "studio", status: "completed", message: `Created ${project.productTitle}`, panelId: "Books" });
    logSystemEvent({ level: "good", scope: "studio", title: `Created ${project.productTitle}`, body: project.headline });
    const next = [project, ...projects];
    setProjects(next);
    setPrompt("");
    queueMicrotask(() => syncArtifacts(next));
  }

  function syncArtifacts(nextProjects?: OnePromptProject[]) {
    const source = nextProjects || projects;
    source.forEach((project) => {
      const materialized = maybeMaterializeProject(project);
      if (materialized) setSelectedArtifactState(materialized.id);
    });
    setArtifacts(listMaterializedArtifacts());
    setSelectedArtifactState(getSelectedArtifactId());
  }

  function replaceProject(id: string, updater: (project: OnePromptProject) => OnePromptProject) {
    setProjects((current) => {
      const next = current.map((project) => project.id === id ? updater(project) : project);
      const updated = next.find((project) => project.id === id);
      if (updated) {
        const done = updated.stages.every((stage) => stage.status === "complete");
        const active = updated.stages.find((stage) => stage.status === "active");
        touchSystemRunBySource("one-prompt-project", updated.id, {
          scope: "studio-one-prompt",
          title: updated.productTitle,
          panelId: "Books",
          status: updated.backendBridgeState === "failed" ? "failed" : done ? "completed" : active ? "running" : "queued",
          explanation: done ? "All planned stages completed and artifact handoff is ready." : active ? `${active.label}: ${active.detail}` : updated.operatorLine,
          userActionNeeded: updated.backendBridgeState === "failed" ? "Reconnect the creative backend or retry the bridge." : undefined,
        });
      }
      queueMicrotask(() => syncArtifacts(next));
      return next;
    });
  }

  function runAutopilot(id: string) {
    recordActionReceipt({ action: "autopilot-one-prompt-project", scope: "studio", status: "running", message: "Autopilot completed all planned stages.", panelId: "Books" });
    logSystemEvent({ level: "info", scope: "studio", title: "Autopilot advanced the active run", body: "The one-prompt project was pushed through all remaining stages." });
    replaceProject(id, (project) => autopilotOnePromptProject(project));
  }

  function advance(id: string) {
    recordActionReceipt({ action: "advance-one-prompt-stage", scope: "studio", status: "completed", message: "Advanced the active studio stage.", panelId: "Books" });
    replaceProject(id, (project) => advanceOnePromptProject(project));
  }

  async function bridge(id: string) {
    const target = projects.find((project) => project.id === id);
    if (!target) return;
    setBusy(true);
    try {
      const result = await submitCreativeJob({
        prompt: target.prompt,
        type: toStudioType(target.classification.mode),
        title: target.productTitle,
      }, getCreativeBackendBase());
      const backendJobId = String(result.id || result.jobId || result.job_id || "submitted");
      verifyConnector("creative-backend", "Creative backend", true, `submitted • ${backendJobId}`);
      logSystemEvent({ level: "good", scope: "studio", title: `Bridge submitted • ${backendJobId}`, body: target.productTitle });
      replaceProject(id, (project) => markOnePromptProjectBridged(project, backendJobId));
      setBackendStatus({ ok: true, status: `submitted • ${backendJobId}` });
    } catch (err: any) {
      const reason = String(err?.message || err || "unknown error");
      verifyConnector("creative-backend", "Creative backend", false, reason);
      logSystemEvent({ level: "error", scope: "studio", title: "Creative bridge submit failed", body: reason });
      replaceProject(id, (project) => markOnePromptProjectBridgeFailed(project, reason));
      setBackendStatus({ ok: false, status: "submit failed", detail: reason });
    } finally {
      setBusy(false);
    }
  }

  function handoffToHomie(project: OnePromptProject) {
    seedHomieDraft([
      `Turn this into the cleanest final audience-ready artifact possible.`,
      `Title: ${project.productTitle}`,
      `Mode: ${project.classification.mode}`,
      `Kind: ${project.classification.kind}`,
      `Prompt: ${project.prompt}`,
      ``,
      `Blueprint:`,
      ...project.blueprint.slice(0, 24).map((item) => `- ${item.title}: ${item.beat}`),
      ``,
      `Deliverables:`,
      ...project.deliverables.map((item) => `- ${item}`),
      ``,
      `Final artifact summary:`,
      project.finalArtifactSummary,
    ].join("\n"), { source: "one-prompt-studio", panelId: "Books" });
    onNavigate("Homie");
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="card softCard" style={{ padding: 14 }}>
        <div className="cluster wrap spread">
          <div>
            <div className="small shellEyebrow">One prompt → final artifact</div>
            <div className="builderSectionTitle">Magic studio lane</div>
            <div className="small mt-2">Drop one idea and let the Studio plan the book, cartoon, movie, song, or script like a futuristic production desk.</div>
          </div>
          <div className="assistantChipWrap">
            <span className="badge good">{projects.length} runs</span>
            <span className="badge">Backend: {backendStatus.status}</span>
          </div>
        </div>

        <textarea
          className="input"
          style={{ minHeight: 118, marginTop: 12 }}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe the finished thing you want. Example: write a 300 page emotional sci-fi novel with a killer opening and a sellable ending. Or: make a short cartoon that is fully packaged for audience release."
        />

        <div className="row wrap" style={{ marginTop: 10, gap: 8 }}>
          <button className="tabBtn active" onClick={createProject}>Create magic run</button>
          {active ? <button className="tabBtn" onClick={() => runAutopilot(active.id)}>Autopilot active run</button> : null}
          {active ? <button className="tabBtn" onClick={() => bridge(active.id)} disabled={busy}>Bridge active run</button> : null}
          <button className="tabBtn" onClick={() => onNavigate("Builder")}>Open Builder / Covers</button>
          <button className="tabBtn" onClick={() => onNavigate("Homie")}>Open Homie</button>
        </div>
      </div>

      {active ? (
        <>
          <div className="card softCard" style={{ padding: 14 }}>
            <div className="cluster wrap spread">
              <div>
                <div className="small shellEyebrow">Best active creation</div>
                <div className="builderSectionTitle">{active.productTitle}</div>
                <div className="small mt-2">{active.headline}</div>
              </div>
              <div className="assistantChipWrap">
                <span className="badge good">{active.classification.label}</span>
                <span className="badge">{active.classification.runtimeHint}</span>
                <span className="badge">{active.progress}%</span>
              </div>
            </div>

            <div className="note" style={{ marginTop: 10 }}>{active.operatorLine}</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 12 }}>
              <Metric title="Audience" value={active.classification.audienceHint} />
              <Metric title="Confidence" value={`${Math.round(active.classification.confidence * 100)}%`} />
              <Metric title="Scale" value={`${active.blueprint.length} ${active.classification.mode === "book" ? "chapters" : active.classification.mode === "video" ? "scenes" : "parts"}`} />
              <Metric title="Polish" value={active.classification.polishLevel} />
            </div>
          </div>

          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1.2fr .8fr" }}>
            <div className="card softCard" style={{ padding: 14 }}>
              <div className="cluster wrap spread">
                <div>
                  <div className="h">Pipeline</div>
                  <div className="sub">The OS breaks big ideas into finishable production steps.</div>
                </div>
                <div className="row wrap" style={{ gap: 8 }}>
                  <button className="tabBtn" onClick={() => advance(active.id)}>Advance stage</button>
                  <button className="tabBtn" onClick={() => handoffToHomie(active)}>Handoff to Homie</button>
                </div>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {active.stages.map((stage) => (
                  <div key={stage.id} style={{ padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: stage.status === "active" ? "rgba(31,79,143,0.22)" : stage.status === "complete" ? "rgba(28,98,71,0.22)" : "rgba(8,12,18,0.35)" }}>
                    <div className="cluster wrap spread">
                      <div style={{ fontWeight: 800 }}>{stage.label}</div>
                      <span className="badge">{stage.status}</span>
                    </div>
                    <div className="small" style={{ marginTop: 6 }}>{stage.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card softCard" style={{ padding: 14 }}>
              <div className="h">Monetize + ship</div>
              <div className="sub">Every creation should end audience-ready and revenue-aware.</div>
              <ul className="small" style={{ marginTop: 10, paddingLeft: 18 }}>
                {active.monetization.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
                <button className="tabBtn" onClick={() => onNavigate("Money")}>Open Money</button>
                <button className="tabBtn" onClick={() => onNavigate("PhoenixIncomeForge")}>Open Phoenix Forge</button>
                <button className="tabBtn" onClick={() => onNavigate("Builder")}>Open Builder / Covers</button>
              </div>
            </div>
          </div>

          <OutputLibraryPanel
            artifacts={artifacts}
            selectedArtifactId={selectedArtifactId}
            onSelect={(artifactId) => {
              setSelectedArtifactId(artifactId);
              setSelectedArtifactState(artifactId);
            }}
          />

          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
            <div className="card softCard" style={{ padding: 14 }}>
              <div className="h">Blueprint</div>
              <div className="sub">This is where the magic becomes manageable.</div>
              <div style={{ display: "grid", gap: 8, marginTop: 10, maxHeight: 420, overflow: "auto" }}>
                {active.blueprint.map((item) => (
                  <div key={`${item.number}-${item.title}`} style={{ padding: 10, borderRadius: 12, background: "rgba(8,12,18,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontWeight: 800 }}>{item.number}. {item.title}</div>
                    <div className="small" style={{ marginTop: 6 }}>{item.beat}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card softCard" style={{ padding: 14 }}>
              <div className="h">Audience-ready pack</div>
              <div className="sub">What the OS is aiming to finish from that single prompt.</div>
              <ul className="small" style={{ marginTop: 10, paddingLeft: 18 }}>
                {active.deliverables.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <pre style={{ marginTop: 14, whiteSpace: "pre-wrap", fontFamily: "inherit", background: "rgba(8,12,18,0.35)", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>{active.finalArtifactSummary}</pre>
            </div>
          </div>
        </>
      ) : (
        <div className="card softCard" style={{ padding: 18 }}>
          <div className="small">No magic run yet. Drop one prompt above and the Studio will build the path from idea → finished artifact.</div>
        </div>
      )}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
      <div className="small shellEyebrow">{title}</div>
      <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{value}</div>
    </div>
  );
}
