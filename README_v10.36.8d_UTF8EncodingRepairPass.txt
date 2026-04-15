v10.36.8d_UTF8EncodingRepairPass

What this does:
- repairs common mojibake / encoding corruption in ui\src text files
- rewrites patched files as UTF-8 without BOM
- targets common broken sequences like:
  â€” -> —
  â€¢ -> •
  ðŸ‘Š -> 👊
  and other common emoji/button/text corruption

How to use:
1. Unzip over C:\OddEngine
2. Run RUN_v10.36.8d_UTF8EncodingRepairPass.bat
3. Restart OddEngine

Notes:
- This is a text/encoding cleanup pass.
- It does not change runtime logic.
- It is safe to rerun.
