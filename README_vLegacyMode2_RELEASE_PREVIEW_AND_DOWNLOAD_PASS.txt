vLegacyMode.2 — Release Preview and Download Pass

What this pass adds
- Render Lab can now preview the actual returned legacy video inside the panel.
- Render Lab can open or download the final video, poster, and summary directly from the backend.
- Render Lab can bundle the release artifacts into a release zip from inside the UI.
- The render backend now exposes safe artifact file URLs and a release summary endpoint.

New backend routes
- GET /render/jobs/:id/release
  Returns the detected final video, poster, summary, captions, and output root.
- GET /render/jobs/:id/file?path=<relative>&download=1
  Safely serves a real artifact file from that render job.

Why this matters
Legacy Mode already creates a real MP4.
This pass closes the loop so the family can actually see it, download it, and keep it.

Changed files
- backend_scaffold/render-backend.mjs
- ui/src/panels/RenderLab.tsx

Validated in container
- Created a real render job
- Ran legacy-local worker runtime
- Confirmed /release endpoint detects final-video.mp4 and poster
- Confirmed /file endpoint serves the real MP4, PNG poster, and markdown summary
