import { useEffect } from "react";
import { loadJSON, saveJSON } from "../lib/storage";

type ZoneConfig = { key: string; selector: string };

const PANEL_ZONES: Record<string, ZoneConfig[]> = {
  Books: [
    { key: "writers-left", selector: ".writersLeft" },
    { key: "writers-center", selector: ".writersCenter" },
    { key: "writers-right", selector: ".writersRight" },
  ],
  Home: [
    { key: "home-left", selector: ".homeLeft" },
    { key: "home-top", selector: ".homeTop" },
    { key: "home-best", selector: ".homeOpsRowTwo" },
    { key: "home-mission", selector: ".homeMissionRow" },
    { key: "home-live", selector: ".homeOpsRow" },
    { key: "home-bottom", selector: ".homeBottom" },
  ],
};

function slugify(input: string) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function getDirectCards(zone: HTMLElement) {
  return Array.from(zone.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains("card"));
}

function ensureCardId(panelId: string, zoneKey: string, card: HTMLElement, index: number) {
  const existing = card.dataset.internalWidgetId || card.id;
  if (existing) {
    card.dataset.internalWidgetId = existing;
    return existing;
  }
  const titleEl = card.querySelector<HTMLElement>(".widgetTitle, .h, h1, h2, h3, [data-title]");
  const raw = titleEl?.textContent || card.getAttribute("data-title") || `widget-${index + 1}`;
  const id = `${panelId}-${zoneKey}-${slugify(raw) || `widget-${index + 1}`}`;
  card.dataset.internalWidgetId = id;
  return id;
}

function applySavedOrder(zone: HTMLElement, saved: string[]) {
  const cards = getDirectCards(zone);
  const byId = new Map(cards.map((card) => [card.dataset.internalWidgetId || "", card]));
  const ordered: HTMLElement[] = [];
  saved.forEach((id) => {
    const card = byId.get(id);
    if (card) ordered.push(card);
  });
  cards.forEach((card) => {
    if (!ordered.includes(card)) ordered.push(card);
  });
  ordered.forEach((card) => zone.appendChild(card));
}

function injectHandle(card: HTMLElement) {
  if (card.querySelector(".internalWidgetHandle")) return;
  const btn = document.createElement("button");
  btn.className = "internalWidgetHandle";
  btn.type = "button";
  btn.draggable = true;
  btn.textContent = "↕ Move widget";
  btn.title = "Drag to reorder this widget";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  const widgetHeaderRight = card.querySelector<HTMLElement>(".widgetHeaderRight");
  if (widgetHeaderRight) {
    widgetHeaderRight.prepend(btn);
    return;
  }

  const row = document.createElement("div");
  row.className = "internalWidgetHandleRow";
  row.appendChild(btn);
  card.prepend(row);
}

