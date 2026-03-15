# v10.25.08 App Routing Audit Fix + Trading Baseline Lock

This overlay is for one job only:

- audit the real local `App.tsx` wiring correctly
- map file-backed panels to app registry/loadable ids
- map brain raw ids and brain public ids
- freeze the true trading baseline before any more feature passes

## Why this exists

The prior baseline audit under-counted `App.tsx` because it only looked for legacy `lazy(() => import(...))` lines and `case "PanelId":` switch routes.

Your shell now uses a file-aware panel registry pattern like:

- `import.meta.glob("./panels/*.tsx")`
- `lazyPanel("PanelName")`
- `const PANEL_COMPONENTS = { ... }`

That meant the old audit could wrongly report `App lazy imports: 0` and `App routes: 0` even when the shell was still wired.

## What this version checks

- panel files in `ui/src/panels`
- app registry keys in `const PANEL_COMPONENTS`
- app loadable ids from the registry plus any switch-case routes
- brain raw ids from `RAW_PANEL_META`
- brain public ids after canonical override collapsing
- trading panel status across all of the above

## Outputs

After running the audit, open:

- `docs/generated/baseline-lock-report.md`
- `docs/generated/baseline-lock-manifest.json`
- `docs/generated/baseline-lock-app-registry.json`
- `docs/generated/baseline-lock-app-loadable-ids.json`
- `docs/generated/baseline-lock-brain-public-ids.json`
- `docs/generated/baseline-lock-trading-status.json`

## Windows

Run either:

```powershell
node .\scripts\audit\generate-baseline-lock.mjs
```

or:

```powershell
.\RUN_BASELINE_AUDIT_WINDOWS.bat
```

## What to do with the report

1. treat your local tree as source of truth
2. compare missing app registry/loadable panels against the ones you expect live
3. restore wiring only where the audit proves it is missing
4. re-run the audit before any new feature pass
