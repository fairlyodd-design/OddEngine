# OddEngine Render Backend

Run locally:

```bash
node backend_scaffold/render-backend.mjs
```

Default URL: `http://127.0.0.1:8899`

This pass adds a real media provider bridge for image, audio, and video workers.

## Backend storage
- jobs: `backend_scaffold_data/render_jobs/`
- outputs: `backend_scaffold_data/render_outputs/`
- provider config: `backend_scaffold_data/render_providers.json`

## Provider bridge contract
Health probe:
- `GET /health`

Generate:
- `POST /generate`

Expected request body:
```json
{
  "provider": "image",
  "model": "your-model-name",
  "job": {
    "title": "Project title",
    "prompt": "Primary brief",
    "visualBrief": "...",
    "audioBrief": "...",
    "videoBrief": "...",
    "script": "..."
  }
}
```

Accepted provider responses:
- `artifacts: [{ name, mime, base64 }]`
- `outputs: [...]`
- `base64`
- `url`
- `text`

## Useful routes
- `GET /health`
- `GET /providers`
- `POST /providers`
- `POST /providers/probe`
- `GET /render/jobs`
- `POST /render/jobs`
- `GET /render/jobs/:id`
- `POST /render/jobs/:id/run`
- `GET /render/jobs/:id/artifacts`
