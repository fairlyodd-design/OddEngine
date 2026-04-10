import express from 'express';

const app = express();
app.use(express.json());

const motionEvents = [];

function pushMotion(event) {
  motionEvents.unshift({ id: `motion-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), level: 'info', ...event });
  while (motionEvents.length > 100) motionEvents.pop();
}

app.get('/camera/health', (_req, res) => {
  res.json({ ok: true, status: 'ready', service: 'oddengine-camera-bridge-starter', relayMode: 'hls', detail: 'Camera bridge starter online. Replace relay endpoints with your real go2rtc / ffmpeg chain.' });
});

app.get('/camera/motion', (req, res) => {
  const since = Number(req.query.since || 0);
  res.json({ events: motionEvents.filter((event) => event.ts > since) });
});

app.post('/camera/motion', (req, res) => {
  const body = req.body || {};
  pushMotion({
    cameraId: body.cameraId,
    cameraLabel: body.cameraLabel || 'Camera',
    title: body.title || `Motion on ${body.cameraLabel || 'Camera'}`,
    detail: body.detail || 'Starter bridge accepted a motion event.',
    level: body.level === 'critical' ? 'critical' : body.level === 'warn' ? 'warn' : 'info',
  });
  res.json({ ok: true, count: motionEvents.length });
});

app.get('/camera/hls', (req, res) => {
  const source = String(req.query.source || '');
  res.status(501).json({ ok: false, detail: `Starter bridge does not transcode yet. Wire ${source || 'your RTSP source'} through go2rtc/ffmpeg and replace this endpoint with a real .m3u8 response.` });
});

app.get('/camera/mjpeg', (req, res) => {
  const source = String(req.query.source || '');
  res.status(501).json({ ok: false, detail: `Starter bridge does not proxy MJPEG yet. Wire ${source || 'your RTSP source'} through your relay stack.` });
});

app.listen(8898, () => {
  console.log('Camera live bridge starter listening on http://127.0.0.1:8898');
});