export default function PanelInternalDrag({ panelId }: { panelId: string }) {
  useEffect(() => {
    const zones = PANEL_ZONES[panelId];
    if (!zones?.length) return;
    const root = document.querySelector(`.panelMain[data-panelid="${panelId}"]`) as HTMLElement | null;
    if (!root) return;

    const cleanup: Array<() => void> = [];
    const storageKey = `oddengine:internal-widget-layout:${panelId}:v10.25.4`;
    const saved = loadJSON<Record<string, string[]>>(storageKey, {});

    const persist = () => {
      const payload: Record<string, string[]> = {};
      zones.forEach(({ key, selector }) => {
        const zone = root.querySelector(selector) as HTMLElement | null;
        if (!zone) return;
        payload[key] = getDirectCards(zone).map((card, index) => ensureCardId(panelId, key, card, index));
      });
      saveJSON(storageKey, payload);
    };

    zones.forEach(({ key, selector }) => {
      const zone = root.querySelector(selector) as HTMLElement | null;
      if (!zone) return;
      zone.dataset.widgetZone = key;
      zone.classList.add("internalWidgetZone");

      const cards = getDirectCards(zone);
      cards.forEach((card, index) => {
        ensureCardId(panelId, key, card, index);
        card.setAttribute("data-no-drag", "true");
        card.setAttribute("data-no-snap", "true");
        card.classList.add("internalWidgetCard");
        injectHandle(card);
      });

      if (saved[key]?.length) applySavedOrder(zone, saved[key]);

      const onZoneDragOver = (e: DragEvent) => {
        if (e.dataTransfer?.types.includes("application/x-odd-internal-widget")) {
          e.preventDefault();
          zone.classList.add("widgetZoneActive");
        }
      };
      const onZoneDragLeave = () => zone.classList.remove("widgetZoneActive");
      const onZoneDrop = (e: DragEvent) => {
        const raw = e.dataTransfer?.getData("application/x-odd-internal-widget");
        zone.classList.remove("widgetZoneActive");
        if (!raw) return;
        e.preventDefault();
        try {
          const payload = JSON.parse(raw) as { cardId: string };
          const card = root.querySelector<HTMLElement>(`.internalWidgetCard[data-internal-widget-id="${payload.cardId}"]`);
          if (card && card.parentElement === zone && zone.lastElementChild === card) {
            persist();
            return;
          }
          if (card) zone.appendChild(card);
          persist();
        } catch {}
      };
      zone.addEventListener("dragover", onZoneDragOver);
      zone.addEventListener("dragleave", onZoneDragLeave);
      zone.addEventListener("drop", onZoneDrop);
      cleanup.push(() => {
        zone.removeEventListener("dragover", onZoneDragOver);
        zone.removeEventListener("dragleave", onZoneDragLeave);
        zone.removeEventListener("drop", onZoneDrop);
      });

      getDirectCards(zone).forEach((card) => {
        const handle = card.querySelector<HTMLElement>(".internalWidgetHandle");
        if (!handle) return;
        const onDragStart = (e: DragEvent) => {
          const cardId = card.dataset.internalWidgetId;
          if (!cardId || !e.dataTransfer) return;
          e.stopPropagation();
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("application/x-odd-internal-widget", JSON.stringify({ cardId }));
          window.requestAnimationFrame(() => card.classList.add("internalWidgetDragging"));
        };
        const onDragEnd = () => {
          card.classList.remove("internalWidgetDragging");
          root.querySelectorAll(".widgetZoneActive").forEach((el) => el.classList.remove("widgetZoneActive"));
          persist();
        };
        const onCardDragOver = (e: DragEvent) => {
          if (!e.dataTransfer?.types.includes("application/x-odd-internal-widget")) return;
          e.preventDefault();
        };
        const onCardDrop = (e: DragEvent) => {
          const raw = e.dataTransfer?.getData("application/x-odd-internal-widget");
          if (!raw) return;
          e.preventDefault();
          e.stopPropagation();
          try {
            const payload = JSON.parse(raw) as { cardId: string };
            const dragging = root.querySelector<HTMLElement>(`.internalWidgetCard[data-internal-widget-id="${payload.cardId}"]`);
            if (!dragging || dragging === card) return;
            const rect = card.getBoundingClientRect();
            const before = (e.clientY - rect.top) < rect.height / 2;
            const parent = card.parentElement;
            if (!parent) return;
            if (before) parent.insertBefore(dragging, card);
            else parent.insertBefore(dragging, card.nextSibling);
            persist();
          } catch {}
        };
        handle.addEventListener("dragstart", onDragStart);
        handle.addEventListener("dragend", onDragEnd);
        card.addEventListener("dragover", onCardDragOver);
        card.addEventListener("drop", onCardDrop);
        cleanup.push(() => {
          handle.removeEventListener("dragstart", onDragStart);
          handle.removeEventListener("dragend", onDragEnd);
          card.removeEventListener("dragover", onCardDragOver);
          card.removeEventListener("drop", onCardDrop);
        });
      });
    });

    persist();
    return () => cleanup.forEach((fn) => fn());
  }, [panelId]);

  return null;
}
