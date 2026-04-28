$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$homie = Join-Path $root "ui\src\panels\Homie.tsx"
$buddy = Join-Path $root "ui\src\components\HomieBuddy.tsx"
$version = Join-Path $root "ui\src\lib\version.ts"

if (!(Test-Path $homie)) { throw "Missing ui\src\panels\Homie.tsx. Run from C:\OddEngine." }

Write-Host "[v10.38.21b] Fixing unsafe HomieTrue3DAvatar mood scope..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Main Homie panel: livingPresenceState does not exist here. Use component default idle.
$h = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)
$h = $h.Replace('<HomieTrue3DAvatar size="main" mood={livingPresenceState || "idle"} />', '<HomieTrue3DAvatar size="main" />')
$h = $h.Replace('<HomieTrue3DAvatar size="main" mood={livingPresenceState ?? "idle"} />', '<HomieTrue3DAvatar size="main" />')
$h = $h.Replace('<HomieTrue3DAvatar size="main" mood={livingPresenceState} />', '<HomieTrue3DAvatar size="main" />')
[System.IO.File]::WriteAllText($homie, $h, $utf8NoBom)

# HomieBuddy may or may not have livingPresenceState depending on local drift. Avoid future same-scope crash.
if (Test-Path $buddy) {
  $b = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)
  $b = $b.Replace('<HomieTrue3DAvatar size="buddy" mood={livingPresenceState || "idle"} />', '<HomieTrue3DAvatar size="buddy" />')
  $b = $b.Replace('<HomieTrue3DAvatar size="buddy" mood={livingPresenceState ?? "idle"} />', '<HomieTrue3DAvatar size="buddy" />')
  [System.IO.File]::WriteAllText($buddy, $b, $utf8NoBom)
}

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.21b";')
  if ($ver -notmatch 'HOMIE_TRUE_3D_AVATAR_MOOD_SCOPE_FIX_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_TRUE_3D_AVATAR_MOOD_SCOPE_FIX_PASS = "v10.38.21b_HomieTrue3DAvatarMoodScopeFixPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.21b] Applied. 3D avatar now defaults to idle mood without unsafe scope." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
