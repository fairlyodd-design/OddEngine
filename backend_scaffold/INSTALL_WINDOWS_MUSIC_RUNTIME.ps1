$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PreferredEnvDir = Join-Path $Root ".venv"
$LegacyEnvDir = Join-Path $Root "music_runtime_env"
$EnvDir = if (Test-Path (Join-Path $PreferredEnvDir "Scripts\python.exe")) { $PreferredEnvDir } elseif (Test-Path (Join-Path $LegacyEnvDir "Scripts\python.exe")) { $LegacyEnvDir } else { $PreferredEnvDir }

function Get-PythonCommand {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    try { & py -3.12 -c "import sys; print(sys.version)" | Out-Null; return "py -3.12" } catch {}
    try { & py -3 -c "import sys; print(sys.version)" | Out-Null; return "py -3" } catch {}
  }
  if (Get-Command python -ErrorAction SilentlyContinue) { return "python" }
  throw "Python 3.12+ not found. Install Python first."
}

$PythonCmd = Get-PythonCommand
Write-Host "[OddEngine Music Runtime] Root: $Root"
Write-Host "[OddEngine Music Runtime] Target env: $EnvDir"

if (-not (Test-Path (Join-Path $EnvDir "Scripts\python.exe"))) {
  Write-Host "[OddEngine Music Runtime] Creating virtual environment..."
  Invoke-Expression "$PythonCmd -m venv `"$EnvDir`""
}

$VenvPython = Join-Path $EnvDir "Scripts\python.exe"
$VenvPip = Join-Path $EnvDir "Scripts\pip.exe"
if (-not (Test-Path $VenvPython)) { throw "Virtual environment Python was not created correctly at $EnvDir." }

& $VenvPython -m pip install --upgrade pip wheel setuptools
& $VenvPip install -r (Join-Path $Root "music_engines\requirements-music-runtime.txt")
try {
  & $VenvPip install -r (Join-Path $Root "music_engines\requirements-musicgen-audiocraft-optional.txt")
  $AUDIOCRAFT = $true
} catch {
  Write-Warning "Optional audiocraft install failed. Transformers MusicGen lane will still be available."
  $AUDIOCRAFT = $false
}

$LockPath = Join-Path $Root "backend_scaffold_data\music_bridge\runtime_lock.json"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LockPath) | Out-Null

$Freeze = & $VenvPython -m pip freeze
$PyVersion = & $VenvPython -c "import sys; print(sys.version)"
$TorchVersion = & $VenvPython -c "import importlib.util, json; mods=['torch','torchaudio','transformers']; print(json.dumps({m:(__import__(m).__version__ if importlib.util.find_spec(m) else '') for m in mods}))"
$Payload = [ordered]@{
  ok = $true
  installedAt = (Get-Date).ToString("o")
  envDir = $EnvDir
  python = $VenvPython
  pythonVersion = $PyVersion.Trim()
  audiocraftOptionalInstalled = $AUDIOCRAFT
  packages = ($Freeze | Where-Object { $_ -and $_.Trim() -ne "" })
  detected = ($TorchVersion | ConvertFrom-Json)
}
$Payload | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $LockPath

if ($EnvDir -ne $LegacyEnvDir) {
  $LegacyPython = Join-Path $LegacyEnvDir "Scripts\python.exe"
  if (-not (Test-Path $LegacyPython)) {
    New-Item -ItemType Directory -Force -Path $LegacyEnvDir | Out-Null
    @"
This folder name is kept only for legacy wrapper compatibility.
The real runtime env is now: $EnvDir
Python: $VenvPython
"@ | Set-Content -Encoding UTF8 (Join-Path $LegacyEnvDir "README.txt")
  }
}

Write-Host "[OddEngine Music Runtime] Installed and locked."
Write-Host "[OddEngine Music Runtime] Python: $VenvPython"
Write-Host "[OddEngine Music Runtime] Lock file: $LockPath"
