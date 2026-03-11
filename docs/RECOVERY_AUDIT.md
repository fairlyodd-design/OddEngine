# Books.tsx merge guide for the render worker bridge pass

Add this import in `ui/src/panels/Books.tsx`:

```ts
import {
  createRenderJob,
  getRenderJob,
  getRenderJobs,
  importRenderOutput,
  markRenderWatched,
  type RenderJob,
} from "../lib/renderWorkerBridge";
### 3) Write `docs/RECOVERY_AUDIT.md`

```powershell
@'
# OddEngine recovery audit

## What drifted

- Public GitHub already moved into the Writers / Studio render-prep direction
- `ui/src/panels/Books.tsx` has render settings state, but the local backend seam was missing
- `backend_scaffold` was still centered on grocery / cannabis proxies
- The uploaded zip base was older internally than its filename suggested

## What this recovery pass restores

- `backend_scaffold/render-backend.mjs`
- `backend_scaffold/RUN_RENDER_BACKEND_WINDOWS.bat`
- `npm run render-backend`
- `ui/src/lib/renderWorkerBridge.ts`
- `docs/BOOKS_RENDER_WORKER_MERGE.md`

## Recommended version tag

`OddEngine_v10.24.63_RenderWorkerBridgeRecoveryPass`
