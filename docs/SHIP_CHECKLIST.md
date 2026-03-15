# Ship Checklist

Use this when you are ready to make `main` match the accepted local build.

## 1) Build locally

```powershell
cd C:\OddEngine
npm --prefix .\ui run build
```

## 2) Manual click-through

Check these first:
- Home
- Homie
- Trading Home
- Charts + Graphs
- Options Chains
- Grocery Meals
- Family Budget
- Daily Chores
- Calendar
- Routine Launcher
- Studio

## 3) Commit recovery

```powershell
cd C:\OddEngine
git checkout recovery/render-worker-bridge-pass
git pull origin recovery/render-worker-bridge-pass
git add .
git commit -m "v10.25.29 mainline truth and ship pass"
git push origin recovery/render-worker-bridge-pass
```

## 4) Merge to main

```powershell
cd C:\OddEngine
git checkout main
git pull origin main
git merge recovery/render-worker-bridge-pass
git push origin main
```

## 5) Refresh checkpoint

```powershell
cd C:\OddEngine
git checkout checkpoint/recovery-ui-stable
git pull origin checkpoint/recovery-ui-stable
git merge recovery/render-worker-bridge-pass
git push origin checkpoint/recovery-ui-stable
git checkout recovery/render-worker-bridge-pass
```

## 6) Verify GitHub

Confirm:
- README renders normally
- version file shows `10.25.29`
- docs reflect the current OS shape
- `main` now matches the accepted local build direction
