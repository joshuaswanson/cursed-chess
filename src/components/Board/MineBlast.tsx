import { useEffect, useRef } from "react";

/** Squares of room around the mine for the blast to spread into */
const SPAN = 7;
const DURATION = 1.7;

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  spin: number;
  angle: number;
  kind: "fire" | "spark" | "debris" | "smoke";
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function burst(sq: number): Bit[] {
  const bits: Bit[] = [];
  const out = (speed: [number, number]) => {
    const a = Math.random() * Math.PI * 2;
    const v = rand(...speed) * sq;
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v };
  };
  for (let i = 0; i < 34; i++) {
    bits.push({
      x: 0,
      y: 0,
      ...out([1.5, 5]),
      r: rand(0.12, 0.3) * sq,
      life: rand(0.5, 0.9),
      spin: 0,
      angle: 0,
      kind: "fire",
    });
  }
  for (let i = 0; i < 46; i++) {
    bits.push({
      x: 0,
      y: 0,
      ...out([5, 11]),
      r: rand(0.02, 0.05) * sq,
      life: rand(0.4, 0.8),
      spin: 0,
      angle: 0,
      kind: "spark",
    });
  }
  for (let i = 0; i < 16; i++) {
    const v = out([3, 7]);
    bits.push({
      x: 0,
      y: 0,
      vx: v.vx,
      vy: v.vy - 3 * sq,
      r: rand(0.06, 0.13) * sq,
      life: rand(0.9, 1.4),
      spin: rand(-12, 12),
      angle: rand(0, 6),
      kind: "debris",
    });
  }
  for (let i = 0; i < 12; i++) {
    bits.push({
      x: rand(-0.3, 0.3) * sq,
      y: rand(-0.3, 0.3) * sq,
      vx: rand(-0.4, 0.4) * sq,
      vy: rand(-1.4, -0.6) * sq,
      r: rand(0.35, 0.6) * sq,
      life: rand(1.2, 1.7),
      spin: 0,
      angle: 0,
      kind: "smoke",
    });
  }
  return bits;
}

/** Fireball, sparks, flying dirt, a shockwave, and smoke from one mine */
export function MineBlast({
  col,
  row,
  squareSize,
}: {
  col: number;
  row: number;
  squareSize: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const size = SPAN * squareSize;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, (size / 2) * dpr, (size / 2) * dpr);

    const bits = burst(squareSize);
    const gravity = 9 * squareSize;
    let t = 0;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ctx.clearRect(-size / 2, -size / 2, size, size);

      // Shockwave ring
      if (t < 0.45) {
        const p = t / 0.45;
        ctx.strokeStyle = `rgba(255,244,224,${1 - p})`;
        ctx.lineWidth = squareSize * 0.12 * (1 - p) + 1;
        ctx.beginPath();
        ctx.arc(0, 0, p * squareSize * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Core flash
      if (t < 0.18) {
        const p = t / 0.18;
        const r = squareSize * (0.6 + p * 1.6);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, `rgba(255,255,240,${1 - p})`);
        g.addColorStop(1, "rgba(255,210,63,0)");
        ctx.fillStyle = g;
        ctx.fillRect(-r, -r, r * 2, r * 2);
      }

      for (const b of bits) {
        if (t > b.life) continue;
        const age = t / b.life;
        const drag =
          b.kind === "fire" ? 0.88 : b.kind === "smoke" ? 0.98 : 0.97;
        b.vx *= Math.pow(drag, dt * 60);
        b.vy *= Math.pow(drag, dt * 60);
        if (b.kind === "debris" || b.kind === "spark")
          b.vy += gravity * dt * (b.kind === "spark" ? 0.4 : 1);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.angle += b.spin * dt;

        ctx.save();
        if (b.kind === "fire") {
          ctx.globalCompositeOperation = "lighter";
          const r = b.r * (1 + age * 1.8);
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
          const heat = 1 - age;
          g.addColorStop(
            0,
            `rgba(255,${Math.round(180 + 70 * heat)},${Math.round(80 * heat)},${0.9 * heat})`,
          );
          g.addColorStop(
            0.5,
            `rgba(255,${Math.round(90 + 60 * heat)},20,${0.6 * heat})`,
          );
          g.addColorStop(1, "rgba(200,40,10,0)");
          ctx.fillStyle = g;
          ctx.fillRect(b.x - r, b.y - r, r * 2, r * 2);
        } else if (b.kind === "spark") {
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = `rgba(255,240,180,${1 - age})`;
          ctx.lineWidth = b.r;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
          ctx.stroke();
        } else if (b.kind === "debris") {
          ctx.translate(b.x, b.y);
          ctx.rotate(b.angle);
          ctx.fillStyle = `rgba(52,38,20,${1 - age * age})`;
          ctx.beginPath();
          ctx.moveTo(-b.r, -b.r * 0.6);
          ctx.lineTo(b.r * 0.8, -b.r);
          ctx.lineTo(b.r, b.r * 0.7);
          ctx.lineTo(-b.r * 0.6, b.r);
          ctx.closePath();
          ctx.fill();
        } else {
          const r = b.r * (1 + age * 1.5);
          const a =
            Math.sin((Math.min(1, age * 3) * Math.PI) / 2) * (1 - age) * 0.55;
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
          g.addColorStop(0, `rgba(70,64,58,${a})`);
          g.addColorStop(1, "rgba(70,64,58,0)");
          ctx.fillStyle = g;
          ctx.fillRect(b.x - r, b.y - r, r * 2, r * 2);
        }
        ctx.restore();
      }

      if (t < DURATION) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [squareSize]);

  return (
    <canvas
      ref={canvasRef}
      className="mine-blast"
      style={{
        left: `${(col + 0.5) * 12.5}%`,
        top: `${(row + 0.5) * 12.5}%`,
        width: SPAN * squareSize,
        height: SPAN * squareSize,
      }}
      aria-hidden
    />
  );
}
