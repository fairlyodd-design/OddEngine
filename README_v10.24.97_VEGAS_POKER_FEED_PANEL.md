# v10.24.97 Vegas Poker Feed Panel Pass

This pack adds a new Vegas poker feed panel foundation:
- `ui/src/lib/vegasPokerFeed.ts`
- `ui/src/panels/VegasPokerFeed.tsx`

Apply files with the PowerShell script, then follow the merge guides for:
- `ui/src/App.tsx`
- `ui/src/lib/brain.ts`

After merge:
```powershell
cd C:\OddEngine
npm --prefix .\ui run build
```
