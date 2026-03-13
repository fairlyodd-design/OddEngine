# Preferences v10.24.96 merge guide

This pass does **not** require a full Preferences rewrite. The safest move is to expose Grocery / Swagbucks notes inside your existing Connections & Secrets Center.

## Add a Grocery / Swagbucks note section
Use your existing local-only credentials store and add:
- Swagbucks email
- Member name
- Notes
- Connected toggle

Those values are already stored by `saveSwagbucksCredentials()` in `ui/src/lib/grocerySwagbucks.ts`.

## Suggested field copy
- Email / login
- Member name
- Notes
- Connected

## Important
Do not store real passwords in Git.
Keep credentials local only.
