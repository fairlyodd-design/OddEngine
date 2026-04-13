import React from "react";

export type HowTo = {
  title: string;
  icon?: string;
  sections?: { heading: string; bullets: string[] }[];
  bullets?: string[];
  hotkeys?: string[];
};

export default function HowToModal({
  open,
  onClose,
  howto,
  panel,
}: {
  open: boolean;
  onClose: () => void;
  howto?: HowTo | null;
  panel?: string;
}) {
  const safeHowTo = howto || (panel ? { title: `${panel} — How to Use`, bullets: ["This panel does not have a custom How-To entry yet."] } : null);

  if (!open || !safeHowTo) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalTitle">{safeHowTo.icon ? `${safeHowTo.icon} ` : ""}{safeHowTo.title}</div>
          <button className="modalClose" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modalBody">
          {Array.isArray(safeHowTo.sections) && safeHowTo.sections.length > 0 ? (
            safeHowTo.sections.map((section) => (
              <div key={section.heading} className="howtoSection">
                <div className="howtoHeading">{section.heading}</div>
                <ul className="howtoList">
                  {section.bullets.map((bullet, idx) => (
                    <li key={idx}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <div className="howtoSection">
              <div className="howtoHeading">Quick guide</div>
              <ul className="howtoList">
                {(safeHowTo.bullets || []).map((bullet, idx) => (
                  <li key={idx}>{bullet}</li>
                ))}
              </ul>
              {Array.isArray(safeHowTo.hotkeys) && safeHowTo.hotkeys.length > 0 && (
                <>
                  <div className="howtoHeading" style={{ marginTop: 16 }}>Hotkeys</div>
                  <ul className="howtoList">
                    {safeHowTo.hotkeys.map((hotkey, idx) => (
                      <li key={idx}>{hotkey}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className="modalFooter">
          <button className="modalPrimary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
