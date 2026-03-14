# GitHub Actions Starter Pack for OddEngine

This starter pack adds two practical workflows:

1. **CI - UI Build**
   - Builds the `ui` app on pushes to:
     - `recovery/render-worker-bridge-pass`
     - `main`
   - Builds on pull requests targeting `main`
   - Can also be run manually from the **Actions** tab

2. **Package Drop-In Zip**
   - Manual workflow only
   - Creates a clean zip from the current checked-out commit
   - Uploads that zip as a workflow artifact

## Where these files go

Copy the `.github` folder into the root of your repo:

```text
C:\OddEngine\.github\workflows\ci-ui-build.yml
C:\OddEngine\.github\workflows\package-dropin-zip.yml
```

You can also keep this doc in:

```text
C:\OddEngine\docs\GITHUB_ACTIONS_STARTER_PACK.md
```

## Why this setup is good for OddEngine

- It catches busted UI builds before they reach `main`
- It keeps your manual drop-in zip workflow alive instead of forcing a release pipeline
- It stays small and easy to understand
- It fits your real branch flow:
  - `recovery/render-worker-bridge-pass` = active working branch
  - `main` = promoted public branch

## Step-by-step like you're 5

### 1) Copy the files into your repo
Put the two workflow files here:

```text
C:\OddEngine\.github\workflows\
```

If the folders do not exist, create them:

- create folder `.github`
- inside it create folder `workflows`

### 2) Commit and push them
Open PowerShell and run:

```powershell
cd C:\OddEngine
git checkout recovery/render-worker-bridge-pass
git pull origin recovery/render-worker-bridge-pass
git add .github/workflows/ci-ui-build.yml .github/workflows/package-dropin-zip.yml docs/GITHUB_ACTIONS_STARTER_PACK.md
git commit -m "ci: add github actions starter pack"
git push origin recovery/render-worker-bridge-pass
```

### 3) Watch the UI build workflow run
Go to your repo on GitHub.

Click:

- **Actions**
- **CI - UI Build**

That workflow should run after the push.

### 4) Make a zip manually from GitHub
Go to:

- **Actions**
- **Package Drop-In Zip**
- **Run workflow**

Optional:
- type a custom artifact name
- or leave it blank and it will auto-name the zip using branch + short SHA

### 5) Download the zip artifact
Open the workflow run and download the artifact from the **Artifacts** section.

## Notes

- The build workflow only targets the `ui` project right now
- The package workflow uses `git archive`, so it zips tracked files from the checked-out commit
- This starter pack does not try to test voice, camera, or local bridge hardware
- If you later want real local hardware checks, use a self-hosted runner instead of a normal GitHub-hosted runner

## Good next upgrades later

- add an Electron desktop build workflow
- add a Windows packaging workflow
- add a release workflow for tagged versions
- add a self-hosted runner for local bridge validation
