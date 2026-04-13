vLegacyMode.5b_ReleasePlaybackAndRangeHotfix

Purpose
- Fix black 0:00 preview playback in Render Lab for legacy-mode videos.

What this hotfix changes
- Render Lab now loads release preview media from the backend using absolute URLs instead of fragile relative paths.
- Render Lab adds:
  - Refresh release
  - Reload player
  - Open video
  - Download video
  - Open poster
  - Open narration
  - Open transcript
- Backend file serving now supports:
  - HEAD requests
  - HTTP Range requests
  - Accept-Ranges: bytes
  - inline and download modes
- Release endpoint now returns both relative and absolute media URLs.

Why the old preview could fail
- The UI was using backend-generated relative file URLs.
- When the UI was not on the same origin/port as the backend, the video tag could point at the wrong host.
- Browsers and Electron video players also behave better when the server supports byte-range requests.

Validated here
- Backend /health OK
- Real legacy-local render job completed
- /render/jobs/:id/release returned release video/audio/poster URLs
- video file endpoint served:
  - 200 OK
  - 206 Partial Content
  - Accept-Ranges: bytes
- This specifically targets the uploaded OddEngine-10.28.1c base plus the vLegacyMode.5 overlay.

Files included
- backend_scaffold/render-backend.mjs
- ui/src/panels/RenderLab.tsx
- README_vLegacyMode5b_RELEASE_PLAYBACK_AND_RANGE_HOTFIX.txt
