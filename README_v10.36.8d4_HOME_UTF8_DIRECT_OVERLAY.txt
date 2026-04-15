v10.36.8d4_HOME_UTF8_DIRECT_OVERLAY

This is the safer fix after the script-based encoding passes kept failing.

What this does:
- directly replaces ui/src/panels/Home.tsx with a clean UTF-8 version
- removes the mojibake text inside Home like:
  - FairlyOdd OS â€” Home
  - Good afternoon ðŸ‘Š
  - broken bullet / dash sequences

How to use:
1. Close OddEngine if it is running.
2. Unzip this over C:\OddEngine
3. Overwrite when prompted.
4. Restart OddEngine.

Important:
- This is a direct file overlay.
- No PowerShell patch script is required.
- If other panels still show mangled text after this, they need the same direct-overlay treatment individually.
