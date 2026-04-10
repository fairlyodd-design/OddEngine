# v10.26.3 — Homie Phoenix Signal Relay Pass

This pass makes OddEngine start sending real Phoenix desk reads into the separate Homie Companion app.

## What changed

- Added a Phoenix → Homie relay helper in `ui/src/lib/homiePhoenixRelay.ts`.
- Added relay settings in Preferences under **Phoenix signal relay**.
- Added a local relay log so you can see what OddEngine actually tried to send.
- Wired the Coinstore BTC/USDT Futures desk to emit:
  - `scanner:best_pair` when the top scanner winner is strong enough
  - `coach:wait` when Phoenix says wait
  - `coach:good_reclaim` when the reclaim cue is genuinely good
  - `alert:new_setup` when BTCUSDT has a live A/A+ style setup
  - `speech:say` for occasional live spoken summaries

## Kid version

1. Start **Homie Companion** first.
2. Start **OddEngine**.
3. Open **Preferences**.
4. Make sure **Homie Companion Bridge** is on and healthy.
5. Scroll to **Phoenix signal relay** and leave it on.
6. Open the Phoenix futures panel and let the scanner update.
7. Watch the relay log in Preferences and the event console in Homie Companion.

## Notes

- Relay is intentionally deduped so Homie does not spam the same line every second.
- Minimum score defaults to **84**.
- Everything stays optional and can be disabled from Preferences.
