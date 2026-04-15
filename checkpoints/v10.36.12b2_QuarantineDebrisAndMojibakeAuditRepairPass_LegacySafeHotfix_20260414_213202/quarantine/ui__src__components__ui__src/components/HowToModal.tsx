import React from "react";

type HowTo = {
  title: string;
  sections: { heading: string; bullets: string[] }[];
};

export default function HowToModal({
  open,
  onClose,
  howto,
}: {
  open: boolean;
  onClose: () => void;
  howto: HowTo | null;
}) {
  if (!open || !howto) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="modalCard" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalTitle">{howto.title}</div>
          <button className="modalClose" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modalBody">
          {howto.sections.map((s) => (
            <div key={s.heading} className="howtoSection">
              <div className="howtoHeading">{s.heading}</div>
              <ul className="howtoList">
                {s.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
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
