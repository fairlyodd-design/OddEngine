import React, { useEffect, useMemo, useRef, useState } from "react";
import { clampFreeformPaneRect, loadFreeformPaneRect, saveFreeformPaneRect, type FreeformPaneRect } from "../lib/layoutMemory";

type Props = {
  paneId: string;
  title: string;
  defaultRect: FreeformPaneRect;
  minWidth?: number;
  minHeight?: number;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
};

type DragState =
  | { kind: "move"; startX: number; startY: number; origin: FreeformPaneRect }
  | { kind: "resize"; edge: "e" | "s" | "se"; startX: number; startY: number; origin: FreeformPaneRect }
  | null;

let zCounter = 40;

export default function FreeformPane({ paneId, title, defaultRect, minWidth = 240, minHeight = 180, className = "", contentClassName = "", children }: Props) {
  const initial = useMemo(() => loadFreeformPaneRect(paneId, defaultRect), [paneId, defaultRect.x, defaultRect.y, defaultRect.w, defaultRect.h]);
  const [rect, setRect] = useState<FreeformPaneRect>(initial);
  const [zIndex, setZIndex] = useState<number>(Math.max(10, initial.z || 10));
  const dragRef = useRef<DragState>(null);

  useEffect(() => {
    setRect(loadFreeformPaneRect(paneId, defaultRect));
  }, [paneId, defaultRect.x, defaultRect.y, defaultRect.w, defaultRect.h]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      setRect((current) => clampFreeformPaneRect({ ...current, z: zIndex }, { ...defaultRect, minWidth, minHeight }));
    };
    onResize();
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => onResize())
      : null;
    resizeObserver?.observe(document.documentElement);
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [defaultRect, minHeight, minWidth, zIndex]);

  const persist = (next: FreeformPaneRect, nextZ = zIndex) => {
    const clamped = clampFreeformPaneRect({ ...next, z: nextZ }, { ...defaultRect, minWidth, minHeight });
    setRect(clamped);
    setZIndex(nextZ);
    saveFreeformPaneRect(paneId, clamped);
  };

  const bringToFront = () => {
    zCounter += 1;
    const nextZ = zCounter;
    setZIndex(nextZ);
    saveFreeformPaneRect(paneId, { ...rect, z: nextZ });
    return nextZ;
  };

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const active = dragRef.current;
      if (!active) return;
      event.preventDefault();
      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;
      if (active.kind === "move") {
        setRect(clampFreeformPaneRect({ ...active.origin, x: active.origin.x + dx, y: active.origin.y + dy, z: zIndex }, { ...defaultRect, minWidth, minHeight }));
        return;
      }
      if (active.edge === "e") {
        setRect(clampFreeformPaneRect({ ...active.origin, w: active.origin.w + dx, z: zIndex }, { ...defaultRect, minWidth, minHeight }));
      } else if (active.edge === "s") {
        setRect(clampFreeformPaneRect({ ...active.origin, h: active.origin.h + dy, z: zIndex }, { ...defaultRect, minWidth, minHeight }));
      } else {
        setRect(clampFreeformPaneRect({ ...active.origin, w: active.origin.w + dx, h: active.origin.h + dy, z: zIndex }, { ...defaultRect, minWidth, minHeight }));
      }
    };
    const handleUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      saveFreeformPaneRect(paneId, { ...rect, z: zIndex });
      document.body.classList.remove("freeformDragging");
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [defaultRect, minHeight, minWidth, paneId, rect, zIndex]);

  const startMove = (event: React.PointerEvent) => {
    const nextZ = bringToFront();
    dragRef.current = { kind: "move", startX: event.clientX, startY: event.clientY, origin: { ...rect, z: nextZ } };
    document.body.classList.add("freeformDragging");
  };

  const startResize = (edge: "e" | "s" | "se") => (event: React.PointerEvent) => {
    event.stopPropagation();
    const nextZ = bringToFront();
    dragRef.current = { kind: "resize", edge, startX: event.clientX, startY: event.clientY, origin: { ...rect, z: nextZ } };
    document.body.classList.add("freeformDragging");
  };

  return (
    <div
      className={`freeformPane ${className}`.trim()}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex }}
      onPointerDown={() => bringToFront()}
    >
      <div className="freeformPaneHeader" onPointerDown={startMove}>
        <div className="freeformPaneGrip">⋮⋮</div>
        <div className="freeformPaneTitle">{title}</div>
        <button className="freeformPaneReset" onClick={(e) => { e.stopPropagation(); persist(defaultRect, bringToFront()); }}>Reset</button>
      </div>
      <div className={`freeformPaneContent ${contentClassName}`.trim()}>{children}</div>
      <div className="freeformResizeHandle freeformResizeHandleE" onPointerDown={startResize("e")} />
      <div className="freeformResizeHandle freeformResizeHandleS" onPointerDown={startResize("s")} />
      <div className="freeformResizeHandle freeformResizeHandleSE" onPointerDown={startResize("se")} />
    </div>
  );
}
