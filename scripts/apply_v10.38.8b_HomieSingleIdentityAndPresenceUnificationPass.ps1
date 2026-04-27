$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$homie = Join-Path $root "ui\src\panels\Homie.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $homie)) { throw "Missing ui\src\panels\Homie.tsx. Run from C:\OddEngine." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.8b] Applying Homie single identity + presence unification..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$tsx = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)

# Add collapsed legacy preview once, before the old Unified companion lead card.
if ($tsx -notmatch 'homieLegacyRobotPreview') {
  $needle = '<div className="card softCard" data-homie-hero-parity-match="v10.36.99"'
  if ($tsx.Contains($needle)) {
    $preview = @'
          <details className="homieLegacyRobotPreview">
            <summary>Legacy robot visual preview is hidden</summary>
            <div className="small">
              The older robot/alien visual lane is preserved for comparison only. The human-inspired Homie is now the single lead identity.
            </div>
          </details>

'@
    $tsx = $tsx.Replace($needle, $preview + '          ' + $needle)
  }
}

# Warm old text if it still appears in the hidden card, so search/screen-reader copy does not fight the new identity.
$tsx = $tsx.Replace("Unified companion lead", "Legacy robot visual preview")
$tsx = $tsx.Replace("Hero-parity pass for the top lead avatar", "Preserved comparison preview for the earlier robot visual lane")
$tsx = $tsx.Replace("Unified Homie visual lane", "Earlier robot visual lane")
$tsx = $tsx.Replace("Hero parity + right-lane match", "Legacy visual comparison")
$tsx = $tsx.Replace("Best next move: keep the single-owner layout and only use Lead", "Best next move: keep the human-inspired Homie as the single lead identity and use this only as a comparison")

# Slightly strengthen human identity text.
$tsx = $tsx.Replace("Homie identity direction", "Homie identity direction - single lead")
$tsx = $tsx.Replace("Homie is not a clone of another companion. Homie is the FairlyOdd family guide: warm, grounded,", "Homie is not a clone of another companion. Homie is the single FairlyOdd family guide: warm, grounded,")

[System.IO.File]::WriteAllText($homie, $tsx, $utf8NoBom)

# Append/replace CSS.
$cssPayload = Join-Path $payload "HOMIE_SINGLE_IDENTITY_PRESENCE_UNIFICATION.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.8b Homie Single Identity + Presence Unification ===== */"
$end = "/* ===== v10.38.8b Homie Single Identity + Presence Unification END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.8b";')
  if ($ver -notmatch 'HOMIE_SINGLE_IDENTITY_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_SINGLE_IDENTITY_PASS = "v10.38.8b_HomieSingleIdentityAndPresenceUnificationPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.8b] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
