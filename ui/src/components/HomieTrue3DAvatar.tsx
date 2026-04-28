import React, { useEffect, useRef, useState } from "react";
import "./homieTrue3DStageHardReplace.css";

type HomieTrue3DMood = "idle" | "listening" | "thinking" | "speaking" | "caring" | "legacy";

type HomieTrue3DAvatarProps = {
  size?: "main" | "buddy";
  mood?: HomieTrue3DMood | string;
  className?: string;
};

type Point3 = { x: number; y: number; z: number };

const clampMood = (mood?: string): HomieTrue3DMood => {
  if (mood === "listening" || mood === "thinking" || mood === "speaking" || mood === "caring" || mood === "legacy") return mood;
  return "idle";
};

function project(p: Point3, yaw: number, scale: number, cx: number, cy: number) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const x = p.x * cos - p.z * sin;
  const z = p.x * sin + p.z * cos;
  const perspective = 680 / (680 + z);
  return { x: cx + x * scale * perspective, y: cy + p.y * scale * perspective, s: scale * perspective, z };
}

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

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, stroke?: string, lineWidth = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function capsule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string | CanvasGradient, stroke?: string) {
  roundedRect(ctx, x, y, w, h, Math.min(w, h) / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawAvatar(ctx: CanvasRenderingContext2D, width: number, height: number, yaw: number, breathe: number, mood: HomieTrue3DMood) {
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height * 0.53;
  const scale = Math.min(width, height) / 440;
  const lift = Math.sin(breathe) * 4 * scale;
  const p = (x: number, y: number, z = 0) => project({ x, y, z }, yaw, scale, cx, cy + lift);

  const glow = ctx.createRadialGradient(cx, cy - 95 * scale, 20 * scale, cx, cy, 240 * scale);
  glow.addColorStop(0, mood === "legacy" ? "rgba(255,224,139,.28)" : "rgba(154,230,255,.24)");
  glow.addColorStop(0.55, "rgba(154,230,255,.08)");
  glow.addColorStop(1, "rgba(154,230,255,0)");
  ellipse(ctx, cx, cy, 235 * scale, 260 * scale, glow);

  ellipse(ctx, cx, cy + 210 * scale, 88 * scale, 18 * scale, "rgba(0,0,0,.48)");

  const legLeft = p(-35, 65, 0);
  const legRight = p(35, 65, 0);
  capsule(ctx, legLeft.x - 22 * scale, legLeft.y, 42 * scale, 138 * scale, "#20509b", "rgba(130,190,255,.20)");
  capsule(ctx, legRight.x - 22 * scale, legRight.y, 42 * scale, 138 * scale, "#1d478b", "rgba(130,190,255,.20)");
  ctx.strokeStyle = "rgba(5,20,55,.55)";
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 75 * scale);
  ctx.lineTo(cx, cy + 198 * scale);
  ctx.stroke();

  const shoeL = p(-42, 202, 10);
  const shoeR = p(42, 202, 10);
  capsule(ctx, shoeL.x - 34 * scale, shoeL.y, 68 * scale, 22 * scale, "#151a2a", "rgba(190,220,255,.24)");
  capsule(ctx, shoeR.x - 34 * scale, shoeR.y, 68 * scale, 22 * scale, "#151a2a", "rgba(190,220,255,.24)");

  const side = Math.sin(yaw);
  const armLX = -118 - side * 8;
  const armRX = 118 - side * 8;
  const armL = p(armLX, -8, -6);
  const armR = p(armRX, -8, -6);
  capsule(ctx, armL.x - 21 * scale, armL.y, 42 * scale, 116 * scale, "#354156", "rgba(150,180,210,.18)");
  capsule(ctx, armR.x - 21 * scale, armR.y, 42 * scale, 116 * scale, "#354156", "rgba(150,180,210,.18)");
  ellipse(ctx, p(armLX, 105, 2).x, p(armLX, 105, 2).y, 22 * scale, 24 * scale, "#df9164");
  ellipse(ctx, p(armRX, 105, 2).x, p(armRX, 105, 2).y, 22 * scale, 24 * scale, "#df9164");

  const body = p(0, -25, 0);
  roundedRect(ctx, body.x - 86 * scale, body.y - 42 * scale, 172 * scale, 150 * scale, 50 * scale);
  const hoodieGrad = ctx.createLinearGradient(body.x, body.y - 45 * scale, body.x, body.y + 110 * scale);
  hoodieGrad.addColorStop(0, "#4b566b");
  hoodieGrad.addColorStop(1, "#263145");
  ctx.fillStyle = hoodieGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(180,210,240,.18)";
  ctx.lineWidth = 2 * scale;
  ctx.stroke();

  roundedRect(ctx, body.x - 58 * scale, body.y + 40 * scale, 116 * scale, 45 * scale, 22 * scale);
  ctx.fillStyle = "rgba(20,29,45,.72)";
  ctx.fill();

  ctx.strokeStyle = "rgba(220,225,235,.72)";
  ctx.lineWidth = 2.2 * scale;
  ctx.beginPath();
  ctx.moveTo(body.x - 20 * scale, body.y - 30 * scale);
  ctx.lineTo(body.x - 30 * scale, body.y + 18 * scale);
  ctx.moveTo(body.x + 20 * scale, body.y - 30 * scale);
  ctx.lineTo(body.x + 30 * scale, body.y + 18 * scale);
  ctx.stroke();

  const coreColor = mood === "legacy" ? "#ffe08b" : mood === "listening" ? "#78f5ff" : mood === "speaking" ? "#ff9bd8" : "#ffcc4a";
  ellipse(ctx, body.x, body.y + 15 * scale, 20 * scale, 20 * scale, coreColor, "rgba(255,255,255,.38)", 2 * scale);

  const hood = p(0, -128, -4);
  ellipse(ctx, hood.x, hood.y, 106 * scale, 104 * scale, "#364055", "rgba(170,200,230,.20)", 2 * scale);
  ellipse(ctx, hood.x, hood.y + 8 * scale, 78 * scale, 80 * scale, "#252f42");

  const neck = p(0, -78, 5);
  roundedRect(ctx, neck.x - 20 * scale, neck.y - 5 * scale, 40 * scale, 54 * scale, 16 * scale);
  ctx.fillStyle = "#d8865d";
  ctx.fill();

  const head = p(0, -146, 18);
  const headGrad = ctx.createRadialGradient(head.x - 24 * scale, head.y - 38 * scale, 10 * scale, head.x, head.y, 78 * scale);
  headGrad.addColorStop(0, "#ffd7bb");
  headGrad.addColorStop(0.48, "#df9468");
  headGrad.addColorStop(1, "#b86a49");
  ellipse(ctx, head.x, head.y, 66 * scale, 72 * scale, headGrad);
  ellipse(ctx, head.x - 67 * scale, head.y + 4 * scale, 14 * scale, 22 * scale, "#d8865d");
  ellipse(ctx, head.x + 67 * scale, head.y + 4 * scale, 14 * scale, 22 * scale, "#d8865d");

  ctx.beginPath();
  ctx.moveTo(head.x - 50 * scale, head.y + 32 * scale);
  ctx.quadraticCurveTo(head.x, head.y + 115 * scale, head.x + 50 * scale, head.y + 32 * scale);
  ctx.lineTo(head.x + 44 * scale, head.y + 76 * scale);
  ctx.quadraticCurveTo(head.x, head.y + 120 * scale, head.x - 44 * scale, head.y + 76 * scale);
  ctx.closePath();
  ctx.fillStyle = "#5b3020";
  ctx.fill();

  roundedRect(ctx, head.x - 76 * scale, head.y - 80 * scale, 152 * scale, 55 * scale, 32 * scale);
  const capGrad = ctx.createLinearGradient(head.x, head.y - 84 * scale, head.x, head.y - 28 * scale);
  capGrad.addColorStop(0, "#ffffff");
  capGrad.addColorStop(1, "#dce2ec");
  ctx.fillStyle = capGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(120,130,150,.25)";
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  ctx.strokeStyle = "rgba(40,42,46,.88)";
  ctx.lineWidth = 3 * scale;
  roundedRect(ctx, head.x - 55 * scale, head.y - 22 * scale, 46 * scale, 34 * scale, 14 * scale);
  ctx.stroke();
  roundedRect(ctx, head.x + 9 * scale, head.y - 22 * scale, 46 * scale, 34 * scale, 14 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(head.x - 9 * scale, head.y - 5 * scale);
  ctx.lineTo(head.x + 9 * scale, head.y - 5 * scale);
  ctx.stroke();

  ellipse(ctx, head.x - 31 * scale, head.y - 5 * scale, 6 * scale, 8 * scale, "#1f1715");
  ellipse(ctx, head.x + 31 * scale, head.y - 5 * scale, 6 * scale, 8 * scale, "#1f1715");
  ellipse(ctx, head.x - 29 * scale, head.y - 7 * scale, 2 * scale, 2 * scale, "rgba(255,255,255,.9)");
  ellipse(ctx, head.x + 33 * scale, head.y - 7 * scale, 2 * scale, 2 * scale, "rgba(255,255,255,.9)");

  ctx.strokeStyle = "rgba(70,42,25,.74)";
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(head.x - 52 * scale, head.y - 34 * scale);
  ctx.quadraticCurveTo(head.x - 30 * scale, head.y - 42 * scale, head.x - 10 * scale, head.y - 33 * scale);
  ctx.moveTo(head.x + 10 * scale, head.y - 33 * scale);
  ctx.quadraticCurveTo(head.x + 30 * scale, head.y - 42 * scale, head.x + 52 * scale, head.y - 34 * scale);
  ctx.stroke();

  ellipse(ctx, head.x, head.y + 14 * scale, 10 * scale, 14 * scale, "rgba(175,90,58,.45)");
  roundedRect(ctx, head.x - 34 * scale, head.y + 30 * scale, 68 * scale, mood === "speaking" ? 36 * scale : 28 * scale, 14 * scale);
  ctx.fillStyle = "#24100c";
  ctx.fill();
  roundedRect(ctx, head.x - 25 * scale, head.y + 32 * scale, 50 * scale, 10 * scale, 5 * scale);
  ctx.fillStyle = "#fff";
  ctx.fill();
}

export function HomieTrue3DAvatar({ size = "main", mood = "idle", className = "" }: HomieTrue3DAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef({ active: false, x: 0, yaw: 0 });
  const [yawOffset, setYawOffset] = useState(0);
  const safeMood = clampMood(String(mood || "idle"));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

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
      const idleYaw = Math.sin(t * 0.38) * 0.16;
      drawAvatar(ctx, canvas.clientWidth, canvas.clientHeight, idleYaw + yawOffset, t * 2.1, safeMood);
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [yawOffset, safeMood]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { active: true, x: event.clientX, yaw: yawOffset };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.x;
    setYawOffset(dragRef.current.yaw + dx * 0.01);
  };

  const stopDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.active = false;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
  };

  return (
    <div
      className={`homie3DHardMount homie3DHardMount--${size} mood-${safeMood} ${className}`.trim()}
      data-homie-true-3d="v10.38.22c"
      data-homie-avatar-source="procedural-canvas-only"
    >
      <canvas
        ref={canvasRef}
        className="homie3DHardCanvas"
        aria-label="Homie procedural 3D avatar canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      />
      <div className="homie3DHardHint">drag to turn</div>
    </div>
  );
}

export default HomieTrue3DAvatar;
