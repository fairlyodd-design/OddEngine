export type RenderJobOutput = {
  filename?: string;
  localPath?: string;
  previewUrl?: string;
  imported?: boolean;
  importedAt?: number;
  importedInto?: string;
  watchedAt?: number | null;
};

export type RenderJob = {
  id: string;
  slug?: string;
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number;
  projectTitle?: string;
  title?: string;
  kind?: string;
  provider: string;
  productionType?: string;
  visualStyle?: string;
  releaseTarget?: string;
  format?: string;
  fps?: string;
  resolution?: string;
  renderBaseUrl?: string;
  storyboardSummary?: string;
  assetIds?: string[];
  promptPack?: unknown;
  handoff?: unknown;
  output?: RenderJobOutput | null;
  status: string;
  progress?: number;
  workerMessage?: string;
  payload?: unknown;
  prompt?: string;
};

type JsonObject = Record<string, unknown>;

function normalizeBaseUrl(baseUrl: string) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `${res.status} ${res.statusText}`);
  }

  return data as T;
}

export async function getRenderJobs(baseUrl: string): Promise<{ ok: boolean; jobs: RenderJob[] }> {
  const root = normalizeBaseUrl(baseUrl);
  return requestJson(`${root}/render/jobs`);
}

export async function getRenderJob(baseUrl: string, jobId: string): Promise<{ ok: boolean; job: RenderJob }> {
  const root = normalizeBaseUrl(baseUrl);
  return requestJson(`${root}/render/jobs/${encodeURIComponent(jobId)}`);
}

export async function createRenderJob(
  payload: {
    baseUrl: string;
    projectTitle?: string;
    title?: string;
    provider?: string;
    productionType?: string;
    visualStyle?: string;
    releaseTarget?: string;
    format?: string;
    fps?: string;
    resolution?: string;
    storyboardSummary?: string;
    assetIds?: string[];
    handoff?: JsonObject | null;
    promptPack?: JsonObject | null;
    kind?: string;
    prompt?: string;
    payload?: JsonObject | null;
  },
): Promise<{ ok: boolean; job: RenderJob }> {
  const { baseUrl, ...body } = payload;
  const root = normalizeBaseUrl(baseUrl);
  return requestJson(`${root}/render/jobs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function importRenderOutput(
  baseUrl: string,
  jobId: string,
  importedInto = "OddEngine Render Lab",
  markWatched = false,
): Promise<{ ok: boolean; job: RenderJob }> {
  const root = normalizeBaseUrl(baseUrl);
  return requestJson(`${root}/render/jobs/${encodeURIComponent(jobId)}/import`, {
    method: "POST",
    body: JSON.stringify({ importedInto, markWatched }),
  });
}

export async function markRenderWatched(
  baseUrl: string,
  jobId: string,
): Promise<{ ok: boolean; job: RenderJob }> {
  const root = normalizeBaseUrl(baseUrl);
  return requestJson(`${root}/render/jobs/${encodeURIComponent(jobId)}/watch`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
