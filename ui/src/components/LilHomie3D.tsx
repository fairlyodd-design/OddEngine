import React from "react";

type Props = {
  hostRef: React.RefObject<HTMLElement>;
  energy?: number;
};

export default function LilHomie3D({ energy = 0.9 }: Props) {
  return (
    <div
      className="lilAgent3D"
      aria-hidden="true"
      style={{
        width: 120,
        height: 160,
        borderRadius: 18,
        border: "1px solid rgba(121,87,255,0.22)",
        background: "radial-gradient(circle at 50% 18%, rgba(255,209,102,0.16), rgba(255,255,255,0.03) 50%, rgba(0,0,0,0.1) 100%)",
        display: "grid",
        placeItems: "center",
        fontSize: 40,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        transform: `scale(${0.96 + Math.min(0.08, energy * 0.04)})`,
      }}
    >
      👊
    </div>
  );
}
