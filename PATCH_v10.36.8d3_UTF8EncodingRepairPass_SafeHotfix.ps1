$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
  $candidates = @()
  if ($PSScriptRoot) { $candidates += $PSScriptRoot }
  if ($PSCommandPath) { $candidates += (Split-Path -Parent $PSCommandPath) }
  $candidates += (Get-Location).Path
  foreach ($base in $candidates) {
    if (-not $base) { continue }
    foreach ($root in @($base, (Join-Path $base 'OddEngine'))) {
      $target = Join-Path $root 'ui\src'
      if (Test-Path -LiteralPath $target) { return $root }
    }
  }
  throw 'Could not locate OddEngine root with ui\src.'
}

function Get-BadnessScore([string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { return 0 }
  $score = 0
  foreach ($ch in $Text.ToCharArray()) {
    $code = [int][char]$ch
    if ($code -eq 65533) { $score += 5; continue } # replacement char
    if ($code -eq 194 -or $code -eq 195 -or $code -eq 208 -or $code -eq 226) { $score += 2; continue }
    if ($code -ge 240 -and $code -le 255) { $score += 1; continue }
  }
  return $score
}

function Try-FixMojibake([string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { return $Text }
  $latin1 = [System.Text.Encoding]::GetEncoding(28591)
  $utf8 = [System.Text.UTF8Encoding]::new($false)
  try {
    $bytes = $latin1.GetBytes($Text)
    $candidate = $utf8.GetString($bytes)
  } catch {
    return $Text
  }
  $before = Get-BadnessScore $Text
  $after = Get-BadnessScore $candidate
  if ($after -lt $before) { return $candidate }
  return $Text
}

$repoRoot = Resolve-RepoRoot
$srcRoot = Join-Path $repoRoot 'ui\src'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$files = Get-ChildItem -LiteralPath $srcRoot -Recurse -File | Where-Object { $_.Extension -in @('.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.md', '.txt') }
$changed = 0

foreach ($file in $files) {
  $original = [System.IO.File]::ReadAllText($file.FullName)
  $fixed = Try-FixMojibake $original
  if ($fixed -ne $original) {
    [System.IO.File]::WriteAllText($file.FullName, $fixed, $utf8NoBom)
    $changed++
  } else {
    # still normalize to UTF-8 without BOM for files under ui/src that may have been rewritten by patches
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $current = [System.Text.Encoding]::UTF8.GetString($bytes)
    [System.IO.File]::WriteAllText($file.FullName, $current, $utf8NoBom)
  }
}

Write-Host ("Scanned {0} file(s) under ui\\src." -f $files.Count)
Write-Host ("Encoding-repaired {0} file(s)." -f $changed)
Write-Host 'Restart OddEngine now.'
