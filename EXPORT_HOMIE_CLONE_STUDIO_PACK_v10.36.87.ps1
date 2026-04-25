$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$profilePath = Join-Path $root "backend_scaffold\homie_clone_profile.v1.json"
$bankPath = Join-Path $root "backend_scaffold\homie_clone_memory_bank.v1.json"
$outBase = Join-Path $root "backend_scaffold\homie_clone_studio_exports"

if (!(Test-Path $profilePath)) { throw "Missing $profilePath" }
if (!(Test-Path $bankPath)) { throw "Missing $bankPath" }

$profile = Get-Content $profilePath -Raw | ConvertFrom-Json
$bank = Get-Content $bankPath -Raw | ConvertFrom-Json

$stamp = (Get-Date).ToString("yyyy-MM-dd_HH-mm-ss")
$name = if ($profile.identity.displayName) { $profile.identity.displayName } else { "Homie" }
$slug = ($name.ToLower() -replace "[^a-z0-9]+","-").Trim("-")
if (-not $slug) { $slug = "homie" }
$outDir = Join-Path $outBase ($stamp + "_" + $slug)
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Copy-Item -Force $profilePath (Join-Path $outDir "clone_profile.snapshot.json")
Copy-Item -Force $bankPath (Join-Path $outDir "clone_memory_bank.snapshot.json")

$topTags = @()
if ($bank.entries) {
  $tagCounts = @{}
  foreach ($entry in $bank.entries) {
    foreach ($tag in $entry.tags) {
      if (-not [string]::IsNullOrWhiteSpace($tag)) {
        if (-not $tagCounts.ContainsKey($tag)) { $tagCounts[$tag] = 0 }
        $tagCounts[$tag]++
      }
    }
  }
  $topTags = $tagCounts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 12 | ForEach-Object { $_.Key }
}

$digest = @()
$digest += "# Homie Clone Memory Digest"
$digest += ""
$digest += "Updated: " + (Get-Date).ToString("o")
$digest += ""
$digest += "## Identity lane"
$digest += "- Name: " + $profile.identity.displayName
$digest += "- Relation: " + $profile.identity.relation
$digest += "- Mission: " + $profile.identity.mission
$digest += "- Tone: " + $profile.cloneDesign.signatureTone
$digest += ""
$digest += "## Top tags/themes"
if ($topTags.Count -gt 0) {
  foreach ($tag in $topTags) { $digest += "- $tag" }
} else {
  $digest += "- none yet"
}
$digest += ""
$digest += "## Recent memories"
$recent = @()
if ($bank.entries) {
  $recent = $bank.entries | Sort-Object createdAt -Descending | Select-Object -First 8
}
if ($recent.Count -gt 0) {
  foreach ($entry in $recent) {
    $digest += "### " + $entry.title
    $digest += "- Source: " + $entry.sourceType
    $digest += "- Tags: " + (($entry.tags -join ", "))
    $digest += ($entry.summary)
    $digest += ""
  }
} else {
  $digest += "No memories ingested yet."
}

$digest -join "`r`n" | Set-Content -Path (Join-Path $outDir "memory_digest.md") -Encoding UTF8

$studioPrompt = @()
$studioPrompt += "# Homie Clone Studio Prompt"
$studioPrompt += ""
$studioPrompt += "Shape Homie like the user's tone and priorities without pretending perfect identity replication."
$studioPrompt += ""
$studioPrompt += "## Signature tone"
$studioPrompt += $profile.cloneDesign.signatureTone
$studioPrompt += ""
$studioPrompt += "## Family priorities"
foreach ($item in $profile.cloneDesign.familyPriorities) { $studioPrompt += "- $item" }
$studioPrompt += ""
$studioPrompt += "## User likeness notes"
foreach ($item in $profile.cloneDesign.userLikenessNotes) { $studioPrompt += "- $item" }

$studioPrompt -join "`r`n" | Set-Content -Path (Join-Path $outDir "homie_clone_studio_prompt.md") -Encoding UTF8

Write-Host "Studio pack exported to:"
Write-Host $outDir
