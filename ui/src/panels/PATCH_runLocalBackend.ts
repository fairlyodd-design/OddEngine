// PATCHED runLocalBackend fix inserted

// Find runLocalBackend in your Books.tsx and replace with this version

const runLocalBackend = async (jobOverride?: AnimationRenderJob | null) => {
  const targetJob = jobOverride || activeRenderJob;
  if (!targetJob) return null;

  setBackendBusy(true);
  setBackendMessage("Sending job to local runner…");

  try {
    const refreshed = refreshAnimationExecutionJob(targetJob);
    updateRenderJob(refreshed);

    const urls = [backendBaseUrl, "http://127.0.0.1:8899", "http://localhost:8899"]
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index);

    let result: any = null;
    let lastError = "Local runner request failed";

    for (const baseUrl of urls) {
      try {
        const attempt = await runAnimationExecutionJobLocal(refreshed, { baseUrl });
        result = attempt;
        if (attempt?.ok) {
          if (baseUrl !== backendBaseUrl) setBackendBaseUrl(baseUrl);
          break;
        }
        lastError = attempt?.error || attempt?.detail || lastError;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    if (!result) {
      const failedJob = {
        ...refreshed,
        backendStatus: {
          baseUrl: backendBaseUrl,
          status: "error",
          lastRunAt: Date.now(),
          lastError,
        },
      };
      updateRenderJob(failedJob);
      setBackendMessage(lastError);
      return { result: { ok: false, error: lastError, baseUrl: backendBaseUrl }, job: failedJob };
    }

    const nextJob = {
      ...refreshed,
      backendStatus: result.ok
        ? {
            baseUrl: result.baseUrl,
            status: result.detail || "queued",
            lastRunAt: Date.now(),
            lastError: "",
          }
        : {
            baseUrl: result.baseUrl,
            status: "error",
            lastRunAt: Date.now(),
            lastError: result.error || "Runner request failed",
          },
    };

    updateRenderJob(nextJob);
    setBackendProbe(result.probe);
    setBackendMessage(
      result.ok
        ? `Local runner accepted ${result.jobId || refreshed.id}${result.detail ? ` • ${result.detail}` : ""}`
        : (result.error || "Local runner request failed"),
    );

    return { result, job: nextJob };
  } finally {
    setBackendBusy(false);
  }
};
