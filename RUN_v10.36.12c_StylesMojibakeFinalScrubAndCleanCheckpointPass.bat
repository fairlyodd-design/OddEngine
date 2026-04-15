@echo off
setlocal
cd /d "%~dp0"
echo [OddEngine] v10.36.12c Styles Mojibake Final Scrub and Clean Checkpoint
echo ----------------------------------------------------------------------
node scripts\v10_36_12c_styles_mojibake_final_scrub_and_clean_checkpoint.mjs
if errorlevel 1 (
  echo.
  echo v10.36.12c cleanup/audit pass found issues. See checkpoints folder for the report.
) else (
  echo.
  echo v10.36.12c cleanup/audit pass passed. See checkpoints folder for the report.
)
echo.
pause
