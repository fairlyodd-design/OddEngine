$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $root 'ui\src\lib\writerEngine.ts'

if (-not (Test-Path $target)) {
  Write-Host "writerEngine.ts not found at: $target" -ForegroundColor Red
  exit 1
}

$content = Get-Content -LiteralPath $target -Raw
$original = $content

# Exact fix for the final audit error.
$content = $content -replace 'uid\("anim-job"\)', 'uid()'

if ($content -eq $original) {
  Write-Host 'No change made. The exact uid("anim-job") pattern was not found.' -ForegroundColor Yellow
  Write-Host 'Open ui\src\lib\writerEngine.ts and replace uid("anim-job") with uid() manually if needed.' -ForegroundColor Yellow
  exit 2
}

Set-Content -LiteralPath $target -Value $content -Encoding UTF8
Write-Host 'writerEngine.ts patched successfully.' -ForegroundColor Green
Write-Host 'Re-run RUN_OS_IMPORT_AUDIT.bat now.' -ForegroundColor Green
