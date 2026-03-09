import React, { useEffect } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { loadPrefs } from "../lib/prefs";
import { PANEL_META } from "../lib/brain";

type Persisted = {
  collapsed?: boolean;
  floating?: boolean;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  // Docked (in-flow) size overrides (lets cards be sizable even when not floating)
  dw?: number;
  dh?: number;
  pinned?: boolean;
  lastTouched?: number;
};

type PresetsStore = {
  presets: Record<string, Record<string, Persisted>>; // name -> cardStorageKey -> persisted
};

type GlobalSetsStore = {
  sets: Record<
    string,
    {
      // panelId -> template array (card index -> persisted layout)
      templates: Record<string, Persisted[]>;
    }
  >;
};

function keyFor(panelId: string, el: HTMLElement, index: number) {
  const id = el.getAttribute("id");
  if (id) return `${panelId}::${id}`;
  // Stable-ish key: panel + card index within panel.
  return `${panelId}::card-${index + 1}`;
}

function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function deriveStableCardId(panelId: string, card: HTMLElement, index: number, used: Set<string>) {
  const existing = card.getAttribute("id");
  if (existing) return existing;
  // Prefer the first header-like text inside the card.
  const headerEl =
    card.querySelector(".h") ||
    card.querySelector("h1,h2,h3") ||
    card.querySelector("[data-title]");
  const headerText =
    (headerEl && (headerEl as HTMLElement).textContent) ||
    card.getAttribute("data-title") ||
    "";
  const base = slugify(headerText) || `card-${index + 1}`;
  let id = `card-${panelId}-${base}`;
  let n = 2;
  while (used.has(id)) {
    id = `card-${panelId}-${base}-${n++}`;
  }
  used.add(id);
  card.setAttribute("id", id);
  return id;
}

