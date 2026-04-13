# OddEngine Legacy HQ overlay

This overlay turns the existing `Builder` panel into a real family-legacy build board.

Included:
- `ui/src/panels/Builder.tsx` — Builder becomes Legacy HQ
- `ui/src/lib/legacyChecklist.ts` — structured roadmap, acceptance criteria, seeded statuses, exports
- `docs/legacy/*` — master checklist, status board, and spreadsheet-friendly matrix

Drop-in steps:
1. Unzip into the OddEngine repo root.
2. Overwrite when prompted.
3. Run the normal UI build/start flow.

What this adds:
- Phase roadmap from survival → front door → legacy core → daily ops → opportunity → maintainability → presence
- Panel-by-panel purpose, dependencies, acceptance criteria, and safe-fail flags
- Editable local status tracking
- Export to Markdown, JSON, CSV, and a ZIP pack from inside Builder

Important:
Seed statuses are starting assumptions, not a verified audit. Lock them after a real panel check.
