v10.36.12d_FinalSingleLineMojibakeCleanCheckpointPass

Fixes the final known mojibake blocker in ui/src/styles.css:
  Big emote FX comment

Replaces that one risky emoji comment with ASCII-only text, then runs:
  npm run audit:runtime
  npm run build:web

Use:
1. Unzip over C:\OddEngine
2. Run RUN_v10.36.12d_FinalSingleLineMojibakeCleanCheckpointPass.bat
3. Paste the final output back into chat.

If clean:
Review git status, then tag v10.36.12-clean.
