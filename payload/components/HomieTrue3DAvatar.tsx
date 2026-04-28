import React, { useEffect, useRef, useState } from "react";

type HomieTrue3DAvatarProps = {
  size?: "main" | "buddy";
  mood?: "idle" | "listening" | "thinking" | "speaking" | "caring" | "legacy";
  className?: string;
};

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke?: string, lineWidth = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawHomie(ctx: CanvasRenderingContext2D, w: number, h: number, yaw: number, t: number, mood: string) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h * 0.52;
  const s = Math.min(w, h) / 420;
  const breathe = Math.sin(t * 2) * 5 * s;
  const turn = Math.sin(yaw);

  const glow = ctx.createRadialGradient(cx, cy - 40*s, 20*s, cx, cy, 210*s);
  glow.addColorStop(0, "rgba(154,230,255,.24)");
  glow.addColorStop(.55, "rgba(154,230,255,.08)");
  glow.addColorStop(1, "rgba(154,230,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 220*s, 250*s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy + breathe);
  ctx.scale(s, s);

  ctx.globalAlpha = .42;
  ellipse(ctx, 0, 214, 92, 18, "rgba(0,0,0,.55)");
  ctx.globalAlpha = 1;

  // Legs and shoes
  roundedRect(ctx, -48, 78, 42, 140, 20); ctx.fillStyle = "#20509b"; ctx.fill();
  roundedRect(ctx, 8, 78, 42, 140, 20); ctx.fillStyle = "#1d478b"; ctx.fill();
  roundedRect(ctx, -70, 210, 70, 24, 14); ctx.fillStyle = "#151a2a"; ctx.fill();
  roundedRect(ctx, 0, 210, 70, 24, 14); ctx.fillStyle = "#151a2a"; ctx.fill();

  // Arms
  roundedRect(ctx, -132 - turn*7, -35, 45, 125, 23); ctx.fillStyle = "#354156"; ctx.fill();
  roundedRect(ctx, 87 - turn*7, -35, 45, 125, 23); ctx.fillStyle = "#354156"; ctx.fill();
  ellipse(ctx, -109 - turn*7, 98, 23, 25, "#df9164");
  ellipse(ctx, 109 - turn*7, 98, 23, 25, "#df9164");

  // Hoodie body
  const bodyGrad = ctx.createLinearGradient(0, -86, 0, 105);
  bodyGrad.addColorStop(0, "#4b566b");
  bodyGrad.addColorStop(1, "#263145");
  roundedRect(ctx, -90, -75, 180, 172, 58);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(180,210,240,.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pocket and drawstrings
  roundedRect(ctx, -60, 35, 120, 48, 24);
  ctx.fillStyle = "rgba(20,29,45,.74)";
  ctx.fill();
  ctx.strokeStyle = "rgba(220,225,235,.72)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-22, -58); ctx.lineTo(-34, 12);
  ctx.moveTo(22, -58); ctx.lineTo(34, 12);
  ctx.stroke();

  // Core
  const core = mood === "legacy" ? "#ffe08b" : mood === "listening" ? "#78f5ff" : "#ffcc4a";
  ellipse(ctx, 0, -4, 21, 21, core, "rgba(255,255,255,.38)", 2);

  // Hood behind head
  ellipse(ctx, 0, -142, 112, 106, "#364055", "rgba(170,200,230,.22)", 2);
  ellipse(ctx, 0, -132, 82, 80, "#252f42");

  // Neck
  roundedRect(ctx, -20, -98, 40, 62, 16);
  ctx.fillStyle = "#d8865d";
  ctx.fill();

  // Head
  const headGrad = ctx.createRadialGradient(-24, -198, 8, 0, -155, 82);
  headGrad.addColorStop(0, "#ffd7bb");
  headGrad.addColorStop(.50, "#df9468");
  headGrad.addColorStop(1, "#b86a49");
  ellipse(ctx, 0, -158, 68, 74, headGrad as unknown as string);
  ellipse(ctx, -68, -151, 15, 22, "#d8865d");
  ellipse(ctx, 68, -151, 15, 22, "#d8865d");

  // Beard
  ctx.beginPath();
  ctx.moveTo(-52, -123);
  ctx.quadraticCurveTo(0, -46, 52, -123);
  ctx.lineTo(46, -72);
  ctx.quadraticCurveTo(0, -36, -46, -72);
  ctx.closePath();
  ctx.fillStyle = "#5b3020";
  ctx.fill();

  // Cap
  roundedRect(ctx, -78, -240, 156, 56, 32);
  const capGrad = ctx.createLinearGradient(0, -242, 0, -184);
  capGrad.addColorStop(0, "#ffffff");
  capGrad.addColorStop(1, "#dce2ec");
  ctx.fillStyle = capGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(120,130,150,.25)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glasses
  ctx.strokeStyle = "rgba(40,42,46,.88)";
  ctx.lineWidth = 3;
  roundedRect(ctx, -56, -180, 46, 35, 14); ctx.stroke();
  roundedRect(ctx, 10, -180, 46, 35, 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10, -163); ctx.lineTo(10, -163); ctx.stroke();

  // Eyes, brows, nose, smile
  ellipse(ctx, -32, -162, 6, 8, "#1f1715");
  ellipse(ctx, 32, -162, 6, 8, "#1f1715");
  ellipse(ctx, -30, -165, 2, 2, "rgba(255,255,255,.9)");
  ellipse(ctx, 34, -165, 2, 2, "rgba(255,255,255,.9)");
  ctx.strokeStyle = "rgba(70,42,25,.74)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-52, -196); ctx.quadraticCurveTo(-30, -204, -10, -195);
  ctx.moveTo(10, -195); ctx.quadraticCurveTo(30, -204, 52, -196);
  ctx.stroke();
  ellipse(ctx, 0, -142, 10, 14, "rgba(175,90,58,.45)");
  roundedRect(ctx, -34, -124, 68, 29, 15);
  ctx.fillStyle = "#24100c";
  ctx.fill();
  roundedRect(ctx, -25, -122, 50, 10, 5);
  ctx.fillStyle = "#fff";
  ctx.fill();

  ctx.restore();
}

export function HomieTrue3DAvatar({ size = "main", mood = "idle", className = "" }: HomieTrue3DAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef({ active: false, x: 0, yaw: 0 });
  const [yawOffset, setYawOffset] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const start = performance.now();
    const render = (now: number) => {
      const t = (now - start) / 1000;
      drawHomie(ctx, canvas.clientWidth, canvas.clientHeight, yawOffset + Math.sin(t * .35) * .14, t, mood);
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [yawOffset, mood]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { active: true, x: event.clientX, yaw: yawOffset };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    setYawOffset(dragRef.current.yaw + (event.clientX - dragRef.current.x) * .01);
  };
  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.active = false;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
  };

  return (
    <div className={`homie3DAvatarMount homie3DAvatarMount--${size} ${className}`} data-homie-true-3d="forced-v10.38.22b">
      <canvas
        ref={canvasRef}
        className="homie3DAvatarCanvas"
        aria-label="Homie 3D avatar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="homie3DAvatarHint">drag to turn</div>
    </div>
  );
}

export default HomieTrue3DAvatar;
