export type CameraPanelNvr = { id: string; name: string; host: string; user?: string; pass?: string };
export type CameraPanelCam = {
  id: string;
  name: string;
  label: string;
  url: string;
  nvrId?: string;
  kind: "mjpeg" | "snapshot" | "hls" | "rtsp" | "web";
  enabled: boolean;
};

export type CameraView = {
  id: string;
  name: string;
  cameraIds: string[];
  description: string;
};

export type CameraAlert = {
  id: string;
  level: "good" | "warn" | "critical";
  title: string;
  detail: string;
  cameraId?: string;
};

export type CameraHealth = {
  configured: number;
  enabled: number;
  previewReady: number;
  rtspBlocked: number;
  emptyFeeds: number;
  offlineLikely: number;
};

export function computeCameraHealth(cameras: CameraPanelCam[]): CameraHealth {
  const configured = cameras.filter((cam) => String(cam.url || "").trim()).length;
  const enabled = cameras.filter((cam) => cam.enabled).length;
  const previewReady = cameras.filter((cam) => cam.enabled && !!String(cam.url || "").trim() && cam.kind !== "rtsp" && cam.kind !== "web").length;
  const rtspBlocked = cameras.filter((cam) => cam.enabled && cam.kind === "rtsp").length;
  const emptyFeeds = cameras.filter((cam) => cam.enabled && !String(cam.url || "").trim()).length;
  const offlineLikely = cameras.filter((cam) => cam.enabled && /offline|unavailable|fail/i.test(`${cam.name} ${cam.label} ${cam.url}`)).length;
  return { configured, enabled, previewReady, rtspBlocked, emptyFeeds, offlineLikely };
}

export function buildCameraAlerts(cameras: CameraPanelCam[], nvrs: CameraPanelNvr[]): CameraAlert[] {
  const alerts: CameraAlert[] = [];
  const health = computeCameraHealth(cameras);
  if (!nvrs.length) {
    alerts.push({
      id: "nvr-missing",
      level: "warn",
      title: "No NVR added yet",
      detail: "Add at least one recorder or Frigate/Shinobi host so the panel can route quick-open and health actions.",
    });
  }
  if (health.emptyFeeds) {
    alerts.push({
      id: "feeds-missing",
      level: "warn",
      title: `${health.emptyFeeds} enabled feed${health.emptyFeeds === 1 ? "" : "s"} missing URL`,
      detail: "These slots are on but cannot preview until a snapshot, MJPEG, HLS, or dashboard URL is saved.",
    });
  }
  if (health.rtspBlocked) {
    alerts.push({
      id: "rtsp-blocked",
      level: "warn",
      title: `${health.rtspBlocked} RTSP feed${health.rtspBlocked === 1 ? "" : "s"} need relay`,
      detail: "Browser preview cannot play raw RTSP. Route them through Frigate, Shinobi, go2rtc, or the NVR web UI.",
    });
  }
  const perimeter = cameras.filter((cam) => /front|door|yard|drive|garage|side|gate/i.test(`${cam.name} ${cam.label}`));
  if (!perimeter.length) {
    alerts.push({
      id: "perimeter-view-missing",
      level: "warn",
      title: "Perimeter cameras not labeled yet",
      detail: "Use labels like Front, Door, Yard, Driveway, or Gate so quick views and alerts can group them automatically.",
    });
  }
  if (!alerts.length) {
    alerts.push({
      id: "all-good",
      level: "good",
      title: "Camera panel looks healthy",
      detail: "Feeds, labels, and wall routing are in decent shape right now.",
    });
  }
  return alerts;
}

export function buildSuggestedViews(cameras: CameraPanelCam[]): CameraView[] {
  const all = cameras.map((cam) => cam.id);
  const perimeter = cameras.filter((cam) => /front|door|yard|drive|garage|side|gate/i.test(`${cam.name} ${cam.label}`)).map((cam) => cam.id);
  const grow = cameras.filter((cam) => /grow|tent|veg|flower/i.test(`${cam.name} ${cam.label}`)).map((cam) => cam.id);
  const indoor = cameras.filter((cam) => /living|office|hall|kitchen|inside|bed|spare/i.test(`${cam.name} ${cam.label}`)).map((cam) => cam.id);
  return [
    { id: "all", name: "All cameras", cameraIds: all, description: "Everything on one wall." },
    { id: "perimeter", name: "Perimeter", cameraIds: perimeter, description: "Doors, yard, driveway, garage, and gate." },
    { id: "grow", name: "Grow watch", cameraIds: grow, description: "Tent, room, or cultivation checks." },
    { id: "indoor", name: "Indoor", cameraIds: indoor, description: "Living areas and interior safety cams." },
  ].filter((view) => view.cameraIds.length > 0);
}
