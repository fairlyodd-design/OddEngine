import React, { useMemo, useState } from "react";

type SortableItem = { id: string };

type Props<T extends SortableItem> = {
  id: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
};

export default function SortableWidgetZone<T extends SortableItem>({ id, items, renderItem }: Props<T>) {
  const baseOrder = useMemo(() => items.map((item) => item.id), [items]);
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(id);
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : baseOrder;
    } catch {
      return baseOrder;
    }
  });
  const [dragging, setDragging] = useState<string | null>(null);

  const normalizedOrder = order.filter((itemId) => items.some((item) => item.id === itemId));
  const finalOrder = [...normalizedOrder, ...baseOrder.filter((itemId) => !normalizedOrder.includes(itemId))];

  function saveOrder(next: string[]) {
    setOrder(next);
    try {
      localStorage.setItem(id, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, itemId: string) {
    setDragging(itemId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemId);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault();
    const sourceId = dragging || e.dataTransfer.getData("text/plain") || null;
    if (!sourceId || sourceId === targetId) return;

    const next = [...finalOrder];
    const from = next.indexOf(sourceId);
    const to = next.indexOf(targetId);
    if (from < 0 || to < 0) return;

    next.splice(from, 1);
    next.splice(to, 0, sourceId);
    saveOrder(next);
    setDragging(null);
  }

  return (
    <div className="sortable-zone">
      {finalOrder.map((itemId) => {
        const item = items.find((entry) => entry.id === itemId);
        if (!item) return null;
        return (
          <div
            key={item.id}
            className="sortable-item"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, item.id)}
          >
            <div className="drag-handle" draggable onDragStart={(e) => handleDragStart(e, item.id)}>
              ≡
            </div>
            {renderItem(item)}
          </div>
        );
      })}
    </div>
  );
}
