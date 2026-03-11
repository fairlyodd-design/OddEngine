import fs from "node:fs";

const file = "ui/src/panels/Books.tsx";
let s = fs.readFileSync(file, "utf8");

function replaceOnce(search, replacement, label) {
  if (!s.includes(search)) {
    throw new Error(`Could not find marker for: ${label}`);
  }
  s = s.replace(search, replacement);
}

if (!s.includes('from "../lib/renderWorkerBridge";')) {
  replaceOnce(
    'import { oddApi, isDesktop } from "../lib/odd";',
    `import { oddApi, isDesktop } from "../lib/odd";
import {
  createRenderJob,
  getRenderJob,
  getRenderJobs,
  importRenderOutput,
  markRenderWatched,
  type RenderJob,
} from "../lib/renderWorkerBridge";`,
    "renderWorkerBridge import"
  );
}

replaceOnce(
  'const [renderBaseUrl, setRenderBaseUrl] = useState<string>(() => loadJSON<string>(KEY_RENDER_BASE, "http://127.0.0.1:3000/render"));',
  'const [renderBaseUrl, setRenderBaseUrl] = useState<string>(() => loadJSON<string>(KEY_RENDER_BASE, "http://127.0.0.1:8899"));',
  "renderBaseUrl default"
);

if (!s.includes("const [renderJobs, setRenderJobs]")) {
  replaceOnce(
    'const [renderPreviewUrl, setRenderPreviewUrl] = useState<string>(() => loadJSON<string>(KEY_RENDER_PREVIEW, ""));',
    `const [renderPreviewUrl, setRenderPreviewUrl] = useState<string>(() => loadJSON<string>(KEY_RENDER_PREVIEW, ""));
  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [activeRenderJobId, setActiveRenderJobId] = useState<string>("");
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderError, setRenderError] = useState<string>("");
  const [lastRenderSyncAt, setLastRenderSyncAt] = useState<number>(0);`,
    "render bridge state"
  );
}

