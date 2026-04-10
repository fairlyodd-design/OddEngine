import type { AvatarKind, AvatarRuntime } from "../types/avatar";

export function detectAvatarKind(sourceUrl: string): AvatarKind {
  const value = sourceUrl.toLowerCase().trim();
  if (value.endsWith(".vrm")) return "vrm";
  if (value.endsWith(".glb") || value.endsWith(".gltf")) return "glb";
  return "fallback";
}

export function normalizeAvatarPath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return `/models/${trimmed}`;
}

export function avatarSummary(avatar: AvatarRuntime) {
  if (avatar.status === "fallback") return "fallback buddy ready";
  if (avatar.status === "loading") return `loading ${avatar.kind.toUpperCase()}…`;
  if (avatar.status === "ready") return `${avatar.kind.toUpperCase()} avatar loaded`;
  if (avatar.status === "error") return avatar.error || "avatar failed to load";
  return "avatar idle";
}
