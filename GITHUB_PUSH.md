# Pushing to GitHub

Run these commands from the project root after unzipping on your machine.

## First push (new repo)
```powershell
git init
git add .
git commit -m "chore: sync to v10.26.20 — clean repo baseline"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
git tag v10.26.20
git push origin v10.26.20
```

## Update existing repo (out-of-date)
```powershell
git add .
git commit -m "chore: sync to v10.26.20 — version cleanup + changelog + gitignore"
git push
git tag v10.26.20
git push origin v10.26.20
```

## What changed in this sync
- `package.json` (root): version 10.21.6 → 10.26.20
- `ui/package.json`: version 10.23.3 → 10.26.20
- `ui/src/lib/version.ts`: APP_VERSION 10.24.0 → 10.26.20
- `README.md`: header version 10.19.9 → 10.26.20
- Added `.gitignore` (node_modules, dist, logs, OS files, Python cache)
- Added `CHANGELOG.md` (full version history from v10.16.1 → v10.26.20)
- Moved loose `*_NOTES.txt` / `BUILD_NOTES.txt` → `docs/changelog/`