if (!s.includes("const refreshRenderJobs = async () => {")) {
  replaceOnce(
    '  // UI state',
    `  const refreshRenderJobs = async () => {
    if (!renderBaseUrl) return;
    try {
      const res = await getRenderJobs(renderBaseUrl);
      const jobs = res.jobs || [];
      setRenderJobs(jobs);
      setLastRenderSyncAt(Date.now());
      if (!activeRenderJobId && jobs[0]?.id) {
        setActiveRenderJobId(jobs[0].id);
      }
    } catch (err: any) {
      setRenderError(err?.message || String(err));
    }
  };

  const activeRenderJob = useMemo(
    () => renderJobs.find((job) => job.id === activeRenderJobId) || renderJobs[0] || null,
    [renderJobs, activeRenderJobId]
  );

  const submitRenderJob = async () => {
    if (!renderBaseUrl) {
      setRenderError("Set the render backend base URL first.");
      return;
    }

    setRenderBusy(true);
    setRenderError("");

    try {
      let parsedPayload: Record<string, unknown> | null = null;
      try {
        parsedPayload = JSON.parse(internalRenderJobJson);
      } catch {
        parsedPayload = null;
      }

      const title = active?.title || studioPrompt || "Untitled render";

      const res = await createRenderJob({
        baseUrl: renderBaseUrl,
        projectTitle: title,
        title,
        kind: "video",
        prompt: studioPrompt || active?.logline || "",
        provider: renderProvider,
        productionType,
        visualStyle,
        releaseTarget,
        format: renderFormat,
        fps: renderFps,
        resolution: renderResolution,
        storyboardSummary: latestStoryboardAsset?.content || "",
        assetIds: studioAssets.map((asset) => asset.id),
        handoff: {
          finalAssemblyManifest,
          externalVideoToolHandoff,
          watchDeckManifest,
        },
        promptPack: parsedPayload,
        payload: parsedPayload || {
          finalAssemblyManifest,
          externalVideoToolHandoff,
          watchDeckManifest,
        },
      });

      setActiveRenderJobId(res.job.id);
      setRenderJobs((prev) => [res.job, ...prev.filter((job) => job.id !== res.job.id)]);
      saveComputedAsset(
        "renderJob",
        \`Render Job • \${res.job.title || res.job.projectTitle || title}\`,
        JSON.stringify(res.job, null, 2)
      );
      await refreshRenderJobs();
    } catch (err: any) {
      setRenderError(err?.message || String(err));
    } finally {
      setRenderBusy(false);
    }
  };

  const syncActiveRenderJob = async () => {
    if (!renderBaseUrl || !activeRenderJobId) return;
    try {
      const res = await getRenderJob(renderBaseUrl, activeRenderJobId);
      setRenderJobs((prev) => [res.job, ...prev.filter((job) => job.id !== res.job.id)]);
      setLastRenderSyncAt(Date.now());

      const preview =
        res.job.output?.previewUrl ||
        res.job.output?.localPath ||
        "";

      if (preview && !renderPreviewUrl) {
        setRenderPreviewUrl(preview);
      }
    } catch (err: any) {
      setRenderError(err?.message || String(err));
    }
  };

  const runImportCompletedRender = async () => {
    if (!renderBaseUrl || !activeRenderJobId) return;
    setRenderBusy(true);
    setRenderError("");
    try {
      const res = await importRenderOutput(renderBaseUrl, activeRenderJobId, "OddEngine Render Lab", false);
      setRenderJobs((prev) => [res.job, ...prev.filter((job) => job.id !== res.job.id)]);
      saveComputedAsset(
        "renderJob",
        \`Imported Render • \${res.job.title || res.job.projectTitle || active?.title || "Untitled"}\`,
        JSON.stringify(res.job, null, 2)
      );
      if (res.job.output?.previewUrl) {
        setRenderPreviewUrl(res.job.output.previewUrl);
      }
    } catch (err: any) {
      setRenderError(err?.message || String(err));
    } finally {
      setRenderBusy(false);
    }
  };

  const runWatchCompletedRender = async () => {
    if (!renderBaseUrl || !activeRenderJobId) return;
    setRenderBusy(true);
    setRenderError("");
    try {
      const res = await markRenderWatched(renderBaseUrl, activeRenderJobId);
      setRenderJobs((prev) => [res.job, ...prev.filter((job) => job.id !== res.job.id)]);
      if (res.job.output?.previewUrl) {
        setRenderPreviewUrl(res.job.output.previewUrl);
      }
    } catch (err: any) {
      setRenderError(err?.message || String(err));
    } finally {
      setRenderBusy(false);
    }
  };

  // UI state`,
    "render bridge helpers"
  );
}

if (!s.includes("void refreshRenderJobs();")) {
  replaceOnce(
    '  useEffect(() => { saveJSON(KEY_RENDER_PREVIEW, renderPreviewUrl); }, [renderPreviewUrl]);',
    `  useEffect(() => { saveJSON(KEY_RENDER_PREVIEW, renderPreviewUrl); }, [renderPreviewUrl]);

  useEffect(() => {
    if (!renderBaseUrl) return;
    void refreshRenderJobs();
  }, [renderBaseUrl]);

  useEffect(() => {
    if (!renderBaseUrl || !activeRenderJobId) return;
    const timer = window.setInterval(() => {
      void syncActiveRenderJob();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [renderBaseUrl, activeRenderJobId]);`,
    "render bridge effects"
  );
}

