# OddEngine v10.19.9 (Desktop + Web + Windows EXE build) — FairlyGOD Mode 👊🐦‍🔥

This build includes everything from the v10.18.x line **plus** the FairlyGOD layout + routines stack:

- ✅ **“Never again” launcher guards**: auto-clears Vite cache on version change + preflight UI build before launch

- ✅ **Homie AI chat** (Desktop-only) powered by **local Ollama** on `127.0.0.1:11434`
- ✅ **Mission Control copilots + panel copilots** (top priority + next action + chips)
- ✅ **Plugins** (Desktop-safe loading + “open panel” actions)
- ✅ **Entertainment** (separate player window + Family Night mode)
- ✅ **Books Vault** (track all in-progress books locally)

## FairlyGOD Mode (all panels)

- ✅ Every **card/box is shrinkable + movable** (no per-panel refactor needed)
- ✅ **Snap grid + guides** (hold **Shift** to temporarily disable snap)
- ✅ **Lock layout** toggle (prevents accidental dragging)
- ✅ **Presets per panel** (save/apply)
- ✅ **Reset panel layout** (one-click un-chaos)
- ✅ **Panel-to-panel layout cloning**
- ✅ **Global preset sets** (ex: “Morning Routine” applies across multiple panels)
- ✅ **Routine Launcher** (apply a set + open a panel sequence in one click)
- ✅ **Routine window auto-tiling** + one-click **Close Routine Windows**
- ✅ **Multi-monitor routine presets** + **per-display window assignments**

---

## Quick start (Windows)

### Web mode (runs in browser)
1) Unzip
2) Double-click `RUN_WINDOWS_WEB.bat`
3) Open http://localhost:5173

> Note: Homie AI requires **Desktop mode**.

### Desktop mode (Electron — enables disk writes/logs/adb/emulators/Homie AI)
1) Unzip
2) Double-click `RUN_WINDOWS_DESKTOP.bat`

---

## Homie AI (local Ollama)

Homie AI is designed to stay **local**:
- Your prompts + context stay on your machine
- OddEngine talks only to `127.0.0.1:11434`
- No cloud keys required

### Install Ollama
1) Install Ollama for Windows
2) In PowerShell:
```powershell
ollama --version
```
3) Pull a model (examples):
```powershell
ollama pull llama3.1:8b
# or smaller/faster
ollama pull phi3:mini
ollama pull mistral:7b
```
4) Keep Ollama running (it hosts on `127.0.0.1:11434`)

### Use it
- Open **Homie 👊** panel
- Click **Check Ollama**
- Pick your model name (must match what you pulled)
- Chat normally

Tip: Paste build logs and ask “Explain this error + safest fix steps”.

---

## Build a real Windows .EXE (Installer + Desktop shortcut)

> Do this on Windows.

1) Unzip
2) In the project folder:
```powershell
npm install
npm run dist:win
```

This produces:
- `dist\OddEngine Setup *.exe` (NSIS installer) ✅ creates Desktop shortcut
- `dist\OddEngine *.exe` (portable) (no auto-shortcut)

---

## If the Desktop app opens but shows a blank screen

If DevTools shows errors like:
- `Failed to load resource: net::ERR_FILE_NOT_FOUND index-*.js`
- `Failed to load resource: net::ERR_FILE_NOT_FOUND index-*.css`

That means the UI assets were built with an absolute base path (`/assets/...`) and Electron is loading the UI via `file://`.

✅ Fix: make sure `ui/vite.config.ts` contains:

```ts
base: "./",
```

Then rebuild:

```powershell
npm run build:ui
npm run dist:win
```

---

## Grow section (bundled Grow OS)

Desktop mode seeds the Grow OS bundle here:
- `%APPDATA%\OddEngine\bundles\grow_os`

In the **Grow** panel:
- **Open bundle folder**
- **Install deps** (runs `python -m pip install -r requirements.txt`)
- **Launch Grow OS** (runs Streamlit on `http://127.0.0.1:8501`)

If Python isn’t in PATH, set the **Python command** box to `py` or your full python path.

---

## PowerShell tip (don’t use `rmdir /s /q`)
That syntax is **CMD**, not PowerShell. Use this in PowerShell instead:

```powershell
Remove-Item -Recurse -Force .\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\ui\node_modules -ErrorAction SilentlyContinue
Remove-Item -Force .\package-lock.json -ErrorAction SilentlyContinue
Remove-Item -Force .\ui\package-lock.json -ErrorAction SilentlyContinue
npm cache clean --force
npm install
```

---

## Autopilot generators
- In **Desktop mode**: writes real files to disk automatically.
- In **Web mode**: click **Export to Folder (Browser)** and choose a folder (Chrome/Edge on localhost supports this).


## Family Budget v10.14.0

- CSV mapping + import presets
- Payoff planner (Avalanche / Snowball)
- Backend snapshot sync bridge


## New in v10.16.1
- Shared AI Brain service with specialist copilots in each panel
- Embedded assistant dock across the OS
- Brain router with goals, notes, daily digest, and pinned memory
- Global AI command bar + right-side AI inbox/activity rail
- Upgraded Security, Money, and Options SaaS panels
- AI defaults added to Preferences
