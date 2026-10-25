"use client";

import { useEffect, useRef } from "react";

// Dense, OS-map-style contour lines drawn behind the page.
// A smooth terrain (hills, spurs and a valley) is sampled on a grid and traced with marching squares.
// Every 5th contour is an index contour: bolder, in Copper. The rest are thin Slate lines.

const HILLS = [
  { x: 0.28, y: 0.22, r: 0.28, h: 1.0 },
  { x: 0.42, y: 0.42, r: 0.18, h: 0.55 }, // spur running off the main hill
  { x: 0.78, y: 0.7, r: 0.3, h: 0.85 },
  { x: 0.95, y: 0.15, r: 0.22, h: 0.6 },
  { x: 0.1, y: 0.85, r: 0.25, h: 0.5 },
  { x: 0.62, y: 0.5, r: 0.12, h: -0.55 }, // valley
];

function height(x: number, y: number) {
  let h = 0;
  for (const k of HILLS) {
    const dx = x - k.x;
    const dy = y - k.y;
    h += k.h * Math.exp(-(dx * dx + dy * dy) / (2 * k.r * k.r));
  }
  // broad slope + gentle undulation
  h += 0.35 * (1 - y) + 0.06 * Math.sin(x * 7.1 + y * 3.3) + 0.05 * Math.cos(y * 8.3 - x * 2.2);
  // fine roughness so lines wobble like surveyed contours
  h += 0.006 * Math.sin(x * 97 + y * 61) + 0.005 * Math.cos(x * 143 - y * 119) + 0.003 * Math.sin(x * 251 + y * 233);
  return h;
}

export function ContourBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth;
      const H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const step = 5;
      const cols = Math.ceil(W / step) + 1;
      const rows = Math.ceil(H / step) + 1;
      const S = Math.max(W, H);
      const field = new Float32Array(cols * rows);
      let min = Infinity;
      let max = -Infinity;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const v = height((i * step) / S, (j * step) / S);
          field[j * cols + i] = v;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }

      const LEVELS = 60; // dense, like the reference map
      const at = (i: number, j: number) => field[j * cols + i];
      for (let n = 1; n < LEVELS; n++) {
        const t = min + ((max - min) * n) / LEVELS;
        const index = n % 5 === 0;
        ctx.beginPath();
        ctx.lineWidth = index ? 1.1 : 0.6;
        ctx.strokeStyle = index ? "rgba(182,122,69,0.26)" : "rgba(124,130,140,0.15)";
        for (let j = 0; j < rows - 1; j++) {
          for (let i = 0; i < cols - 1; i++) {
            const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
            const code = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
            if (code === 0 || code === 15) continue;
            const x = i * step, y = j * step;
            const lerp = (p: number, q: number) => (t - p) / (q - p || 1e-9);
            const top: [number, number] = [x + step * lerp(a, b), y];
            const right: [number, number] = [x + step, y + step * lerp(b, c)];
            const bottom: [number, number] = [x + step * lerp(d, c), y + step];
            const left: [number, number] = [x, y + step * lerp(a, d)];
            const seg = (p: [number, number], q: [number, number]) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
            switch (code) {
              case 1: case 14: seg(left, bottom); break;
              case 2: case 13: seg(bottom, right); break;
              case 3: case 12: seg(left, right); break;
              case 4: case 11: seg(top, right); break;
              case 6: case 9: seg(top, bottom); break;
              case 7: case 8: seg(left, top); break;
              case 5: seg(left, top); seg(bottom, right); break;
              case 10: seg(top, right); seg(left, bottom); break;
            }
          }
        }
        ctx.stroke();
      }
    };
    draw();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => { clearTimeout(timer); timer = setTimeout(draw, 200); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); clearTimeout(timer); };
  }, []);

  return <canvas ref={ref} className="contour-bg" aria-hidden="true" />;
}
