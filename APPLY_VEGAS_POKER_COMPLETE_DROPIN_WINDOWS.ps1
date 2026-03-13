param(
  [Parameter(Mandatory=$true)]
  [string]$RepoPath
)

$ErrorActionPreference = "Stop"

$packRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Copy-Item "$packRoot\ui\src\lib\vegasPokerFeed.ts" "$RepoPath\ui\src\lib\vegasPokerFeed.ts" -Force
Copy-Item "$packRoot\ui\src\lib\vegasPokerCashPromos.ts" "$RepoPath\ui\src\lib\vegasPokerCashPromos.ts" -Force
Copy-Item "$packRoot\ui\src\panels\VegasPokerFeed.tsx" "$RepoPath\ui\src\panels\VegasPokerFeed.tsx" -Force
Copy-Item "$packRoot\ui\src\panels\VegasPokerCashPromos.tsx" "$RepoPath\ui\src\panels\VegasPokerCashPromos.tsx" -Force
Copy-Item "$packRoot\ui\src\App.tsx" "$RepoPath\ui\src\App.tsx" -Force
Copy-Item "$packRoot\ui\src\lib\brain.ts" "$RepoPath\ui\src\lib\brain.ts" -Force

Write-Host "Applied Vegas poker complete drop-in pack."
