v10.36.8d3_UTF8EncodingRepairPass_SafeHotfix

Purpose:
- repair likely mojibake / encoding corruption in ui\src
- normalize text files to UTF-8 without BOM
- avoid PowerShell parser failures caused by embedding broken literal characters in the script itself

How to use:
1. unzip over C:\OddEngine
2. run RUN_v10.36.8d3_UTF8EncodingRepairPass_SafeHotfix.bat
3. restart OddEngine
