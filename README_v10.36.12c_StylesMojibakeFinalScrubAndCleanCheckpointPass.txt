# v10.36.12c Styles Mojibake Final Scrub and Clean Checkpoint Pass

This pass is the follow-up to v10.36.12b2.

It:
- checks that duplicate tree and PATCH debris are gone
- backs up `ui/src/styles.css`
- safely attempts final mojibake cleanup without raw broken-character literals
- reruns `npm run audit:runtime`
- reruns `npm run build:web`
- writes a checkpoint report and manifest

Run:
`RUN_v10.36.12c_StylesMojibakeFinalScrubAndCleanCheckpointPass.bat`

Do not tag until this pass reports clean.
