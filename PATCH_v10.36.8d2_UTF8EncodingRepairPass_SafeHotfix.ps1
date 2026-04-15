$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  $candidates = @()
  if ($PSScriptRoot) { $candidates += $PSScriptRoot }
  if ($PSCommandPath) { $candidates += (Split-Path -Parent $PSCommandPath) }
  $candidates += (Get-Location).Path
  foreach ($c in $candidates) {
    if (-not $c) { continue }
    $direct = Join-Path $c "ui\src"
    if (Test-Path -LiteralPath $direct) { return $c }
    $odd = Join-Path $c "OddEngine"
    if (Test-Path -LiteralPath (Join-Path $odd "ui\src")) { return $odd }
  }
  throw "Could not locate OddEngine repo root."
}

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Text
  )
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
}

function Get-Cp1252Encoding {
  return [System.Text.Encoding]::GetEncoding(
    1252,
    [System.Text.EncoderFallback]::ExceptionFallback,
    [System.Text.DecoderFallback]::ExceptionFallback
  )
}

function Try-FixMojibake {
  param([string]$Text)

  if ([string]::IsNullOrEmpty($Text)) { return $Text }

  if ($Text -notmatch 'Ã|â|ðŸ|Â') { return $Text }

  try {
    $cp1252 = Get-Cp1252Encoding
    $bytes = $cp1252.GetBytes($Text)
    $fixed = [System.Text.Encoding]::UTF8.GetString($bytes)

    $beforeScore = ([regex]::Matches($Text, 'Ã|â|ðŸ|Â')).Count
    $afterScore  = ([regex]::Matches($fixed, 'Ã|â|ðŸ|Â')).Count

    if ($afterScore -lt $beforeScore) {
      return $fixed
    }

    return $Text
  } catch {
    return $Text
  }
}

$repoRoot = Resolve-RepoRoot
$srcRoot = Join-Path $repoRoot "ui\src"

$targets = Get-ChildItem -LiteralPath $srcRoot -Recurse -File |
  Where-Object { $_.Extension -in @(".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".md", ".txt") }

$changed = @()

foreach ($file in $targets) {
  $original = Get-Content -Raw -LiteralPath $file.FullName
  $fixed = Try-FixMojibake -Text $original

  $fixed = $fixed.Replace("â€”", "—")
  $fixed = $fixed.Replace("â€¢", "•")
  $fixed = $fixed.Replace("â€œ", "“")
  $fixed = $fixed.Replace("â€", "”")
  $fixed = $fixed.Replace("â€˜", "‘")
  $fixed = $fixed.Replace("â€™", "’")
  $fixed = $fixed.Replace("Â ", " ")
  $fixed = $fixed.Replace("Â", "")
  $fixed = $fixed.Replace("ðŸ‘Š", "👊")
  $fixed = $fixed.Replace("ðŸš€", "🚀")
  $fixed = $fixed.Replace("ðŸ“…", "📅")
  $fixed = $fixed.Replace("ðŸ§ ", "🧠")
  $fixed = $fixed.Replace("ðŸŽ¯", "🎯")
  $fixed = $fixed.Replace("ðŸ“Š", "📊")
  $fixed = $fixed.Replace("ðŸŒ±", "🌱")
  $fixed = $fixed.Replace("ðŸ¡", "🏡")
  $fixed = $fixed.Replace("ðŸ“š", "📚")
  $fixed = $fixed.Replace("ðŸ§¹", "🧹")
  $fixed = $fixed.Replace("ðŸŽ¬", "🎬")
  $fixed = $fixed.Replace("â­ï¸", "⏭️")
  $fixed = $fixed.Replace("âš¡", "⚡")
  $fixed = $fixed.Replace("âœ…", "✅")
  $fixed = $fixed.Replace("âœï¸", "✍️")
  $fixed = $fixed.Replace("FairlyOdd OS â€” Home", "FairlyOdd OS — Home")

  if ($fixed -ne $original) {
    Write-Utf8NoBom -Path $file.FullName -Text $fixed
    $changed += $file.FullName.Replace($repoRoot + [IO.Path]::DirectorySeparatorChar, "")
  }
}

Write-Host ("UTF-8 repair complete. Files changed: " + $changed.Count)
foreach ($item in $changed | Select-Object -First 30) {
  Write-Host (" - " + $item)
}
Write-Host ""
Write-Host "Restart OddEngine now."
