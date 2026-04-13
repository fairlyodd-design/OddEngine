v10.35.5h_FinalWriterEngineUidHotfix

What this fixes
- Final remaining audit error in ui/src/lib/writerEngine.ts:
  Expected 0 arguments, but got 1.
- Replaces uid("anim-job") with uid() in the writer engine.

Why this package uses a patch script
- The live repo connector did not expose writerEngine.ts content directly, while your local audit clearly shows the file exists.
- So this package includes a safe one-line local patcher that updates the exact offending call in your local file.

How to use
1. Unzip over C:\OddEngine
2. Double-click RUN_WRITERENGINE_UID_HOTFIX.bat
3. Rerun RUN_OS_IMPORT_AUDIT.bat

What the patcher does
- Opens ui\src\lib\writerEngine.ts
- Replaces uid("anim-job") with uid()
- Saves the file in place
- Prints success/failure clearly
