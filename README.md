# v10.24.82 Global Panel Input Wiring — Complete Whole Zip

This pack gives you a cleaner all-at-once path for 82:

- full `Preferences.tsx` rewrite with the Connections & Secrets Center
- updated `connectionsCenter.ts` with setup fields used by Studio/Grocery/Trading/etc.
- `panelConnections.ts` so panels can read setup state from Preferences
- automatic patching for your local `Books.tsx` and `GroceryMeals.tsx`

## Apply

```powershell
powershell -ExecutionPolicy Bypass -File .\APPLY_V10.24.82_COMPLETE_WHOLE_WINDOWS.ps1 -RepoPath "C:\OddEngine"
```

Then build:

```powershell
cd C:\OddEngine
npm --prefix .\ui run build
```

Then commit:

```powershell
git add .\ui\src\lib\connectionsCenter.ts .\ui\src\lib\panelConnections.ts .\ui\src\panels\Preferences.tsx .\ui\src\panels\Books.tsx .\ui\src\panels\GroceryMeals.tsx
git commit -m "v10.24.82 global panel input wiring pass"
git push
```

## What this changes

- Preferences becomes the place where you enter usernames, passwords, API keys, tokens, webhook URLs, and provider settings.
- Studio / Books reads setup readiness from the central store.
- Grocery reads setup readiness from the central store.
- The helper is structured so other panels can be wired next without duplicating setup logic.

## Security

Keep real secrets local only. Do not commit real values to GitHub.
