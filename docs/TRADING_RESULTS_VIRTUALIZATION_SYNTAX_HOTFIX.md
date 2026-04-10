# v10.26.9i Trading Results Virtualization Syntax Hotfix

This hotfix fixes a JSX/template-string syntax error introduced in the 10.26.9h trading virtualization pass.

## Fixes
- Replaces an invalid double-backtick template string in `ui/src/panels/Trading.tsx`
- Keeps the chain load state message rendering valid for Vite/esbuild
- Bumps app/UI version labels to `10.26.9i`
