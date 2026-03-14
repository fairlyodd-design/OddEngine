# OddEngine Workflow

This file is the house workflow for making safer, cleaner OddEngine drop-in passes with minimal branch confusion.

## Branch roles

Use these branches consistently:

- `main` = public lagging line, **do not** use as the base for the next zip
- `checkpoint/recovery-ui-stable` = rollback safety line
- `recovery/render-worker-bridge-pass` = active forward line and default next-pass base

## Default rule

Before any new drop-in pass:

1. Pull `recovery/render-worker-bridge-pass`
2. Make a local backup branch
3. Copy in the extracted zip contents
4. Build locally
5. Verify key panels and shared OS behavior
6. Update release/version truth files if this is a real shipped pass
7. Commit
8. Push to `recovery/render-worker-bridge-pass`
9. Promote to `checkpoint/recovery-ui-stable` only after the pass is confirmed good

---

## Full copy/paste workflow

### 1) Open repo and sync the active base

```powershell
cd C:\OddEngine
git fetch --all --prune
git checkout recovery/render-worker-bridge-pass
git pull origin recovery/render-worker-bridge-pass
git status
```

Goal: start from the latest public version of the active working branch.

---

### 2) Make a local safety checkpoint before copying files

```powershell
cd C:\OddEngine
git checkout -b backup/pre_zip_drop_$(Get-Date -Format "yyyy-MM-dd_HHmm")
git checkout recovery/render-worker-bridge-pass
```

If your shell does not like the generated branch name, use:

```powershell
cd C:\OddEngine
git checkout -b backup/pre_zip_drop_manual
git checkout recovery/render-worker-bridge-pass
```

Goal: create an easy rollback point before touching the tree.

---

### 3) Copy in the new drop-in pack

Workflow:

- unzip the new pack
- copy the files into `C:\OddEngine`
- allow overwrite of existing files
- do **not** bring over `node_modules`, temp folders, or accidental junk from extraction

Immediately inspect what changed:

```powershell
cd C:\OddEngine
git status
git diff --stat
```

Goal: make sure the pass changed what you expected and did not spray unexpected files everywhere.

---

### 4) Build before commit

UI build:

```powershell
cd C:\OddEngine
npm --prefix .\ui install
npm --prefix .\ui run build
```

If the backend scaffold was changed too, also run:

```powershell
cd C:\OddEngine
npm --prefix .\backend_scaffold install
```

Goal: catch build issues before the commit instead of after push.

---

### 5) Do a quick sanity check

Verify these still work:

- app launches clean
- Studio still loads
- Preferences still works as setup / connections hub
- Grocery Meals still opens clean
- FamilyBudget still opens clean
- Homie still loads
- any newly added panels appear without manual surprise wiring

Helpful command:

```powershell
cd C:\OddEngine
git diff --name-only
```

Goal: confirm the pass behaves like a real drop-in and did not quietly break shared surfaces.

---

### 6) Update release truth files

Because repo metadata can lag behind the actual pass state, update these when a pass is a real shipped build:

- `.oddengine_last_ui_version.txt`
- `README.md`
- optional: `RELEASE_LOG.md`
- optional: `docs/current-state.md`

Minimum content to update:

- version number
- pass name
- short summary of what changed
- active base branch

Goal: keep public repo truth aligned with actual shipped state.

---

### 7) Commit cleanly

```powershell
cd C:\OddEngine
git add .
git commit -m "v10.25.xx short clear pass name"
```

Examples:

```powershell
git commit -m "v10.25.00 branch truth sync and release metadata update"
git commit -m "v10.25.01 vegas poker shell wiring complete drop-in pass"
git commit -m "v10.25.02 homie mission control integration cleanup pass"
```

Goal: keep commit names readable and versioned.

---

### 8) Push to the active branch

```powershell
cd C:\OddEngine
git push origin recovery/render-worker-bridge-pass
```

Goal: keep the forward working line current.

---

### 9) Promote only confirmed-good work to the checkpoint branch

After local verification:

```powershell
cd C:\OddEngine
git checkout checkpoint/recovery-ui-stable
git pull origin checkpoint/recovery-ui-stable
git merge recovery/render-worker-bridge-pass
git push origin checkpoint/recovery-ui-stable
git checkout recovery/render-worker-bridge-pass
```

Goal: preserve a stable rollback anchor.

---

## Rollback and recovery

### If the zip copy breaks things before commit

```powershell
cd C:\OddEngine
git reset --hard
git clean -fd
```

Warning: this deletes uncommitted local changes.

---

### If you want to jump back to your pre-copy backup branch

```powershell
cd C:\OddEngine
git checkout backup/pre_zip_drop_manual
```

Or use the timestamped backup branch you created earlier.

---

### If you want to reset recovery branch back to the last pushed remote state

```powershell
cd C:\OddEngine
git checkout recovery/render-worker-bridge-pass
git reset --hard origin/recovery/render-worker-bridge-pass
```

Warning: this removes uncommitted local work on that branch.

---

## Tiny fast version

```powershell
cd C:\OddEngine
git fetch --all --prune
git checkout recovery/render-worker-bridge-pass
git pull origin recovery/render-worker-bridge-pass
git checkout -b backup/pre_zip_drop_manual
git checkout recovery/render-worker-bridge-pass

# copy extracted zip contents into C:\OddEngine now

git status
git diff --stat
npm --prefix .\ui install
npm --prefix .\ui run build

# update README.md and .oddengine_last_ui_version.txt if this is a real shipped pass

git add .
git commit -m "v10.25.xx clean pass name"
git push origin recovery/render-worker-bridge-pass
```

---

## House rules for OddEngine

- Prefer complete drop-in packs over brittle patch-chains
- Keep Homie warm, helpful, truthful, family-safe, and grounded
- Treat Studio as one major area inside the broader family-life OS
- Treat Preferences as the setup / connections hub
- Push safer integration over clever but fragile hacks
- Promote only verified work to the stable checkpoint branch

---

## Suggested companion files

These pair well with this workflow:

- `RELEASE_LOG_TEMPLATE.md`
- `docs/current-state.md`
- `docs/branch-truth.md`

