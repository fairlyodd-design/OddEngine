# v10.36.17_CINode24ActionsAndFailureTracePass

CI-only pass for OddEngine.

## Why

GitHub Actions is warning that Node.js 20 action runtimes are deprecated. The previous workflow used:

- `actions/checkout@v4`
- `actions/setup-node@v4`
- `node-version: '20'`
- `actions/upload-artifact@v4`

The warning alone is not necessarily the `exit code 1` cause, but upgrading the workflow removes that noise and makes the real failing step easier to see.

## Changes

- Upgrades checkout to `actions/checkout@v6`
- Upgrades setup-node to `actions/setup-node@v6`
- Uses Node `24`
- Upgrades upload-artifact to `actions/upload-artifact@v6`
- Adds `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`
- Adds stricter shell traces with `set -euxo pipefail`
- Adds a failure breadcrumbs step
- Keeps the same runtime audit, TypeScript audit, Vite build, dist verify, artifact upload flow

## Apply

Extract into `C:\OddEngine`, then run:

```powershell
.\APPLY_v10.36.17_CINode24ActionsAndFailureTracePass.bat
.\RUN_v10.36.17_CI_NODE24_CHECK.bat
```

## Commit

```powershell
git add .github/workflows/ci.yml scripts/apply-ci-node24-actions-v10.36.17.mjs scripts/ci.v10.36.17.yml.txt APPLY_v10.36.17_CINode24ActionsAndFailureTracePass.bat RUN_v10.36.17_CI_NODE24_CHECK.bat README_v10.36.17_CINode24ActionsAndFailureTracePass.md PATCH_NOTES_v10.36.17.md docs/CI_NODE24_ACTIONS_AND_FAILURE_TRACE_v10.36.17.md
git commit -m "v10.36.17 CI Node24 actions and failure trace"
git tag v10.36.17-clean
git push origin main
git push origin v10.36.17-clean
```
