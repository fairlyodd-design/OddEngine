
export type RealUploadPayload = {
  provider: "youtube" | "gumroad";
  title: string;
  description: string;
  artifactPath: string;
  tags?: string[];
  thumbnailPath?: string;
};

export type RealUploadResult = {
  ok: boolean;
  status: string;
  url?: string;
  detail?: string;
};

const DEFAULT_BASE = "http://127.0.0.1:8899";

function getBase() {
  try {
    return window.localStorage.getItem("fairlyodd.creativeBackendBase") || DEFAULT_BASE;
  } catch {
    return DEFAULT_BASE;
  }
}

export async function probeRealUploader(baseUrl = getBase()) {
  try {
    const res = await fetch(`${baseUrl}/uploader/health`);
    if (!res.ok) return { ok: false, status: `HTTP ${res.status}`, detail: "uploader unavailable" };
    return await res.json();
  } catch (err: any) {
    return { ok: false, status: "unreachable", detail: String(err?.message || err) };
  }
}

export async function uploadRealArtifact(payload: RealUploadPayload, baseUrl = getBase()): Promise<RealUploadResult> {
  const res = await fetch(`${baseUrl}/uploader/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { ok: false, status: `HTTP ${res.status}`, detail: "upload failed" };
  return await res.json();
}