if (!s.includes("RENDER WORKER BRIDGE")) {
  replaceOnce(
    `              <div className="writersDocPreviewGrid mt-4">
                <pre className="writersPlannerPreview">{internalRenderJobJson}</pre>
                <pre className="writersPlannerPreview">{sceneRenderQueue}</pre>
              </div>`,
    `              <div className="card softCard mt-4">
                <div className="cluster wrap spread">
                  <div>
                    <div className="small shellEyebrow">RENDER WORKER BRIDGE</div>
                    <div className="sub mt-2">POST /render/jobs, queue polling, completed output import, and watch flow against the local render backend.</div>
                  </div>
                  <div className="row wrap">
                    <button className="tabBtn active" disabled={renderBusy} onClick={() => void submitRenderJob()}>
                      {renderBusy ? "Submitting…" : "Create render job"}
                    </button>
                    <button className="tabBtn" onClick={() => void refreshRenderJobs()}>Refresh queue</button>
                    <button className="tabBtn" onClick={() => void syncActiveRenderJob()} disabled={!activeRenderJobId}>Poll active</button>
                  </div>
                </div>

                <div className="row wrap mt-3" style={{ gap: 10 }}>
                  <input
                    className="input"
                    style={{ flex: 1, minWidth: 260 }}
                    value={renderBaseUrl}
                    onChange={(e) => setRenderBaseUrl(e.target.value)}
                    placeholder="http://127.0.0.1:8899"
                  />
                </div>

                {renderError ? <div className="note mt-3">{renderError}</div> : null}

                <div className="writersDocPreviewGrid mt-4">
                  <div className="card softCard">
                    <div className="small shellEyebrow">LOCAL RENDER QUEUE</div>
                    <div className="small mt-2">
                      {lastRenderSyncAt ? \`Last sync: \${new Date(lastRenderSyncAt).toLocaleTimeString()}\` : "No sync yet"}
                    </div>
                    {!renderJobs.length ? (
                      <div className="small mt-3">No render jobs yet.</div>
                    ) : (
                      <div className="mt-3" style={{ display: "grid", gap: 10 }}>
                        {renderJobs.slice(0, 8).map((job) => (
                          <button
                            key={job.id}
                            className="writersProducerCard"
                            style={{ textAlign: "left", border: activeRenderJobId === job.id ? "1px solid rgba(255,255,255,0.25)" : undefined }}
                            onClick={() => setActiveRenderJobId(job.id)}
                          >
                            <div className="small shellEyebrow">{job.status || "unknown"}</div>
                            <div className="small"><b>{job.title || job.projectTitle || job.id}</b></div>
                            <div className="small mt-2">Provider: {job.provider || "local-worker"}</div>
                            <div className="small">Progress: {job.progress ?? "—"}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card softCard">
                    <div className="small shellEyebrow">ACTIVE JOB</div>
                    {!activeRenderJob ? (
                      <div className="small mt-3">Select a render job from the queue.</div>
                    ) : (
                      <>
                        <div className="small mt-3"><b>{activeRenderJob.title || activeRenderJob.projectTitle || activeRenderJob.id}</b></div>
                        <div className="small mt-2">Status: <b>{activeRenderJob.status || "unknown"}</b></div>
                        <div className="small">Provider: <b>{activeRenderJob.provider || "local-worker"}</b></div>
                        <div className="small">Progress: <b>{activeRenderJob.progress ?? "—"}</b></div>
                        {activeRenderJob.workerMessage ? (
                          <div className="small mt-2">{activeRenderJob.workerMessage}</div>
                        ) : null}
                        <div className="row wrap mt-4">
                          <button className="tabBtn" disabled={renderBusy} onClick={() => void runImportCompletedRender()}>
                            Import completed
                          </button>
                          <button className="tabBtn" disabled={renderBusy} onClick={() => void runWatchCompletedRender()}>
                            Watch completed
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="writersDocPreviewGrid mt-4">
                <pre className="writersPlannerPreview">{internalRenderJobJson}</pre>
                <pre className="writersPlannerPreview">{sceneRenderQueue}</pre>
              </div>`,
    "render bridge UI card"
  );
}

fs.writeFileSync(file, s);
console.log("Patched ui/src/panels/Books.tsx");
