# v10.26.13h — Operator Vault And Setup Pass

Adds local places inside OddEngine / FairlyOdd OS to save:

- operator profile details
- usernames / emails
- passwords
- API keys / secrets
- wallet / pool / survey / publishing credentials
- custom secret entries

## Security behavior

- **Desktop / Electron:** uses Electron `safeStorage` when available and saves the encrypted vault to the user's local app data folder.
- **Browser/dev fallback:** falls back to `localStorage` and is **not** equivalent to a real password manager.

## Main UI changes

- `Security` panel now includes a real **local vault** with sections for:
  - Operator profile
  - Trading
  - Publishing + AI keys
  - Mining + wallet
  - Games + filler cash
  - Custom entries
- `Preferences` gets an **Operator profile** section that writes into the same vault.

## Notes

This pass adds a local credential store seam. It does **not** automatically inject credentials into broker or third-party APIs yet.
