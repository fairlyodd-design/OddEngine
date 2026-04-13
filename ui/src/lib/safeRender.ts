export function safeRender(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => safeRender(v)).join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.title === "string") return obj.title;
    if (typeof obj.label === "string") return obj.label;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.id === "string" || typeof obj.id === "number") return String(obj.id);
    if (typeof obj.sceneId === "string") return obj.sceneId;
    if (typeof obj.shotId === "string") return obj.shotId;
    if (typeof obj.path === "string") return obj.path;
    try {
      return JSON.stringify(obj);
    } catch {
      return "[object]";
    }
  }
  try {
    return String(value);
  } catch {
    return "[unrenderable]";
  }
}
