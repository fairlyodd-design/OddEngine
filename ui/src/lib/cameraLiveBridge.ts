import { CameraPanelCam } from './cameraPanelState';

export type CameraBridgeHealth = {
  ok: boolean;
  status: 'connected' | 'failed' | 'pending';
  detail: string;
  checkedAt: number;
  relayMode?: 'hls' | 'mjpeg';
  service?: string;
};

export type CameraMotionEvent = {
  id: string;
  ts: number;
  cameraId?: string;
  cameraLabel: string;
  level: 'info' | 'warn' | 'critical';
  title: string;
  detail: string;
};

export type CameraBridgePrefs = {
  baseUrl: string;
  relayMode: 'hls' | 'mjpeg';
  autoRelayRtsp: boolean;
  motionPolling: boolean;
  health?: CameraBridgeHealth;
  relayMap?: Record<string, string>;
};

export const DEFAULT_CAMERA_BRIDGE_PREFS: CameraBridgePrefs = {
  baseUrl: 'http://127.0.0.1:8898',
  relayMode: 'hls',
  autoRelayRtsp: true,
  motionPolling: true,
  relayMap: {},
};

export function normalizeCameraBridgePrefs(input: any): CameraBridgePrefs {
  return {
    baseUrl: typeof input?.baseUrl === 'string' && input.baseUrl.trim() ? input.baseUrl.trim() : DEFAULT_CAMERA_BRIDGE_PREFS.baseUrl,
    relayMode: input?.relayMode === 'mjpeg' ? 'mjpeg' : 'hls',
    autoRelayRtsp: typeof input?.autoRelayRtsp === 'boolean' ? input.autoRelayRtsp : true,
    motionPolling: typeof input?.motionPolling === 'boolean' ? input.motionPolling : true,
    health: input?.health,
    relayMap: typeof input?.relayMap === 'object' && input?.relayMap ? input.relayMap : {},
  };
}

export function buildCameraRelayUrl(camera: CameraPanelCam, prefs: CameraBridgePrefs): string {
  const existing = prefs.relayMap?.[camera.id];
  if (existing) return existing;
  const base = String(prefs.baseUrl || DEFAULT_CAMERA_BRIDGE_PREFS.baseUrl).replace(/\/$/, '');
  const source = encodeURIComponent(camera.url || '');
  const relay = prefs.relayMode === 'mjpeg' ? 'mjpeg' : 'hls';
  return `${base}/camera/${relay}?cameraId=${encodeURIComponent(camera.id)}&source=${source}`;
}

export function resolveCameraPreviewUrl(camera: CameraPanelCam, prefs: CameraBridgePrefs): string {
  if (!camera.url) return '';
  if (camera.kind === 'rtsp' && prefs.autoRelayRtsp) return buildCameraRelayUrl(camera, prefs);
  return camera.url;
}

export async function probeCameraBridge(baseUrl: string): Promise<CameraBridgeHealth> {
  const clean = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!clean) {
    return { ok: false, status: 'failed', detail: 'No bridge base URL set.', checkedAt: Date.now() };
  }
  const urls = [`${clean}/camera/health`, `${clean}/health`, `${clean}/api/health`];
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) continue;
      let data: any = null;
      try { data = await res.json(); } catch {}
      return {
        ok: true,
        status: 'connected',
        detail: data?.detail || data?.status || 'Camera bridge reachable.',
        checkedAt: Date.now(),
        relayMode: data?.relayMode === 'mjpeg' ? 'mjpeg' : 'hls',
        service: data?.service || 'camera-bridge',
      };
    } catch {}
  }
  return { ok: false, status: 'failed', detail: 'Could not reach camera bridge health endpoint.', checkedAt: Date.now() };
}

export async function fetchCameraMotionEvents(baseUrl: string, sinceTs?: number): Promise<CameraMotionEvent[]> {
  const clean = String(baseUrl || '').trim().replace(/\/$/, '');
  if (!clean) return [];
  const url = `${clean}/camera/motion${sinceTs ? `?since=${encodeURIComponent(String(sinceTs))}` : ''}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data) ? data : Array.isArray(data?.events) ? data.events : [];
    return items.map((item: any, index: number) => ({
      id: String(item?.id || `motion-${Date.now()}-${index}`),
      ts: Number(item?.ts || Date.now()),
      cameraId: typeof item?.cameraId === 'string' ? item.cameraId : undefined,
      cameraLabel: String(item?.cameraLabel || item?.label || item?.camera || 'Camera'),
      level: item?.level === 'critical' ? 'critical' : item?.level === 'warn' ? 'warn' : 'info',
      title: String(item?.title || 'Motion detected'),
      detail: String(item?.detail || 'Camera bridge reported activity.'),
    }));
  } catch {
    return [];
  }
}

export function createSyntheticMotionEvent(camera: CameraPanelCam): CameraMotionEvent {
  return {
    id: `motion-${camera.id}-${Date.now()}`,
    ts: Date.now(),
    cameraId: camera.id,
    cameraLabel: camera.label || camera.name,
    level: /door|front|yard|garage|gate|drive/i.test(`${camera.label} ${camera.name}`) ? 'warn' : 'info',
    title: `Motion on ${camera.label || camera.name}`,
    detail: camera.kind === 'rtsp'
      ? 'RTSP lane reported motion. Relay and recorder event stream should be verified.'
      : 'Preview lane flagged motion. Review the live tile or recorder timeline.',
  };
}
