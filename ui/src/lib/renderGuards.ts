import { safeRender } from "./safeRender";

export function toDisplayPair(value: unknown) {
  if (!value || typeof value !== "object") {
    return { title: safeRender(value), subtitle: "—" };
  }

  const obj = value as Record<string, unknown>;
  return {
    title: safeRender(obj.title ?? obj.label ?? obj.name ?? obj.sceneId ?? obj.shotId ?? obj.id ?? value),
    subtitle: safeRender(obj.subtitle ?? obj.path ?? obj.status ?? obj.type ?? "—"),
  };
}

export function safeList(values: unknown): string[] {
  if (Array.isArray(values)) return values.map((v) => safeRender(v));
  if (values === null || values === undefined) return [];
  return [safeRender(values)];
}
