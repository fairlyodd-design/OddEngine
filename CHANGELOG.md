# Changelog

All notable changes to OddEngine are documented here.

---

## v10.26.20 — Home Live Info + Money Mode + Stability fixes

### Storage stats (h12b4)
- Storage cell now shows real disk usage percent via Electron IPC
- CPU/RAM and Network cells left untouched to preserve stability from h12b2

### Home live info cells (h12b2)
- System status card renders live CPU/RAM from runtime bridge → opens Dev Engine
- Storage card shows percent used → opens Builder
- Network card shows online/offline status, hostname, and IPs → opens Security

### Desktop runtime stats bridge (h12a)
- Added Electron IPC bridge for CPU, RAM, hostname, IP data
- Home CPU/RAM/Network cells now display live desktop stats
- Removed shrink/pin/move card overlay controls (CardGODMode is now a no-op)

### Money mode polish (h12)
- Home panel tuned for money mode: quick routes to Trading, Money, Options SaaS
- Homie default system prompt updated to be money-mode aware

### Grocery & Plugins hard fixes (h11c2)
- GroceryMeals: safe `normalizeItems` regex, `getItemName` normalization, safe state load, safe `buildList`, safe `estimateItemPrice`
- Plugins.tsx: removed stray closing `</div>` that caused a build crash at line ~282
- CardGODMode.tsx: removed invalid reference to `e` inside `persist()` (was throwing ReferenceError)

---

## v10.24.0 — Design-system layout pass (top 5 panels)

- Removed remaining inline spacing flow from Home, Calendar, Entertainment, Writers Lounge, and Trading
- Swapped repeated `marginTop`/`gap` wrappers into shared spacing primitives: `stack` / `grid` / `cluster` + `mt` utilities
- Tightened action rows, detail stacks, list wrappers, and table spacing for consistent OS feel
- Added small layout utility classes (`mt-*`, tight/loose cluster helpers, flow stacks, table wrap)
- No feature changes — visual/layout cohesion only

---

## v10.23.9 — Per-widget spacing grid normalization

- Added spacing primitives (`grid`/`stack`/`cluster`) + `subCard` styling for shared spacing language
- `widgetBody` defaults to vertical stack with consistent gap
- Calendar: converted inner panels + event tiles to `subCard` + grid utilities
- Writers Lounge: normalized Library/Tools internal layout spacing
- Home: minor internal grid normalization (Recent Activity list uses grid utility)

---

## v10.23.8 — Micro-spacing pass

- Tightened internal spacing: slightly reduced card padding + widget body margins
- Reduced common gap utilities to avoid "floaty" air
- Slightly tighter mission/timeline card padding for denser readability

---

## v10.23.7 — Header standard + action menus + layout reset

- Standardized widget headers (title/subtitle + right-side actions)
- CardFrame: replaced header button rows with single ⋯ action menu (Shrink/Move/Pin via FairlyGOD)
- PanelScheduleCard: presets moved into "+ Add" menu
- Entertainment: Browse actions tightened to Open/Favorite + Actions menu
- Preferences: new "Layout & Windows" section — reset card layouts, popout bounds, or all

---

## v10.23.6 — UI widget cleanup

- FairlyGOD card controls hidden by default; show on hover
- Controls moved away from widget header buttons

---

## v10.23.3 — One-piece OS Home (Now Playing + Routine Step + Top Tasks)

