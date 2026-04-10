
export type CreativeQueueJob = {
  id: string;
  status?: string;
  title?: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
  outputPath?: string;
};

const DEFAULT_BASE = "http://127.0.0.1:8899";

function getBase() {
  try {
    return window.localStorage.getItem("fairlyodd.creativeBackendBase") || DEFAULT_BASE;
  } catch {
    return DEFAULT_BASE;
  }
}

export async function listCreativeQueue(baseUrl = getBase()): Promise<CreativeQueueJob[]> {
  const res = await fetch(`${baseUrl}/render/jobs`);
  if (!res.ok) throw new Error(`Queue fetch failed: HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (Array.isArray(data.jobs) ? data.jobs : []);
}

export async function listCreativeOutputs(baseUrl = getBase()): Promise<any[]> {
  const res = await fetch(`${baseUrl}/render/outputs`);
  if (!res.ok) throw new Error(`Outputs fetch failed: HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (Array.isArray(data.outputs) ? data.outputs : []);
}
