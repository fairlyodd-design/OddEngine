$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
  $candidates = @()
  if ($PSScriptRoot) { $candidates += $PSScriptRoot }
  try { $candidates += (Get-Location).Path } catch {}
  $candidates += 'C:\OddEngine'

  foreach ($base in $candidates) {
    if (-not $base) { continue }
    $trimmed = $base.TrimEnd([char]'\', [char]'/')
    $direct = $trimmed
    $parent = Split-Path -Parent $trimmed

    foreach ($candidate in @($direct, $parent)) {
      if (-not $candidate) { continue }
      if (Test-Path (Join-Path $candidate 'ui\src')) {
        return $candidate
      }
    }
  }

  throw 'Could not locate OddEngine repo root with ui\src'
}

$repoRoot = Resolve-RepoRoot
$uiSrc = Join-Path $repoRoot 'ui\src'
if (-not (Test-Path $uiSrc)) {
  throw "Could not find ui\\src at $uiSrc"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$replacements = [ordered]@{
  'â€”' = '—'
  'â€“' = '–'
  'â€¢' = '•'
  'â€¦' = '…'
  'â€œ' = '“'
  'â€' = '”'
  'â€˜' = '‘'
  'â€™' = '’'
  'Â©' = '©'
  'Â®' = '®'
  'Â™' = '™'
  'Â°' = '°'
  'Â·' = '·'
  'Â' = ''
  'ðŸ‘Š' = '👊'
  'ðŸš€' = '🚀'
  'ðŸ“…' = '📅'
  'ðŸ§ ' = '🧠'
  'ðŸŽ¯' = '🎯'
  'ðŸ“Š' = '📊'
  'ðŸŒ±' = '🌱'
  'ðŸ¡' = '🏡'
  'ðŸ“š' = '📚'
  'ðŸ§¹' = '🧹'
  'ðŸŽ¬' = '🎬'
  'ðŸ“°' = '📰'
  'ðŸ“¹' = '📹'
  'â›ï¸' = '⛏️'
  'âš¡' = '⚡'
  'â­ï¸' = '⏭️'
  'âœ…' = '✅'
  'ðŸ›’' = '🛒'
  'ðŸ’¸' = '💸'
  'ðŸ ' = '🏠'
  'âœï¸' = '✍️'
}

$extensions = @('.ts', '.tsx', '.js', '.jsx', '.css', '.md', '.txt')
$files = Get-ChildItem -Path $uiSrc -Recurse -File | Where-Object { $extensions -contains $_.Extension.ToLowerInvariant() }

$patched = New-Object System.Collections.Generic.List[string]

foreach ($file in $files) {
  $text = [System.IO.File]::ReadAllText($file.FullName)
  $original = $text

  foreach ($key in $replacements.Keys) {
    $text = $text.Replace($key, $replacements[$key])
  }

  if ($text -ne $original) {
    [System.IO.File]::WriteAllText($file.FullName, $text, $utf8NoBom)
    $patched.Add($file.FullName)
  }
}

Write-Host "UTF-8 repair complete. Patched $($patched.Count) file(s)."
if ($patched.Count -gt 0) {
  $patched | ForEach-Object { Write-Host " - $_" }
}
Write-Host 'Restart OddEngine now.'
