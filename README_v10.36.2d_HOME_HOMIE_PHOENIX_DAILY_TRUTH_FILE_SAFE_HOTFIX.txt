v10.36.2d Home/Homie Phoenix Daily Truth Pass — file-safe hotfix

This rebuild avoids brittle anchor drift from the previous patch attempts.

What it does
- patches ui/src/panels/Home.tsx
- patches ui/src/panels/Homie.tsx
- adds shared operatorBrain daily truth imports and UI blocks

Why this one is safer
- it looks for the exact live v10.35.9 file content that is currently in the repo
- it does not use the PowerShell HOME variable name
- it uses normalized line endings before replace/write

Install
1. Unzip over C:\OddEngine
2. Run RUN_v10.36.2d_HomeHomiePhoenixDailyTruthPass_FileSafeHotfix.bat
3. Restart OddEngine
