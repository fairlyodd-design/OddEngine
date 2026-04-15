# v10.36.12e2 Build Warning Native-Stderr Hotfix Clean Checkpoint Pass

This does not change UI source.

It fixes the v10.36.12e runner problem where PowerShell treated Vite circular chunk warnings on stderr as a NativeCommandError.

## Use

1. Unzip over C:\OddEngine
2. Run RUN_v10.36.12e2_BuildWarningNativeStderrHotfixCleanCheckpointPass.bat
3. Paste the result back into chat

Circular chunk warnings are non-blocking when the build exit code is 0.
