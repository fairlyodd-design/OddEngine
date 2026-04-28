$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$buddy = Join-Path $root "ui\src\components\HomieBuddy.tsx"
$version = Join-Path $root "ui\src\lib\version.ts"

if (!(Test-Path $buddy)) { throw "Missing ui\src\components\HomieBuddy.tsx. Run from C:\OddEngine." }

Write-Host "[v10.38.13c] Fixing undefined setDraft references in HomieBuddy..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$tsx = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)

# Add a safe local draft helper inside HomieBuddy before panel JSX if it does not exist.
# It avoids depending on an undefined setDraft symbol while preserving the prompt button UX.
if ($tsx -notmatch 'function homieBuddySetCompanionDraft') {
  $anchor = '  const panel = ('
  if (-not $tsx.Contains($anchor)) {
    $anchor = 'const panel = ('
  }
  if (-not $tsx.Contains($anchor)) {
    throw "Could not find 'const panel = (' anchor in HomieBuddy.tsx."
  }

  $helper = @'
  function homieBuddySetCompanionDraft(nextPrompt: string) {
    try {
      const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        '[data-homie-buddy-input="true"], [data-homie-input="true"], textarea[placeholder*="Homie"], input[placeholder*="Homie"]'
      );
      if (input) {
        input.value = nextPrompt;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
        return;
      }
      window.dispatchEvent(new CustomEvent("homie:companion-draft", { detail: { prompt: nextPrompt } }));
    } catch {
      window.dispatchEvent(new CustomEvent("homie:companion-draft", { detail: { prompt: nextPrompt } }));
    }
  }

'@
  $tsx = $tsx.Replace($anchor, $helper + $anchor)
}

# Replace the three undefined setDraft calls with the safe helper.
$tsx = $tsx.Replace('setDraft("Homie, ask me a gentle check-in and help me name what I actually feel.")', 'homieBuddySetCompanionDraft("Homie, ask me a gentle check-in and help me name what I actually feel.")')
$tsx = $tsx.Replace('setDraft("Homie, reflect my mood and give me one tiny next step.")', 'homieBuddySetCompanionDraft("Homie, reflect my mood and give me one tiny next step.")')
$tsx = $tsx.Replace('setDraft("Homie, help me make this useful for my family as a legacy note.")', 'homieBuddySetCompanionDraft("Homie, help me make this useful for my family as a legacy note.")')

# Defensive cleanup if any direct undefined references remain in those button handlers.
$tsx = $tsx.Replace('onClick={() => setDraft(', 'onClick={() => homieBuddySetCompanionDraft(')

[System.IO.File]::WriteAllText($buddy, $tsx, $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.13c";')
  if ($ver -notmatch 'HOMIE_BUDDY_SETDRAFT_TYPECHECK_FIX_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_BUDDY_SETDRAFT_TYPECHECK_FIX_PASS = "v10.38.13c_HomieBuddySetDraftTypecheckFixPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.13c] Applied. setDraft references replaced with homieBuddySetCompanionDraft." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
