import React, { useState } from 'react';

export default function SortableWidgetZone({ id, items, renderItem }) {
  const [order, setOrder] = useState(() => {
    const saved = localStorage.getItem(id);
    return saved ? JSON.parse(saved) : items.map((i) => i.id);
  });

  const [dragging, setDragging] = useState(null);

  const handleDragStart = (e, itemId) => {
    setDragging(itemId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragging || dragging === targetId) return;

    const newOrder = [...order];
    const from = newOrder.indexOf(dragging);
    const to = newOrder.indexOf(targetId);

    newOrder.splice(from, 1);
    newOrder.splice(to, 0, dragging);

    setOrder(newOrder);
    localStorage.setItem(id, JSON.stringify(newOrder));
    setDragging(null);
  };

  return (
    <div className="sortable-zone">
      {order.map((itemId) => {
        const item = items.find((i) => i.id === itemId);
        return (
          <div
            key={item.id}
            className="sortable-item"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, item.id)}
          >
            <div
              className="drag-handle"
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
            >
              ≡
            </div>
            {renderItem(item)}
          </div>
        );
      })}
    </div>
  );
}
