# Family Entertainment Vault Pass

Version: `10.26.13i`

## Goal
Give the Family Entertainment panel the same kind of real saved setup lane as the operator vault/security work, so streaming profiles, usernames, passwords, shared PINs, API keys, device notes, and family-night defaults can live inside the OS instead of being lost in scratch notes.

## What changed
- Extended the shared `operatorVault` model with a dedicated `entertainment` section.
- Added household entertainment setup fields:
  - household label
  - family profile
  - kids profile
  - default Family Night service
  - device notes
  - entertainment notes
- Added per-service entertainment account entries with saved fields for:
  - label
  - service id
  - username / email
  - password
  - profile
  - PIN / parental code
  - API key
  - API secret
  - notes
- Wired Family Entertainment to load and save these values through the same local vault seam already used by Security / Operator setup.
- Added quick actions in the panel to:
  - save entertainment vault
  - create a login entry for the selected service
  - add a new service account entry from Manage mode

## Notes
- Desktop/Electron builds use the same vault path and secure-storage behavior already established by the Operator Vault pass.
- Browser/dev fallback still saves locally only and should not be treated like a full password manager.
- Existing vaults sanitize cleanly; older vault data without an entertainment section will be upgraded safely at load time.
