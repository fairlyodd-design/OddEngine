import React, { useEffect, useMemo, useRef, useState } from "react";

export type ActionMenuItem = {
  id?: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
};

export default function ActionMenu({
  label = "⋯",
  title = "More",
  items,
}: {
  label?: string;
  title?: string;
  items: ActionMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const cleaned = useMemo(() => (items || []).filter(Boolean), [items]);

  useEffect(() => {
    const onDown = (e: any) => {
      if (!open) return;
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e: any) => {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="actionMenuWrap">
      <button className="tabBtn" title={title} onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      {open ? (
        <div className="actionMenu">
          {cleaned.map((it, idx) => (
            <button
              key={it.id || `${idx}-${it.label}`}
              className={`actionMenuItem ${it.tone === "danger" ? "danger" : ""}`}
              disabled={!!it.disabled}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
