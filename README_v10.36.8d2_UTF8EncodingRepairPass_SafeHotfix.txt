v10.36.8d2_UTF8EncodingRepairPass_SafeHotfix

Purpose:
- repair mojibake / broken UTF-8 text corruption in ui\src
- rewrite touched files as UTF-8 without BOM
- avoid raw broken Unicode literals in PowerShell hash tables

How to use:
1. unzip over C:\OddEngine
2. run RUN_v10.36.8d2_UTF8EncodingRepairPass_SafeHotfix.bat
3. restart OddEngine
