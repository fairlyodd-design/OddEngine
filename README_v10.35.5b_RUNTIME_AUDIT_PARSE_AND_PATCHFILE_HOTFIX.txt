v10.35.5b Runtime Audit Parse + Patchfile Hotfix

Fixes:
- ui/src/lib/trueComponentLiftRegistry.tsx malformed switch/case structure
- ui/src/panels/Books_PATCH.tsx replaced with safe no-op component
- ui/tsconfig.json excludes stray *_PATCH files from typecheck audit

Install:
- unzip over your OddEngine root
- overwrite existing files
- rerun RUN_OS_IMPORT_AUDIT.bat
