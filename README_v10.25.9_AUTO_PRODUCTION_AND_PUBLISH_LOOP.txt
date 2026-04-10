v10.25.9_AutoProductionAndPublishLoopPass

What this pass adds
- Publisher Hub panel
- oddengine:secrets:v1 token vault
- oddengine:publisher:jobs:v1 publish queue
- oddengine:money:outcomes:v1 revenue tracking
- outcome learning loop / best-next-move summary
- Studio: Run Full Auto Pipeline button + Auto Publish / Track Revenue toggles
- Render backend: publish jobs, outcomes, learning summary, secrets endpoints

Main UI files
- ui/src/panels/PublisherHub.tsx
- ui/src/lib/productionLoop.ts
- ui/src/lib/publisherEngine.ts
- ui/src/lib/outcomeTracker.ts
- ui/src/lib/learningEngine.ts
- ui/src/lib/secretsVault.ts
- ui/src/panels/Books.tsx
- ui/src/App.tsx
- ui/src/lib/brain.ts
- ui/src/lib/version.ts

Backend additions
- GET /publish/jobs
- POST /publish/jobs
- POST /publish/jobs/:id/run
- GET /outcomes
- POST /outcomes
- GET /learning/summary
- GET /secrets
- POST /secrets

Notes
- This is a source drop-in pass.
- Backend syntax was checked with node --check.
- Full Vite/Electron build was not run in-container because the environment does not include a working local dependency install.
