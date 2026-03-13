param(
  [Parameter(Mandatory=$true)]
  [string]$RepoPath
)

$ErrorActionPreference = "Stop"

$packRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Copy-Item "$packRoot\ui\src\lib\homieRealLifeCore.ts" "$RepoPath\ui\src\lib\homieRealLifeCore.ts" -Force
Copy-Item "$packRoot\ui\src\components\HomieAvatar.tsx" "$RepoPath\ui\src\components\HomieAvatar.tsx" -Force
Copy-Item "$packRoot\ui\src\panels\Homie.tsx" "$RepoPath\ui\src\panels\Homie.tsx" -Force

Write-Host "Applied v10.24.98 Real Life Homie Core complete drop-in files."
