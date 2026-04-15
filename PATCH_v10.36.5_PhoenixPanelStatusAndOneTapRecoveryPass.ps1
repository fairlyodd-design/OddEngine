$ErrorActionPreference = "Stop"

function Resolve-OddEngineRoot {
  param([string]$ScriptDir)

  $candidates = @(
    $ScriptDir,
    (Join-Path $ScriptDir "OddEngine"),
    (Split-Path -Parent $ScriptDir)
  ) | Select-Object -Unique

  foreach ($candidate in $candidates) {
    if (-not $candidate) { continue }
    $appCandidate = Join-Path $candidate "ui\src\App.tsx"
    if (Test-Path -LiteralPath $appCandidate) {
      return $candidate
    }
  }

  throw "Could not find ui\src\App.tsx from $ScriptDir"
}

function Normalize-Newlines {
  param([string]$Text)
  return ($Text -replace "`r`n", "`n" -replace "`r", "`n")
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPath = Resolve-OddEngineRoot -ScriptDir $scriptDir
$appPath = Join-Path $rootPath "ui\src\App.tsx"

$appText = Get-Content -Raw -LiteralPath $appPath
$appText = Normalize-Newlines $appText

if ($appText -notmatch 'import PhoenixPanelStatusStrip from "\./components/PhoenixPanelStatusStrip";') {
  $importPattern = 'import ErrorBoundary from "\./components/ErrorBoundary";'
  if ($appText -notmatch $importPattern) { throw "Could not find ErrorBoundary import anchor in App.tsx" }
  $appText = [regex]::Replace(
    $appText,
    $importPattern,
    'import ErrorBoundary from "./components/ErrorBoundary";' + "`n" + 'import PhoenixPanelStatusStrip from "./components/PhoenixPanelStatusStrip";',
    1
  )
}

$forcedPattern = '(?s)(<ErrorBoundary panelId=\{forcedPanel\} label="Shell summary" onNavigate=\{setActive\}>.*?</ErrorBoundary>)'
if ($appText -match $forcedPattern -and $appText -notmatch 'PhoenixPanelStatusStrip activeId=\{forcedPanel\}') {
  $appText = [regex]::Replace(
    $appText,
    $forcedPattern,
    '$1' + "`n          " + '<PhoenixPanelStatusStrip activeId={forcedPanel} onNavigate={setActive} />',
    1
  )
}

$mainPattern = '(?s)(<ErrorBoundary panelId=\{activeId\} label="Shell summary" onNavigate=\{setActive\}>.*?</ErrorBoundary>)'
if ($appText -match $mainPattern -and $appText -notmatch 'PhoenixPanelStatusStrip activeId=\{activeId\}') {
  $appText = [regex]::Replace(
    $appText,
    $mainPattern,
    '$1' + "`n        " + '<PhoenixPanelStatusStrip activeId={activeId} onNavigate={setActive} />',
    1
  )
}

$appText = $appText -replace "`n", "`r`n"
Copy-Item -LiteralPath $appPath -Destination ($appPath + ".v10.36.5.bak") -Force
Set-Content -LiteralPath $appPath -Value $appText -Encoding UTF8

Write-Host "Patched App.tsx successfully for v10.36.5."
Write-Host "Restart OddEngine now."
