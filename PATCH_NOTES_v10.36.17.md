# Patch notes — v10.36.17

CI-only pass.

- Upgraded GitHub Actions workflow to Node 24 action runtime.
- Removed Node 20 action-runtime deprecation noise by using checkout/setup-node/upload-artifact v6.
- Added workflow-level `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`.
- Added stricter command tracing so the first real failing command is obvious.
- Added failure breadcrumbs step.

No UI, Trading, Homie, Studio, CardGODMode, drag/drop, or package script changes.
