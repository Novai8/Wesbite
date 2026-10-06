"use client";

import { useEffect, useRef } from "react";

type Ripple = { x: number; y: number; born: number };

/**
 * Procedural ocean: sky haze, water, sun reflection, swell lines and cursor ripples.
 * The horizon is read from the nearest [data-horizon] element so text never overlaps water.
 * Pauses off-screen and when the tab is hidden; draws one static frame for reduced motion.
 */
export function OceanEnvironment() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const step = coarse ? 6 : 3;
    const ripples: Ripple[] = [];
    let w = 0;
    let h = 0;
    let horizon = 0;
    let raf = 0;
    let running = false;
    let inView = true;
    let tick = 0;
    let sunX = 0.68;
    let sunTarget = 0.68;
    let last = { x: -999, y: -999 };

    function draw(t: number) {
      if (!ctx || w === 0) return;
      const deep = document.documentElement.dataset.theme === "dark";
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      if (deep) {
        sky.addColorStop(0, "#071417");
        sky.addColorStop(0.7, "#0B2527");
        sky.addColorStop(1, "#16484A");
      } else {
        sky.addColorStop(0, "#E9E3D2");
        sky.addColorStop(0.65, "#DCE2D3");
        sky.addColorStop(1, "#C9D8CF");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon);

      const water = ctx.createLinearGradient(0, horizon, 0, h);
      water.addColorStop(0, "#16484A");
      water.addColorStop(0.35, "#0B2527");
      water.addColorStop(1, "#071417");
      ctx.fillStyle = water;
      ctx.fillRect(0, horizon, w, h - horizon);

      const sx = sunX * w;
      const glow = ctx.createRadialGradient(sx, horizon, 0, sx, horizon, Math.max(w, h) * 0.55);
      glow.addColorStop(0, `rgba(243,217,154,${deep ? 0.4 : 0.6})`);
      glow.addColorStop(0.35, "rgba(231,185,94,0.12)");
      glow.addColorStop(1, "rgba(231,185,94,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // distant swell lines, each on its own slow period
      ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        const y0 = horizon + Math.pow(i, 1.7) * 9;
        if (y0 > h) break;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 24) {
          const y = y0 + Math.sin(x * 0.008 + t * (0.12 + i * 0.03) + i) * (1 + i * 0.9);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(201,216,207,${0.05 + i * 0.008})`;
        ctx.stroke();
      }

      // sun reflection column
      const depth = Math.max(1, h - horizon);
      for (let y = horizon + 2; y < h; y += step) {
        const d = (y - horizon) / depth;
        const spread = 14 + d * Math.min(w * 0.18, 220);
        for (let k = 0; k < 3; k++) {
          const off = Math.sin(y * 0.045 + t * (0.5 + k * 0.17) + k * 2.1) * spread * 0.5 + Math.sin(y * 0.013 + t * 0.21 + k) * spread * 0.35;
          const len = spread * (0.25 + 0.5 * Math.abs(Math.sin(y * 0.09 + t * 0.8 + k * 1.7)));
          const a = (1 - d * 0.75) * (0.16 + 0.22 * Math.abs(Math.sin(y * 0.21 - t * 0.6 + k)));
          ctx.fillStyle = `rgba(243,217,154,${a.toFixed(3)})`;
          ctx.fillRect(sx + off - len / 2, y, len, step > 3 ? 2 : 1.5);
        }
      }

      // cursor ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        const age = t - r.born;
        if (age > 2.2) {
          ripples.splice(i, 1);
          continue;
        }
        const rad = age * 58;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rad, rad * 0.28, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(243,217,154,${((1 - age / 2.2) * 0.32).toFixed(3)})`;
        ctx.stroke();
      }

      // haze and the sunline on the horizon
      const haze = ctx.createLinearGradient(0, horizon - 70, 0, horizon);
      haze.addColorStop(0, "rgba(247,245,237,0)");
      haze.addColorStop(1, `rgba(247,245,237,${deep ? 0.06 : 0.22})`);
      ctx.fillStyle = haze;
      ctx.fillRect(0, horizon - 70, w, 70);
      const line = ctx.createLinearGradient(0, 0, w, 0);
      line.addColorStop(0, "rgba(243,217,154,0)");
      line.addColorStop(Math.min(0.98, Math.max(0.02, sunX)), "rgba(243,217,154,0.95)");
      line.addColorStop(1, "rgba(243,217,154,0)");
      ctx.fillStyle = line;
      ctx.fillRect(0, horizon - 0.5, w, 1.5);
    }

    function measure() {
      if (!canvas || !host || !ctx) return;
      const r = host.getBoundingClientRect();
      w = r.width;
      h = r.height;
      const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const hz = host.querySelector<HTMLElement>("[data-horizon]");
      horizon = hz ? hz.getBoundingClientRect().top - r.top : h * 0.6;
      if (!running) draw(performance.now() / 1000);
    }

    function frame(now: number) {
      if (!inView || document.hidden) {
        running = false;
        return;
      }
      tick++;
      if (!coarse || tick % 2 === 0) {
        sunX += (sunTarget - sunX) * 0.05;
        draw(now / 1000);
      }
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (reduce || running || !inView || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }

    function onMove(e: PointerEvent) {
      if (reduce || e.pointerType === "touch") return;
      const r = host!.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (y < 0 || y > h || x < 0 || x > w) return;
      sunTarget = 0.68 + (x / w - 0.5) * 0.14;
      if (y > horizon && Math.hypot(x - last.x, y - last.y) > 70) {
        last = { x, y };
        ripples.push({ x, y, born: performance.now() / 1000 });
        if (ripples.length > 8) ripples.shift();
      }
    }

    const ro = new ResizeObserver(measure);
    ro.observe(host);
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) start();
    });
    io.observe(host);
    const mo = new MutationObserver(() => {
      if (!running) draw(performance.now() / 1000);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const onVisibility = () => {
      if (!document.hidden) start();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    measure();
    start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="sea-canvas" aria-hidden="true" />;
}