- Home: new Live Lane cards powered by Calendar + Activity
  - Now Playing (pulls from Entertainment + focuses player)
  - Current routine step (active/next from today's Calendar)
  - Today's top 3 tasks with completion checkboxes
- Entertainment: emits `entertainment-changed` event + logs Now Playing activity

---

## v10.23.2 — OS finish pass (Mission Control polish)

- Compact shell header mode toggle (button + `Ctrl/Cmd+Shift+H`)
- Home Mission Control cards focus Calendar to the correct date on tap
- Calendar supports external focus (Home/OS can jump to a specific day)
- Smooth panel transition (subtle fade-in)
- Dynamic greeting

---

## v10.23.1 — Lil Homie 3D (Three.js pipeline)

- True 3D render mode for Lil Homie using Three.js / react-three-fiber
- Auto-detects `ui/public/models/lilhomie.glb` (recommended animations: Idle/Walk/Talk)
- Safe fallback: lightweight 3D billboard buddy using `/public/assets/homie-mascot.png`
- New prefs: Lil Homie render (3D/2D) + energy slider
- Model drop-in docs: `ui/public/models/README.md`

---

## v10.23.0 — Lil Homie Agent (walking NPC assistant)

- Floating Lil Homie character that can roam the screen
- Drag anywhere; optional roam mode; position persists
- Walk cycle + talk animations (even in quiet mode)
- Click to open chat bubble with quick actions (Calendar / Command Bar / Homie / Writers Lounge)
- Desktop: uses local Homie (Ollama) via `oddApi().homieChat`
- Calendar nudges: ~12 min before upcoming events
- Preferences controls: on/off, roam, speech, speed, size, chatter

---

## v10.22.3 — OS Home + Entertainment polish + Writers Lounge

- OS-style shell feel: wallpaper/glass UI
- Home panel: smooth launcher dashboard (widgets + pinned apps + app grid + recent activity)
- Family Entertainment: Kodi-inspired "details + list" browse view + quick tiles
- Books panel upgraded to Writers Lounge with embedded AI writing assistant + clean 3-column layout

---

## v10.22.2 — Panel polish wave 2

- Clean headers (PanelHeader) + compact Data menu on: Mining, Money, FamilyHealth, GroceryMeals, Security, Plugins, DevEngine
- Schedule cards + Calendar quick-add presets on those panels
- Cross-links: "Open Calendar" actions + per-item Calendar buttons
- Navigation wiring: `onNavigate` prop added

---

## v10.22.1 — Panel polish wave 1: Brain / News / Homie + shared calendar hooks

- Brain: new top header + 4 clean views (Overview / Router / Notes / Systems)
- Brain: Ops schedule card (quick add reminders + upcoming items)
- News: new top header + action menu + News schedule card + "Add to calendar" on stories
- Homie: new top header + action menu + Dev schedule card + quick actions
- Calendar: dispatches `oddengine:calendar-changed` for instant panel refresh
- New shared components: `ActionMenu`, `PanelScheduleCard`, `calendarStore` helpers

---

## v10.22.0 — UI cleanup + Calendar panel

- Sidebar sections now collapsible (state persists)
- Pin stars only show on hover (pinned stars stay visible)
- FairlyGOD Layout bar cleaned up (Grid/Lock/Layout; advanced under Layout)
- New panel: Calendar (month view, add/edit/delete events, upcoming list)
- Calendar events can deep-link to a panel
- Shell header quick action: Open Calendar

---

## v10.21.9 — Homie mascot hype buddy animations

- Hype idle bounce + snappy rotations
- Pointer tracking (eyes/head feel) via subtle aim offsets
- Speaking intensity pulses (drives scale while talking)
- Gesture animations: wave/nod/tilt/spark
- Big emote FX buttons: 👊 🎉 ⚠️ 🤦
- Preferences: mascot animation toggle + energy slider

---

## v10.21.7 — Preferences crash fix (FairlyGOD defaults)

- Fix: "Cannot read properties of undefined (reading 'gridSize')"
- Added missing `DEFAULT_PREFS.fairlygod` + safe merge of stored prefs

---

## v10.21.6 — Homie mascot avatar (transparent memoji)

- New avatar skin: Fortnite mascot (transparent PNG)
- One-time migration to new skin as default (reversible in Preferences)
- Skin-specific idle gestures (no wink for memoji image)

---

## v10.21.5 — Fix HomieBuddy crash (skin TDZ)

- Fix: Cannot access 'skin' before initialization (idle-gesture effect referenced skin before declaration)

---

## v10.21.4 — Homie Rive "game buddy" mode

- Optional Rive runtime via `@rive-app/react-webgl2`
- Prefs + quick toggle: Game buddy on/off
- Drives state machine inputs: `isTalking`/`isListening`/`mood`/`lookX`/`lookY` + gesture triggers
- Safe fallback to classic CSS Homie if `.riv` is missing

---

## v10.21.3 — Homie Buddy animation pass

- Orb: blink + pupil drift + brows/cheeks, spark/wink/nod/tilt idle gestures
- Lil Homie: idle wave/nod/tilt gestures
- Gestures pause while Listening/Speaking
- Respects `prefers-reduced-motion`

---

## v10.20.8 — Bright UI + cleaner collapsible cards

- Brighter shell background using FairlyOdd logo palette
- Card controls fade in on hover
- Double-click card header to collapse/expand
- Weather fetch: longer timeout + retry + cached fallback

---

## v10.20.7 — Ticket smart exits + broker-friendly copy

- Auto-fill exit stop from entry and stop-loss %
- Take-profit ladder buttons (25/50/100) with target price badges
- Copy broker-friendly ticket string (Public/Tradier style) including stops/TPs
- Auto-fill TP from custom profit % input
- Bracket/OCO copy block (entry + exits)

---

## v10.19.9 — "Never again" launcher protections

- Guard: auto-wipe `ui\node_modules\.vite` when UI version changes
- Guard: preflight `npm --prefix ui run build` before launching (fail fast on TS errors)

---

## v10.19.7 — Multi-monitor routine presets + display assignments

- Display enumeration (`odd:getDisplays`)
- Routine tiler supports presets + per-panel display assignments
- Routine Launcher: style selector per routine + Tile/Close controls
- Tiling styles: Grid / Left-main+stack / 2×2 Hero (remembered per routine id)

---

## v10.19.6 — Routine tiling styles

- Tiling styles: Grid / Left-main+stack / 2×2 Hero
- Routine Launcher: style selector per routine + Tile/Close controls
- Desktop: tiling style persisted per routine id

---

## v10.19.5 — Routine window auto-stack + clean shutdown

- Routine windows tracked by routine id
- Auto-stack (tile) routine windows via IPC
- One-click close routine windows

---

## v10.19.4 — Routine Launcher panel

- New panel: Routine Launcher (apply a global set + open a panel sequence)
- Modes: Windows (multi-window cockpit) or Main Shell step-through

---

## v10.19.3 — Layout cloning + global preset sets

- Panel-to-panel layout cloning (Copy To / Clone In)
- Global preset sets (e.g. "Morning Routine") — Save→Set, Apply→This, Apply All

---

## v10.19.2 — Grid + lock + presets + reset

- Snap grid + alignment guides (Shift disables snapping)
- Lock layout toggle
- Layout presets per panel (Save/Apply)
- One-click Reset panel layout

---

## v10.19.0 — FairlyGOD Mode foundation

- CardFrame: shrink + move + resize inside panels
- Money: Sellables Pipeline (books/GPTs/apps/templates)
- Books Vault panel

---

## v10.16.1 — Shared AI Brain + assistant dock

- Shared AI Brain service with specialist copilots per panel
- Embedded assistant dock across the OS
- Brain router: goals, notes, daily digest, pinned memory
- Global AI command bar + right-side AI inbox/activity rail
- Upgraded Security, Money, and Options SaaS panels
- AI defaults in Preferences
