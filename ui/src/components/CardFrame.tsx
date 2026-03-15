import React, { useMemo, useRef } from "react";

type Props = {
  title: string;
  subtitle?: string;
  storageKey?: string;
  defaultCollapsed?: boolean;
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
      </div>

      <div className="widgetBody">{children}</div>
    </div>
  );
}
