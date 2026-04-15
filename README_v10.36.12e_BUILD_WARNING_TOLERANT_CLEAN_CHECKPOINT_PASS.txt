# v10.36.12e Build-Warning-Tolerant Clean Checkpoint Pass

This pass fixes the false-blocker case where Vite/Rollup prints "Circular chunk" warnings to stderr even though the production build exits successfully.

It does not change UI source files.

It checks:
- duplicate nested source tree
- PATCH debris under ui/src
- styles.css mojibake marker score
- npm run audit:runtime
- npm run build:web

It treats circular chunk warnings as non-blocking only when build exit code is 0.

Usage:
1. Unzip over C:\OddEngine
2. Run RUN_v10.36.12e_BuildWarningTolerantCleanCheckpointPass.bat
3. Paste the result back into ChatGPT

After a clean pass, you may delete this RUN/PATCH/README from C:\OddEngine.
