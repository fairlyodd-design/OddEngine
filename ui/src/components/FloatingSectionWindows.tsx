
import React, { useMemo, useRef, useState } from "react";
import type { FloatingSection, FloatingSectionId } from "../lib/sectionWorkspace";
import { renderNativeSection } from "../lib/nativeSectionRegistry";
import { clampToViewport, snapToScreenEdge } from "../lib/multiScreenWorkspace";

type Props = {
  sections: FloatingSection[];
  onChange: (id: FloatingSectionId, patch: Partial<FloatingSection>) => void;
  onBringToFront: (id: FloatingSectionId) => void;
  onClose: (id: FloatingSectionId) => void;
};

export default function FloatingSectionWindows({ sections, onChange, onBringToFront, onClose }: Props) {
  const dragRef = useRef<{ id: FloatingSectionId | null; dx: number; dy: number }>({ id: null, dx: 0, dy: 0 });
  const resizeRef = useRef<{ id: FloatingSectionId | null; startX: number; startY: number; width: number; height: number }>({ id: null, startX: 0, startY: 0, width: 0, height: 0 });
  const [, force] = useState(0);
  const visibleSections = useMemo(() => sections.filter((s) => s.visible).sort((a, b) => a.z - b.z), [sections]);

  const stopAll = () => {
    dragRef.current = { id: null, dx: 0, dy: 0 };
    resizeRef.current = { id: null, startX: 0, startY: 0, width: 0, height: 0 };
  };

  return (
    <div
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      onPointerMove={(e) => {
        if (dragRef.current.id) {
          const moved = snapToScreenEdge(e.clientX - dragRef.current.dx, e.clientY - dragRef.current.dy, (sections.find(s => s.id === dragRef.current.id)?.width || 320), (sections.find(s => s.id === dragRef.current.id)?.height || 220));
              const clamped = clampToViewport(moved.x, moved.y, (sections.find(s => s.id === dragRef.current.id)?.width || 320), (sections.find(s => s.id === dragRef.current.id)?.height || 220));
              onChange(dragRef.current.id, { x: clamped.x, y: clamped.y });
          force((n) => n + 1);
        }
        if (resizeRef.current.id) {
          onChange(resizeRef.current.id, {
            width: Math.max(260, resizeRef.current.width + (e.clientX - resizeRef.current.startX)),
            height: Math.max(180, resizeRef.current.height + (e.clientY - resizeRef.current.startY)),
          });
          force((n) => n + 1);
        }
      }}
      onPointerUp={stopAll}
      onPointerLeave={stopAll}
    >
      {visibleSections.map((section) => (
        <div
          key={section.id}
          onMouseDown={() => onBringToFront(section.id)}
          style={{
            position: "absolute",
            left: section.x,
            top: section.y,
            width: section.width,
            height: section.height,
            zIndex: section.z + 30,
            pointerEvents: "auto",
            border: "1px solid rgba(120,180,255,.35)",
            borderRadius: 16,
            background: "linear-gradient(180deg, rgba(15,20,33,.92), rgba(7,11,22,.94))",
            boxShadow: "0 16px 48px rgba(0,0,0,.34)",
            overflow: "hidden"
          }}
        >
          <div
            style={{ height: 38, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", cursor: "move", background: "rgba(20,28,48,.88)" }}
            onPointerDown={(e) => {
              dragRef.current = { id: section.id, dx: e.clientX - section.x, dy: e.clientY - section.y };
              onBringToFront(section.id);
            }}
          >
            <div style={{ color: "#f2f7ff", fontSize: 13, fontWeight: 700 }}>{section.title}</div>
            <button onClick={() => onClose(section.id)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.18)", color: "#d7e8ff", borderRadius: 8, padding: "3px 8px", cursor: "pointer" }}>Close</button>
          </div>
          <div style={{ position: "absolute", inset: "39px 0 0 0", overflow: "auto", padding: 12, color: "#d8ecff", fontSize: 14 }}>
            {renderNativeSection(section.id as any)}
          </div>
          <div
            style={{ position: "absolute", right: 0, bottom: 0, width: 14, height: 14, cursor: "nwse-resize", background: "linear-gradient(135deg, transparent 35%, rgba(120,180,255,.8) 100%)" }}
            onPointerDown={(e) => {
              resizeRef.current = { id: section.id, startX: e.clientX, startY: e.clientY, width: section.width, height: section.height };
              onBringToFront(section.id);
            }}
          />
        </div>
      ))}
    </div>
  );
}