// FairlyGOD Mode: make *all* panel cards shrinkable + movable, without
// refactoring every panel file. DOM enhancer scoped to .panelMain.
export default function CardGODMode({ panelId }: { panelId: string }) {
  useEffect(() => {
    const root = document.querySelector('.panelMain[data-panelid="' + panelId + '"]') as HTMLElement | null;
    if (!root) return;

    // Layout state per panel
    const layoutKey = `oddengine:godlayout:${panelId}`;
    const presetsKey = `oddengine:godpresets:${panelId}`;
    const templateKey = `oddengine:godtemplate:${panelId}`;
    const globalSetsKey = `oddengine:godglobalsets:v1`;
    const prefs = loadPrefs();

    const layout =
      loadJSON<{ locked?: boolean; grid?: boolean; gridSize?: number; compact?: boolean; compactKeep?: number }>(layoutKey, {
        locked: false,
        grid: prefs.fairlygod?.snapEnabled ?? true,
        gridSize: prefs.fairlygod?.gridSize ?? 16,
      }) || { locked: false, grid: prefs.fairlygod?.snapEnabled ?? true, gridSize: prefs.fairlygod?.gridSize ?? 16, compact: prefs.fairlygod?.compactEnabled ?? false, compactKeep: prefs.fairlygod?.compactKeep ?? 3 };

    const getPresetsStore = () =>
      ((loadJSON<PresetsStore>(presetsKey, { presets: {} }) as PresetsStore) || { presets: {} }) as PresetsStore;

    const getGlobalSetsStore = () =>
      ((loadJSON<GlobalSetsStore>(globalSetsKey, { sets: {} }) as GlobalSetsStore) || { sets: {} }) as GlobalSetsStore;

    const persistLayout = () => saveJSON(layoutKey, layout);

    // A small toolbar that lives at the top-right of each panel.
    // Provides: Grid toggle + Lock layout + Presets + Reset + Cross-panel cloning + Global preset sets.
    const ensureToolbar = () => {
      let bar = root.querySelector<HTMLElement>(".godLayoutBar");
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "godLayoutBar godCollapsed";
        bar.innerHTML = `
          <div class="godLayoutBarRow">
            <button class="godMiniBtn" data-act="grid">Grid</button>
            <button class="godMiniBtn" data-act="lock">Lock</button>
            <button class="godMiniBtn active" data-act="more">Layout</button>
          </div>
          <div class="godLayoutBarRow godAdvanced">
            <button class="godMiniBtn" data-act="compact">Compact</button>
            <button class="godMiniBtn" data-act="collapseAll">Collapse</button>
            <button class="godMiniBtn" data-act="expandAll">Expand</button>
          </div>
          <div class="godLayoutBarRow godAdvanced">
            <select class="godSelect" data-act="presetSelect"></select>
            <button class="godMiniBtn" data-act="savePreset">Save</button>
            <button class="godMiniBtn" data-act="applyPreset">Apply</button>
            <button class="godMiniBtn danger" data-act="reset">Reset</button>
          </div>
          <div class="godLayoutBarRow godAdvanced">
            <select class="godSelect" data-act="cloneFromPanel"></select>
            <select class="godSelect" data-act="cloneFromPreset"></select>
            <button class="godMiniBtn" data-act="cloneIn">Clone In</button>
            <select class="godSelect" data-act="copyToPanel"></select>
            <button class="godMiniBtn" data-act="copyTo">Copy To</button>
          </div>
          <div class="godLayoutBarRow godAdvanced">
            <select class="godSelect" data-act="setSelect"></select>
            <button class="godMiniBtn" data-act="saveToSet">Save→Set</button>
            <button class="godMiniBtn" data-act="applySetThis">Apply→This</button>
            <button class="godMiniBtn" data-act="applySetAll">Apply All</button>
          </div>
          <div class="godLayoutHint"></div>
        `;
        root.appendChild(bar);
      }

      // Initialize UI state
      root.classList.toggle("godGridOn", !!layout.grid);
      root.classList.toggle("godLocked", !!layout.locked);
      const gridBtn = bar.querySelector<HTMLButtonElement>('button[data-act="grid"]');
      const lockBtn = bar.querySelector<HTMLButtonElement>('button[data-act="lock"]');
      const compactBtn = bar.querySelector<HTMLButtonElement>('button[data-act="compact"]');
      const moreBtn = bar.querySelector<HTMLButtonElement>('button[data-act="more"]');
      const hint = bar.querySelector<HTMLElement>(".godLayoutHint");
      if (gridBtn) gridBtn.textContent = layout.grid ? `Grid: On` : `Grid: Off`;
      if (lockBtn) lockBtn.textContent = layout.locked ? `Lock: On` : `Lock: Off`;
      if (compactBtn) compactBtn.textContent = layout.compact ? `Compact: On` : `Compact: Off`;

      if (moreBtn) moreBtn.textContent = bar.classList.contains("godCollapsed") ? "Layout" : "Layout ▲";

      if (hint) {
        hint.textContent = layout.locked
          ? "Layout locked. Toggle Lock to move/resize cards."
          : "Tip: Hold Shift to temporarily disable snapping.";
      }

      // Populate presets
      const select = bar.querySelector<HTMLSelectElement>('select[data-act="presetSelect"]');
      if (select) {
        const store = getPresetsStore();
        const names = Object.keys(store.presets || {}).sort((a, b) => a.localeCompare(b));
        select.innerHTML =
          `<option value="">Presets…</option>` + names.map((n) => `<option value="${n}">${n}</option>`).join(" ");
      }

      // Populate panel selects (clone/copy)
      const panelIds = PANEL_META.map((p) => p.id);
      const cloneFrom = bar.querySelector<HTMLSelectElement>('select[data-act="cloneFromPanel"]');
      const copyTo = bar.querySelector<HTMLSelectElement>('select[data-act="copyToPanel"]');
      const mkPanelOptions = (current: string) =>
        `<option value="">Panel…</option>` +
        panelIds
          .sort((a, b) => a.localeCompare(b))
          .map((id) => `<option value="${id}" ${id === current ? "selected" : ""}>${id}</option>`)
          .join(" ");
      if (cloneFrom) cloneFrom.innerHTML = mkPanelOptions(panelId);
      if (copyTo) copyTo.innerHTML = mkPanelOptions("");

      // Populate clone preset list based on selected source panel
      const clonePreset = bar.querySelector<HTMLSelectElement>('select[data-act="cloneFromPreset"]');
      const sourcePanelId = (cloneFrom?.value || "").trim() || panelId;
      if (clonePreset) {
        const sourcePresetsKey = `oddengine:godpresets:${sourcePanelId}`;
        const sourceStore = ((loadJSON<PresetsStore>(sourcePresetsKey, { presets: {} }) as PresetsStore) || {
          presets: {},
        }) as PresetsStore;
        const names = Object.keys(sourceStore.presets || {}).sort((a, b) => a.localeCompare(b));
        clonePreset.innerHTML =
          `<option value="">Preset…</option>` + names.map((n) => `<option value="${n}">${n}</option>`).join(" ");
      }

      // Populate global sets
      const setSel = bar.querySelector<HTMLSelectElement>('select[data-act="setSelect"]');
      if (setSel) {
        const gs = getGlobalSetsStore();
        const names = Object.keys(gs.sets || {}).sort((a, b) => a.localeCompare(b));
        setSel.innerHTML =
          `<option value="">Sets…</option>` + names.map((n) => `<option value="${n}">${n}</option>`).join(" ");
      }

      // Handle toolbar actions
      if (bar.dataset.bound !== "1") {
        bar.addEventListener("click", (e) => {
          const t = e.target as HTMLElement;
          const act = t.getAttribute("data-act");
          if (!act) return;
          e.preventDefault();
          e.stopPropagation();

          if (act === "grid") {
            layout.grid = !layout.grid;
            persistLayout();
            root.classList.toggle("godGridOn", !!layout.grid);
            const btn = bar!.querySelector<HTMLButtonElement>('button[data-act="grid"]');
            if (btn) btn.textContent = layout.grid ? `Grid: On` : `Grid: Off`;
          }

          if (act === "lock") {
            layout.locked = !layout.locked;
            persistLayout();
            root.classList.toggle("godLocked", !!layout.locked);
            const btn = bar!.querySelector<HTMLButtonElement>('button[data-act="lock"]');
            if (btn) btn.textContent = layout.locked ? `Lock: On` : `Lock: Off`;
            const hintEl = bar!.querySelector<HTMLElement>(".godLayoutHint");
            if (hintEl)
              hintEl.textContent = layout.locked
                ? "Layout locked. Toggle Lock to move/resize cards."
                : "Tip: Hold Shift to temporarily disable snapping.";
          }

          if (act === "compact") {
            layout.compact = !layout.compact;
            persistLayout();
            root.classList.toggle("godCompactOn", !!layout.compact);
	            // Use single quotes to avoid nested quote parsing issues in TSX
	            const btn = bar!.querySelector<HTMLButtonElement>('button[data-act="compact"]');
            if (btn) btn.textContent = layout.compact ? `Compact: On` : `Compact: Off`;
            applyCompactMode();
          }

          if (act === "more") {
            bar!.classList.toggle("godCollapsed");
            const btn = bar!.querySelector<HTMLButtonElement>('button[data-act="more"]');
            if (btn) btn.textContent = bar!.classList.contains("godCollapsed") ? "Layout" : "Layout ▲";
          }

          if (act === "collapseAll") {
            applyAllCollapse(true);
          }

          if (act === "expandAll") {
            applyAllCollapse(false);
            // If compact is enabled, re-apply smart compact after expanding
            if (layout.compact) applyCompactMode();
          }

          if (act === "reset") {
            const ok = window.confirm(
              "Reset this panel layout? (This clears card positions/sizes and presets for this panel.)"
            );
            if (!ok) return;
            try {
              const store = getPresetsStore();
              store.presets = {};
              saveJSON(presetsKey, store);
              // Card keys cleared by map below.
              root.dataset.godReset = String(Date.now());
            } catch (err) {
              console.warn("reset failed", err);
            }
          }

          if (act === "cloneIn") {
            const src = (bar!.querySelector<HTMLSelectElement>('select[data-act="cloneFromPanel"]')?.value || "").trim();
            const presetName = (
              bar!.querySelector<HTMLSelectElement>('select[data-act="cloneFromPreset"]')?.value || ""
            ).trim();
            if (!src) {
              window.alert("Pick a source panel to clone from.");
              return;
            }

            const srcTemplateKey = `oddengine:godtemplate:${src}`;
            const srcTemplate = (loadJSON<Persisted[]>(srcTemplateKey, []) || []) as Persisted[];

            let templateToApply: Persisted[] = srcTemplate;

            if ((!templateToApply || templateToApply.length === 0) && presetName) {
              const srcPresetsKey = `oddengine:godpresets:${src}`;
              const srcStore = ((loadJSON<PresetsStore>(srcPresetsKey, { presets: {} }) as PresetsStore) || {
                presets: {},
              }) as PresetsStore;
              const preset = srcStore.presets?.[presetName];
              if (preset) {
                const vals = Object.keys(preset)
                  .sort((a, b) => a.localeCompare(b))
                  .map((k) => preset[k]);
                templateToApply = vals;
              }
            }

            if (!templateToApply || templateToApply.length === 0) {
              window.alert(
                "No cloneable template found for that panel yet. Open it once and move some cards, then try again."
              );
              return;
            }

            const cards = Array.from(root.querySelectorAll<HTMLElement>(".card")).filter(
              (c) => !c.closest(".rail") && !c.closest(".activityRail")
            );
            const used = new Set<string>();
            cards.forEach((card, idx) => {
              // Ensure stable id for layout keys (prevents drift when card order changes)
              deriveStableCardId(panelId, card, idx, used);
              const storageKey = `oddengine:godcard:${keyFor(panelId, card, idx)}`;
              const p = templateToApply[idx];
              if (!p) return;
              saveJSON(storageKey, p);
            });
            saveJSON(templateKey, templateToApply);

            cardAPI.forEach((api, sk) => {
              const next = (loadJSON<Persisted>(sk, {}) || {}) as Persisted;
              Object.assign(api.persisted, next);
              api.applyPersisted();
            });
          }

          if (act === "copyTo") {
            const dst = (bar!.querySelector<HTMLSelectElement>('select[data-act="copyToPanel"]')?.value || "").trim();
            if (!dst) {
              window.alert("Pick a target panel to copy to.");
              return;
            }

            const cards = Array.from(root.querySelectorAll<HTMLElement>(".card")).filter(
              (c) => !c.closest(".rail") && !c.closest(".activityRail")
            );
            const used = new Set<string>();
            const template: Persisted[] = cards.map((card, idx) => {
              // Ensure stable id for layout keys (prevents drift when card order changes)
              deriveStableCardId(panelId, card, idx, used);
              const storageKey = `oddengine:godcard:${keyFor(panelId, card, idx)}`;
              return ((loadJSON<Persisted>(storageKey, {}) || {}) as Persisted) || {};
            });

            saveJSON(`oddengine:godtemplate:${dst}`, template);
            window.alert(`Copied this layout template to ${dst}. Open ${dst} to see it apply.`);
          }

          if (act === "saveToSet") {
            const current = (bar!.querySelector<HTMLSelectElement>('select[data-act="setSelect"]')?.value || "").trim();
            const setName = current || window.prompt("Set name?", "Morning Routine") || "";
            if (!setName) return;
            const cards = Array.from(root.querySelectorAll<HTMLElement>(".card")).filter(
              (c) => !c.closest(".rail") && !c.closest(".activityRail")
            );
            const used = new Set<string>();
            const template: Persisted[] = cards.map((card, idx) => {
              // Ensure stable id for layout keys (prevents drift when card order changes)
              deriveStableCardId(panelId, card, idx, used);
              const storageKey = `oddengine:godcard:${keyFor(panelId, card, idx)}`;
              return ((loadJSON<Persisted>(storageKey, {}) || {}) as Persisted) || {};
            });

            const gs = getGlobalSetsStore();
            if (!gs.sets[setName]) gs.sets[setName] = { templates: {} };
            gs.sets[setName].templates[panelId] = template;
            saveJSON(globalSetsKey, gs);
            saveJSON(templateKey, template);
            ensureToolbar();
          }

          if (act === "applySetThis") {
            const setName = (bar!.querySelector<HTMLSelectElement>('select[data-act="setSelect"]')?.value || "").trim();
            if (!setName) return;
            const gs = getGlobalSetsStore();
            const template = gs.sets?.[setName]?.templates?.[panelId];
            if (!template || template.length === 0) {
              window.alert("That set doesn't have a layout for this panel yet. Use Save→Set from this panel first.");
              return;
            }
            const cards = Array.from(root.querySelectorAll<HTMLElement>(".card")).filter(
              (c) => !c.closest(".rail") && !c.closest(".activityRail")
            );
            cards.forEach((card, idx) => {
              // Ensure stable id for layout keys (prevents drift when card order changes)
        deriveStableCardId(panelId, card, idx, usedIds);
        const storageKey = `oddengine:godcard:${keyFor(panelId, card, idx)}`;
              const p = template[idx];
              if (!p) return;
              saveJSON(storageKey, p);
            });
            saveJSON(templateKey, template);
            cardAPI.forEach((api, sk) => {
              const next = (loadJSON<Persisted>(sk, {}) || {}) as Persisted;
              Object.assign(api.persisted, next);
              api.applyPersisted();
            });
          }

          if (act === "applySetAll") {
            const setName = (bar!.querySelector<HTMLSelectElement>('select[data-act="setSelect"]')?.value || "").trim();
            if (!setName) return;
            const gs = getGlobalSetsStore();
            const templates = gs.sets?.[setName]?.templates || {};
            const panels = Object.keys(templates);
            if (panels.length === 0) {
              window.alert("That set is empty. Use Save→Set from a panel to add it.");
              return;
            }
            panels.forEach((pid) => {
              saveJSON(`oddengine:godtemplate:${pid}`, templates[pid] || []);
            });
            window.alert(`Applied set '${setName}' to ${panels.length} panel(s). Open each panel to see it apply instantly.`);
          }
        });

        bar.dataset.bound = "1";
      }

      // Update clone preset list when cloneFromPanel changes
      if (bar.dataset.changeBound !== "1") {
        bar.addEventListener("change", (e) => {
          const t = e.target as HTMLElement;
          const act = t.getAttribute("data-act");
          if (act === "cloneFromPanel") {
            ensureToolbar();
          }
        });
        bar.dataset.changeBound = "1";
      }

      return bar;
    };

    const bar = ensureToolbar();

    // Guide lines
    const ensureGuides = () => {
      let gx = root.querySelector<HTMLElement>(".godGuideX");
      let gy = root.querySelector<HTMLElement>(".godGuideY");
      if (!gx) {
        gx = document.createElement("div");
        gx.className = "godGuideX";
        root.appendChild(gx);
      }
      if (!gy) {
        gy = document.createElement("div");
        gy.className = "godGuideY";
        root.appendChild(gy);
      }
      return { gx, gy };
    };

    const guides = ensureGuides();

    // Template layouts enable cross-panel cloning and global sets.
    // Applied by card index when a card has no persisted state yet.
    const panelTemplate = (loadJSON<Persisted[]>(templateKey, []) || []) as Persisted[];

    // Track attached cards for presets/reset.
    const knownKeys = new Set<string>();
    const cardAPI = new Map<
      string,
      { card: HTMLElement; applyPersisted: () => void; persisted: Persisted; storageKey: string }
    >();


    const applyAllCollapse = (collapsed: boolean) => {
      cardAPI.forEach((api, sk) => {
        const next = (loadJSON<Persisted>(sk, {}) || {}) as Persisted;
        next.collapsed = collapsed;
        saveJSON(sk, next);
        Object.assign(api.persisted, next);
        api.applyPersisted();
      });
    };

    const applyCompactMode = () => {
      const keep = Math.max(1, Math.min(12, layout.compactKeep || 3));
      const cards = Array.from(root.querySelectorAll<HTMLElement>(".card")).filter(
        (c) => !c.closest(".rail") && !c.closest(".activityRail")
      );

      // Smart compact mode: keep open
      //  - pinned cards
      //  - recently interacted cards (top N)
      //  - mission/control cards (heuristic)
      //  - always keep the first card
      const items = cards.map((card, idx) => {
        const storageKey = `oddengine:godcard:${keyFor(panelId, card, idx)}`;
        const state = (loadJSON<Persisted>(storageKey, {}) || {}) as Persisted;
        const headerEl = (card.querySelector(".h") as HTMLElement | null) || (card.querySelector("h1,h2,h3") as HTMLElement | null);
        const headerText = (headerEl?.textContent || "").toLowerCase();
        const missionLike = /mission|copilot|action|operator|queue|priority/.test(headerText);
        return { card, idx, storageKey, state, missionLike };
      });

      // Pick top recently touched (excluding undefined)
      const recent = items
        .filter((it) => typeof it.state.lastTouched === "number")
        .sort((a, b) => (b.state.lastTouched || 0) - (a.state.lastTouched || 0))
        .slice(0, keep)
        .map((it) => it.storageKey);

      const keepOpen = new Set<string>();
      // Always keep the first card open (panel hero)
      if (items[0]) keepOpen.add(items[0].storageKey);
      // Pinned + mission-like
      items.forEach((it) => {
        if (it.state.pinned) keepOpen.add(it.storageKey);
        if (it.missionLike) keepOpen.add(it.storageKey);
      });
      // Recent
      recent.forEach((k) => keepOpen.add(k));

      // If compact is OFF, do nothing. If ON, collapse the rest.
      items.forEach((it) => {
        const api = cardAPI.get(it.storageKey);
        if (!api) return;
        const next = (loadJSON<Persisted>(it.storageKey, {}) || {}) as Persisted;
        if (layout.compact) next.collapsed = !keepOpen.has(it.storageKey);
        saveJSON(it.storageKey, next);
        Object.assign(api.persisted, next);
        api.applyPersisted();
      });
    };

    const attach = () => {
      const usedIds = new Set<string>();
      const cards = Array.from(root.querySelectorAll<HTMLElement>(".card"))
        // Avoid injecting into nested rails/mini widgets that already have controls
        .filter((c) => !c.closest(".rail") && !c.closest(".activityRail"));

      cards.forEach((card, idx) => {
        // Skip if already processed or if it's a CardFrame (it has its own controls)
        if (card.dataset.godAttached === "1") return;
        if (card.classList.contains("cardFloating")) return;

        // Ensure stable id for layout keys (prevents drift when card order changes)
        deriveStableCardId(panelId, card, idx, usedIds);
        const storageKey = `oddengine:godcard:${keyFor(panelId, card, idx)}`;
        knownKeys.add(storageKey);
        let persisted = (loadJSON<Persisted>(storageKey, {}) || {}) as Persisted;

        const hasAny =
          persisted &&
          (typeof persisted.collapsed !== "undefined" ||
            typeof persisted.floating !== "undefined" ||
            typeof persisted.x !== "undefined" ||
            typeof persisted.y !== "undefined" ||
            typeof persisted.w !== "undefined" ||
            typeof persisted.h !== "undefined");
        if (!hasAny && panelTemplate && panelTemplate[idx]) {
          persisted = { ...(panelTemplate[idx] || {}) };
          saveJSON(storageKey, persisted);
        }

        // Ensure card can host overlay controls.
        const computed = window.getComputedStyle(card);
        if (computed.position === "static") card.style.position = "relative";

        const controls = document.createElement("div");
        controls.className = "godCardControls";
        controls.innerHTML = `
          <button class="godBtn godIconBtn" data-act="shrink" title="Shrink / collapse">—</button>
          <button class="godBtn godIconBtn" data-act="move" title="Move / float">✥</button>
          <button class="godBtn godBtnAccent godPinBtn godIconBtn" data-act="pin" title="Pin">📌</button>
        `;

        const widgetHeader = card.querySelector<HTMLElement>(".widgetHeader");
        const panelChromeRow = card.querySelector<HTMLElement>(".panelChromeActions");
        const headerRight = widgetHeader?.querySelector<HTMLElement>(".widgetHeaderRight");
        if (panelChromeRow) {
          controls.classList.add("godCardControlsInline", "godCardControlsHeader");
          panelChromeRow.prepend(controls);
        } else if (widgetHeader) {
          const mount = headerRight || document.createElement("div");
          if (!headerRight) {
            mount.className = "widgetHeaderRight";
            widgetHeader.appendChild(mount);
          }
          controls.classList.add("godCardControlsInline", "godCardControlsHeader");
          mount.prepend(controls);
        } else {
          card.appendChild(controls);
        }

        // QoL: double‑click the card header to collapse/expand (fast declutter).
        const headerToggleEl =
          (card.querySelector(".h") as HTMLElement | null) ||
          (card.querySelector("h1,h2,h3") as HTMLElement | null) ||
          (card.querySelector("[data-title]") as HTMLElement | null);
        if (headerToggleEl && headerToggleEl.dataset.godBound !== "1") {
          headerToggleEl.dataset.godBound = "1";
          headerToggleEl.style.cursor = "pointer";
          headerToggleEl.title = "Double-click to collapse/expand";
          headerToggleEl.addEventListener("dblclick", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            persisted.collapsed = !persisted.collapsed;
            applyPersisted();
            persist();
          });
        }

        const applyPersisted = () => {
          const collapsed = !!persisted.collapsed;
          const floating = !!persisted.floating;
          const pinned = !!persisted.pinned;
          card.dataset.godCollapsed = collapsed ? "1" : "0";
          card.dataset.godFloating = floating ? "1" : "0";
          card.dataset.godPinned = pinned ? "1" : "0";

          if (pinned) card.classList.add("godPinned");
          else card.classList.remove("godPinned");

          const pinBtn = controls.querySelector<HTMLButtonElement>("button[data-act=\"pin\"]");
          if (pinBtn) pinBtn.textContent = pinned ? "Pinned" : "Pin";

          if (collapsed) card.classList.add("godCollapsed");
          else card.classList.remove("godCollapsed");

          if (floating) {
            card.classList.add("godFloating");
            card.style.position = "absolute";
            card.style.left = `${persisted.x ?? 18}px`;
            card.style.top = `${persisted.y ?? 18}px`;
            card.style.width = `${persisted.w ?? Math.max(420, card.getBoundingClientRect().width)}px`;
            card.style.height = collapsed ? "auto" : `${persisted.h ?? 320}px`;
            card.style.zIndex = "40";
            card.style.resize = layout.locked || collapsed ? "none" : "both";
            card.style.overflow = collapsed ? "hidden" : "auto";
          } else {
            card.classList.remove("godFloating");
            // restore to normal flow (but allow user-sized width/height)
            card.style.position = "relative";
            card.style.left = "";
            card.style.top = "";
            // If the user resized while docked, honor it.
            if (Number.isFinite(Number((persisted as any).dw))) card.style.width = `${Number((persisted as any).dw)}px`;
            else card.style.width = "";
            if (!collapsed && Number.isFinite(Number((persisted as any).dh))) card.style.height = `${Number((persisted as any).dh)}px`;
            else card.style.height = "";
            card.style.zIndex = "";
            card.style.resize = layout.locked || collapsed ? "none" : "both";
            card.style.overflow = collapsed ? "hidden" : "auto";
          }
        };

        applyPersisted();

        const persist = () => {
          const collapsed = card.classList.contains("godCollapsed");
          const floating = card.classList.contains("godFloating");
          const rect = card.getBoundingClientRect();
          // If user is grabbing the native resize handle (bottom-right), don't start a drag.
          const edge = 18;
          if (e.clientX > rect.right - edge && e.clientY > rect.bottom - edge) return;
          const rootRect = root.getBoundingClientRect();
          const next: Persisted = {
            collapsed,
            floating,
            x: floating ? rect.left - rootRect.left : persisted.x,
            y: floating ? rect.top - rootRect.top : persisted.y,
            // Floating size
            w: floating ? rect.width : persisted.w,
            h: floating ? rect.height : persisted.h,
            // Docked size (only persist if user explicitly resized, which sets inline width/height)
            dw: !floating ? (card.style.width ? rect.width : (persisted as any).dw) : (persisted as any).dw,
            dh: !floating ? (card.style.height ? rect.height : (persisted as any).dh) : (persisted as any).dh,
            pinned: persisted.pinned,
            lastTouched: persisted.lastTouched,
          };
          saveJSON(storageKey, next);
          Object.assign(persisted, next);
        };

        // Drag handling (only when floating)
        let drag: { sx: number; sy: number; x: number; y: number } | null = null;
        const onMove = (e: MouseEvent) => {
          if (!drag) return;
          const dx = e.clientX - drag.sx;
          const dy = e.clientY - drag.sy;
          let nx = Math.max(0, drag.x + dx);
          let ny = Math.max(0, drag.y + dy);

          const doSnap = !!layout.grid && !e.shiftKey;
          const g = Math.max(8, Math.min(48, layout.gridSize || 16));
          if (doSnap) {
            nx = Math.round(nx / g) * g;
            ny = Math.round(ny / g) * g;
          }

          guides.gx.style.opacity = "1";
          guides.gy.style.opacity = "1";
          guides.gx.style.top = `${ny}px`;
          guides.gy.style.left = `${nx}px`;

          card.style.left = `${nx}px`;
          card.style.top = `${ny}px`;
        };
        const onUp = () => {
          if (!drag) return;
          drag = null;
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);

          // Snap final position/size
          if (layout.grid) {
            const g = Math.max(8, Math.min(48, layout.gridSize || 16));
            const l = parseFloat(card.style.left || "0");
            const t = parseFloat(card.style.top || "0");
            const w = card.getBoundingClientRect().width;
            const h = card.getBoundingClientRect().height;
            card.style.left = `${Math.round(l / g) * g}px`;
            card.style.top = `${Math.round(t / g) * g}px`;
            if (card.classList.contains("godFloating") && !card.classList.contains("godCollapsed")) {
              card.style.width = `${Math.max(g * 10, Math.round(w / g) * g)}px`;
              card.style.height = `${Math.max(g * 8, Math.round(h / g) * g)}px`;
            }
          }

          guides.gx.style.opacity = "0";
          guides.gy.style.opacity = "0";
          persist();
        };

        // Click handlers
        controls.addEventListener("click", (e) => {
          const target = e.target as HTMLElement;
          const act = target.getAttribute("data-act");
          if (!act) return;
          e.preventDefault();
          e.stopPropagation();
          if (layout.locked && act === "move") return;
          if (act === "shrink") {
            const collapsed = !card.classList.contains("godCollapsed");
            if (collapsed) card.classList.add("godCollapsed");
            else card.classList.remove("godCollapsed");
            persist();
            applyPersisted();
          }
          if (act === "move") {
            const floating = !card.classList.contains("godFloating");
            if (floating) card.classList.add("godFloating");
            else card.classList.remove("godFloating");
            persist();
            applyPersisted();
          }
          if (act === "pin") {
            persisted.pinned = !persisted.pinned;
            persist();
            applyPersisted();
          }
        });

        // Track recent interaction so Smart Compact Mode can keep active cards open.
        let lastTouchAt = 0;
        card.addEventListener("pointerdown", (ev) => {
          const t = ev.target as HTMLElement;
          if (t.closest(".godCardControls")) return;
          if (t.closest("button")) return;
          if (t.closest("input") || t.closest("textarea") || t.closest("select")) return;
          const now = Date.now();
          if (now - lastTouchAt < 800) return;
          lastTouchAt = now;
          persisted.lastTouched = now;
          // Persist touch without disturbing layout state
          try {
            const cur = (loadJSON<any>(storageKey, {}) || {}) as any;
            saveJSON(storageKey, { ...cur, lastTouched: now, pinned: persisted.pinned });
          } catch {}
        });

        // Drag start: click & drag anywhere on card header zone.
        card.addEventListener("mousedown", (e) => {
          if (!card.classList.contains("godFloating")) return;
          if (layout.locked) return;
          const target = e.target as HTMLElement;
          if (target.closest("button")) return;
          // don't interfere with text inputs
          if (target.closest("input") || target.closest("textarea") || target.closest("select")) return;
          const rect = card.getBoundingClientRect();
          const rootRect = root.getBoundingClientRect();
          drag = { sx: e.clientX, sy: e.clientY, x: rect.left - rootRect.left, y: rect.top - rootRect.top };
          guides.gx.style.opacity = "1";
          guides.gy.style.opacity = "1";
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        });

        // Persist size changes when user resizes.
        const ro = new ResizeObserver(() => {
          if (layout.locked) return;
          if (card.classList.contains("godCollapsed")) return;
          if (card.classList.contains("godFloating")) {
            persist();
            return;
          }
          // Docked: only persist when the user resized (inline width/height set).
          if (card.style.width || card.style.height) {
            persist();
          }
        });
        ro.observe(card);

        cardAPI.set(storageKey, { card, applyPersisted, persisted, storageKey });

        card.dataset.godAttached = "1";
      });

      // Handle reset request: clear all known keys.
      if (root.dataset.godReset) {
        delete root.dataset.godReset;
        try {
          knownKeys.forEach((k) => localStorage.removeItem(k));
          localStorage.removeItem(presetsKey);
        } catch (err) {
          console.warn("layout reset error", err);
        }
        cardAPI.forEach((api) => {
          api.persisted.collapsed = false;
          api.persisted.floating = false;
          api.persisted.x = undefined;
          api.persisted.y = undefined;
          api.persisted.w = undefined;
          api.persisted.h = undefined;
          (api.persisted as any).dw = undefined;
          (api.persisted as any).dh = undefined;
          api.applyPersisted();
        });
        ensureToolbar();
      }
    };

    attach();

    // Apply compact mode after initial attach so the panel declutters instantly.
    if (layout.compact) applyCompactMode();

    // Wire preset buttons after first attach (needs cardAPI)
    if (bar && bar.dataset.presetBound !== "1") {
      const getSelectedPreset = () => {
        const sel = bar.querySelector<HTMLSelectElement>('select[data-act="presetSelect"]');
        const v = sel?.value || "";
        return v.trim();
      };

      bar.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        const act = t.getAttribute("data-act");
        if (!act) return;

        if (act === "savePreset") {
          const name = window.prompt("Preset name?", `${panelId} layout`);
          if (!name) return;
          const store = getPresetsStore();
          const layoutDump: Record<string, Persisted> = {};
          cardAPI.forEach((_api, sk) => {
            const persisted = (loadJSON<Persisted>(sk, {}) || {}) as Persisted;
            layoutDump[sk] = persisted;
          });
          store.presets[name] = layoutDump;
          saveJSON(presetsKey, store);

          // Also capture a template layout by card order for cloning/sets.
          try {
            const cards = Array.from(root.querySelectorAll<HTMLElement>(".card")).filter(
              (c) => !c.closest(".rail") && !c.closest(".activityRail")
            );
            const used = new Set<string>();
            const template: Persisted[] = cards.map((card, idx) => {
              // Ensure stable id for layout keys (prevents drift when card order changes)
              deriveStableCardId(panelId, card, idx, used);
              const storageKey = `oddengine:godcard:${keyFor(panelId, card, idx)}`;
              return ((loadJSON<Persisted>(storageKey, {}) || {}) as Persisted) || {};
            });
            saveJSON(templateKey, template);
          } catch (err) {
            console.warn("template save failed", err);
          }
          ensureToolbar();
        }

        if (act === "applyPreset") {
          const name = getSelectedPreset();
          if (!name) return;
          const store = getPresetsStore();
          const preset = store.presets?.[name];
          if (!preset) return;
          Object.entries(preset).forEach(([sk, p]) => {
            saveJSON(sk, p);
          });
          cardAPI.forEach((api, sk) => {
            const next = (loadJSON<Persisted>(sk, {}) || {}) as Persisted;
            Object.assign(api.persisted, next);
            api.applyPersisted();
          });
        }
      });

      bar.dataset.presetBound = "1";
    }
    const mo = new MutationObserver(() => attach());
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
    };
  }, [panelId]);

  return null;
}
