export function clearPhoenixRuntimeNoise() {
  const keys = [
    "oddengine:brain:activity:v1",
    "oddengine:brain:memory:v1",
    "oddengine:brain:actionHistory:v1",
    "oddengine:brain:inbox:v1",
  ];

  keys.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const cleaned = parsed.filter((item) => {
        const body = String(item?.body || "");
        const title = String(item?.title || "");
        const text = `${title} ${body}`;
        return !(
          text.includes("meta.storageKeys") ||
          text.includes("AssistantDock") ||
          text.includes("runtime error") ||
          text.includes("ErrorBoundary")
        );
      });
      localStorage.setItem(key, JSON.stringify(cleaned));
    } catch {
      // no-op: stale local state should never break boot
    }
  });
}
