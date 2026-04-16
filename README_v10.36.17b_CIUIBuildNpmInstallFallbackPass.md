# v10.36.17b CI UI Build npm install fallback pass

Fixes the separate `.github/workflows/ci-ui-build.yml` workflow after the YAML syntax repair.

The UI build workflow was valid YAML, but the job still exited with code 1. The most likely cause is `npm ci --include=dev` being stricter than the local workflow and root CI path, while the project has repeatedly used `npm install` successfully for UI dependency recovery.

This pass changes only the UI build workflow:

- Node 24 actions remain enabled
- `npm ci --include=dev` becomes `npm install`
- step tracing is added with `set -euxo pipefail`
- failure breadcrumbs are added
- app code is untouched

## Apply

```powershell
.\APPLY_v10.36.17b_CIUIBuildNpmInstallFallbackPass.bat
.\RUN_v10.36.17b_CI_UI_BUILD_CHECK.bat
```
