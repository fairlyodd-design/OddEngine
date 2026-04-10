# v10.26.13j Panel Vaults — Trading / Mining / Grow / Cameras

This pass extends the local operator vault into the panels that most need persistent setup:

- Trading
- Mining
- Grow
- Cameras

## What changed

### Trading
- Added a saved setup card for broker, login, account ID, API key/secret, default symbol, watchlist, scanner URL, and notes.
- Can load default symbol/setup hints back into the panel.

### Mining
- Added a saved setup card for wallet label/address, pool name, dashboard URL, worker name, pool API key, optional login/password, power cost, and notes.
- Can load pool/worker hints back into the form.

### Grow
- Added a saved setup card for room label, Home Assistant URL/token, device slug, temp/rh entity IDs, and notes.
- Can load vault values into the live-import fields.

### Cameras
- Added a saved setup card for wall label, Frigate URL/API key, default grid, default NVR login, and notes.
- Added per-camera login entries for camera/feed URL, username, password, PIN, API key/secret, and notes.
- Can load default grid/NVR values back into the panel.

## Vault model updates
- Expanded `trading` fields.
- Expanded `mining` fields.
- Added `grow` section.
- Added `cameras` section with per-camera account entries.

## Safety / storage
- Uses the same shared local vault seam as Security.
- Desktop/Electron continues to prefer safe local storage.
- Browser/dev fallback remains local-only storage and should not be treated like a cloud password manager.
