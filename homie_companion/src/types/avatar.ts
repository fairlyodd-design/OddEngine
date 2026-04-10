export type AvatarKind = "fallback" | "glb" | "vrm";

export type AvatarLoadStatus = "fallback" | "idle" | "loading" | "ready" | "error";

export type AvatarRuntime = {
  sourceUrl: string;
  status: AvatarLoadStatus;
  kind: AvatarKind;
  scale: number;
  error?: string;
  lastLoadedAt?: string;
  note?: string;
};
