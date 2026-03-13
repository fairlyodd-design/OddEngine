param(
  [Parameter(Mandatory = $true)]
  [string]$RepoPath
)

$SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackRoot = Join-Path $SourceRoot "v10.24.99_pack"

Copy-Item (Join-Path $PackRoot "ui\src\lib\homieWeirdScienceAesthetic.ts") (Join-Path $RepoPath "ui\src\lib\homieWeirdScienceAesthetic.ts") -Force
Copy-Item (Join-Path $PackRoot "ui\src\components\HomieAvatar.tsx") (Join-Path $RepoPath "ui\src\components\HomieAvatar.tsx") -Force
Copy-Item (Join-Path $PackRoot "ui\src\panels\Homie.tsx") (Join-Path $RepoPath "ui\src\panels\Homie.tsx") -Force
Write-Host "Applied v10.24.99 Homie Weird Science Aesthetic complete drop-in pass."
