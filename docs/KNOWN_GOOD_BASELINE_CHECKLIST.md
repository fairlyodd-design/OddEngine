# Known Good Baseline Commit Checklist

Use after copying this overlay into `C:\OddEngine`.

```powershell
cd C:\OddEngine
git checkout recovery/render-worker-bridge-pass
git pull origin recovery/render-worker-bridge-pass
npm --prefix .\ui run build
git status
```

If the build and click-through are good:

```powershell
git add .
git commit -m "v10.25.18a known good baseline"
git push origin recovery/render-worker-bridge-pass
```

Optional promote to main after verification:

```powershell
git checkout main
git pull origin main
git merge recovery/render-worker-bridge-pass
git push origin main
```
