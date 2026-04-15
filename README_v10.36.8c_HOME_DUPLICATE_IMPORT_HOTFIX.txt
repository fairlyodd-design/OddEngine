v10.36.8c_HomeDuplicateImportHotfix

What this fixes:
- Removes duplicated operatorBrain import lines from ui\src\panels\Home.tsx
- Restores one clean import:
  import { getOperatorBrainSnapshot, runOperatorBrainNextAction } from "../lib/operatorBrain";

Why Home was failing:
- Vite was returning a 500 on /src/panels/Home.tsx because the file had the same imported identifier declared twice.
- That parser/build failure then surfaced as a lazy-import runtime error in the shell.

How to use:
1. Unzip over C:\OddEngine
2. Run RUN_v10.36.8c_HomeDuplicateImportHotfix.bat
3. Restart OddEngine
