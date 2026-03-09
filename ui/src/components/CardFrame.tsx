import React, { useEffect, useMemo, useRef, useState } from "react";
import ActionMenu from "./ActionMenu";

type Props = {
  title: string;
  subtitle?: string;
  /** Optional stable key used to generate a stable DOM id (helps FairlyGOD persistence). */
  storageKey?: string;
  /** Back-compat: previously CardFrame managed its own collapsed state. Now FairlyGOD handles it. */
  defaultCollapsed?: boolean;
  /** Back-compat: previously CardFrame managed its own in-panel floating. Now FairlyGOD handles it. */
  defaultFloating?: boolean;
  children: React.ReactNode;
  className?: string;
};

function safeId(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function CardFrame({ title, subtitle, storageKey, children, className }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  const domId = useMemo(() => {
    const s = storageKey ? safeId(storageKey) : "";
    return s ? `card-${s}` : undefined;
  }, [storageKey]);

  const [flags, setFlags] = useState<{ collapsed: boolean; floating: boolean; pinned: boolean }>({
    collapsed: false,
    floating: false,
    pinned: false,
  });

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const update = () => {
      setFlags({
        collapsed: el.classList.contains("godCollapsed"),
        floating: el.classList.contains("godFloating"),
        pinned: el.classList.contains("godPinned"),
      });
    };

    update();
    const mo = new MutationObserver(() => update());
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  const triggerGod = (act: "shrink" | "move" | "pin") => {
    const el = cardRef.current;
    const btn = el?.querySelector(`.godCardControls button[data-act="${act}"]`) as HTMLButtonElement | null;
    if (btn) {
      btn.click();
      return;
    }
    // Controls may not be attached yet; fail silently.
  };

  const menuItems = useMemo(
    () => [
      {
        label: flags.collapsed ? "Expand" : "Shrink",
        onClick: () => triggerGod("shrink"),
      },
      {
        label: flags.floating ? "Dock" : "Move",
        onClick: () => triggerGod("move"),
      },
      {
        label: flags.pinned ? "Unpin" : "Pin",
        onClick: () => triggerGod("pin"),
      },
    ],
    [flags.collapsed, flags.floating, flags.pinned]
  );

  return (
    <div
      ref={cardRef}
      id={domId}
      className={`card ${className || ""}`}
      data-title={title}
    >
      <div className="widgetHeader">
        <div className="widgetHeaderLeft">
          <div className="widgetTitle">{title}</div>
          {subtitle ? <div className="widgetSubtitle">{subtitle}</div> : null}
        </div>
        <div className="widgetHeaderRight">
          <ActionMenu label="⋯" title="Widget actions" items={menuItems} />
        </div>
      </div>

      <div className="widgetBody">{children}</div>
    </div>
  );
}
