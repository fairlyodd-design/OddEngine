import React from "react";

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  compact?: boolean;
  badge?: string;
};

export default function PanelChrome({ title, subtitle, right, compact = false, badge }: Props) {
  return (
    <div className={`panelChrome ${compact ? "panelChromeCompact" : ""}`}>
      <div className="panelChromeLead" aria-hidden="true">
        <span className="panelChromeDot panelChromeDotClose" />
        <span className="panelChromeDot panelChromeDotMove" />
        <span className="panelChromeDot panelChromeDotPin" />
      </div>
      <div className="panelChromeTitleWrap">
        <div className="panelChromeTitleRow">
          <div className="panelChromeTitle">{title}</div>
          {badge ? <span className="panelChromePill">{badge}</span> : null}
        </div>
        {subtitle ? <div className="panelChromeSubtitle">{subtitle}</div> : null}
      </div>
      <div className="panelChromeActions">
        <span className="panelChromeHint">control bar</span>
        {right}
      </div>
    </div>
  );
}
