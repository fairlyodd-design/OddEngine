# Trading Desk Deep Stabilization Pass

Version: 10.26.11r

## Why this pass exists

The Trading panel had been receiving many targeted hotfixes, but the user-visible glitching was still present.
A deeper inspection of `ui/src/panels/Trading.tsx` showed the desk still had several structural churn sources:

- multiple inputs were still committing directly into panel state on every keystroke
- panel state persisted to local storage on every patch
- the Trading status bridge wrote a fresh payload on nearly every render
- the setup card still had a second live symbol input that bypassed the draft/commit lane
- the option drawer stayed sticky inside a very tall page, which can amplify scroll jitter in Electron

## What changed

### 1) Debounced panel persistence

`patch()` now only updates React state.
A debounced `useEffect` persists the trading input model to storage.

This cuts down synchronous localStorage churn while typing, dragging sliders, or editing notes.

### 2) Debounced / deduped trading status sync

The `oddengine:trading:status:v1` payload now:

- waits briefly before writing
- compares against the last serialized payload
- skips duplicate writes

This keeps the Trading Coach and rail in sync without hammering storage/event listeners.

### 3) Draft → commit lanes for the noisy fields

Added draft state + commit handlers for:

- symbol
- chart symbol
- contract search
- watchlist
- levels
- notes

These now commit on blur / Enter / explicit action instead of writing every keypress into the live desk state.

### 4) Memoized heavy visuals kept active

The 11q-style memoized chart / curve / OI / drawer lane stays in place so heavy visuals do not keep remounting just because a different text box changed.

### 5) Drawer stickiness relaxed

Added a Trading-specific CSS override so the option drawer no longer uses sticky positioning inside the main Trading desk layout.

This is meant to reduce scroll jitter / layout thrash in Electron on tall panels.

## Main files changed

- `ui/src/panels/Trading.tsx`
- `ui/src/styles.css`
- `ui/src/lib/version.ts`
- `package.json`
- `ui/package.json`
- `homie_companion/package.json`
- `.oddengine_last_ui_version.txt`

## Honest notes

This pass is a deeper stabilization pass, not a cosmetic relabel.
It does **not** pretend the Trading desk is a tiny component now — the panel is still large — but it removes several of the highest-churn state/write paths that were keeping the whole desk twitchy.
