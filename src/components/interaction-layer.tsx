"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, Command, LoaderCircle } from "lucide-react";

const palettes: Record<string, { name: string; accent: string; glow: string; glyph: string }> = {
  "/": { name: "signal", accent: "#d8ff63", glow: "rgba(216,255,99,.22)", glyph: "✳" },
  "/tools": { name: "lab", accent: "#9c8cff", glow: "rgba(156,140,255,.25)", glyph: "✦" },
  "/demos": { name: "flow", accent: "#ff9e6e", glow: "rgba(255,158,110,.24)", glyph: "↗" },
  "/about": { name: "method", accent: "#6de0cf", glow: "rgba(109,224,207,.22)", glyph: "◉" },
  "/reviews": { name: "proof", accent: "#f0ca73", glow: "rgba(240,202,115,.23)", glyph: "✧" },
  "/contact": { name: "connect", accent: "#ff83b8", glow: "rgba(255,131,184,.23)", glyph: "↗" },
};

export function InteractionLayer() {
  const pathname = usePathname();
  const router = useRouter();
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: -100, y: -100 });
  const current = useRef({ x: -100, y: -100 });
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("PREPARING YOUR SPACE");
  const [progress, setProgress] = useState(0);
  const [hovering, setHovering] = useState(false);
  const palette = palettes[pathname] ?? palettes["/"];

  useEffect(() => {
    document.documentElement.dataset.page = palette.name;
    document.documentElement.style.setProperty("--page-accent", palette.accent);
    document.documentElement.style.setProperty("--page-glow", palette.glow);
  }, [palette]);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      target.current = { x: event.clientX, y: event.clientY };
      if (dotRef.current) dotRef.current.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
      const el = document.elementFromPoint(event.clientX, event.clientY)?.closest("a,button,[role=button],input,textarea,select");
      setHovering(Boolean(el));
    };
    let raf = 0;
    const animate = () => {
      current.current.x += (target.current.x - current.current.x) * 0.13;
      current.current.y += (target.current.y - current.current.y) * 0.13;
      if (cursorRef.current) cursorRef.current.style.transform = `translate3d(${current.current.x}px,${current.current.y}px,0)`;
      raf = requestAnimationFrame(animate);
    };
    window.addEventListener("mousemove", move, { passive: true });
    raf = requestAnimationFrame(animate);
    return () => { window.removeEventListener("mousemove", move); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    let navigationTimer: ReturnType<typeof setTimeout> | undefined;
    let finishTimer: ReturnType<typeof setTimeout> | undefined;
    let progressTimer: ReturnType<typeof setInterval> | undefined;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const targetEl = event.target instanceof Element ? event.target.closest("a") : null;
      if (!(targetEl instanceof HTMLAnchorElement)) return;
      const url = new URL(targetEl.href, window.location.href);
      if (url.origin !== window.location.origin || targetEl.target === "_blank" || targetEl.hasAttribute("download") || url.pathname === pathname && url.hash) return;
      if (url.pathname === pathname && !url.search) return;
      event.preventDefault();
      if (loading) return;
      const next = palettes[url.pathname] ?? palettes["/"];
      setLabel(next.name === "lab" ? "CALIBRATING THE LAB" : next.name === "flow" ? "MAPPING THE WORKFLOW" : next.name === "connect" ? "OPENING A CHANNEL" : "PREPARING YOUR SPACE");
      setProgress(6);
      setLoading(true);
      let value = 6;
      progressTimer = setInterval(() => { value = Math.min(94, value + Math.max(1, (94 - value) * 0.14)); setProgress(value); }, 110);
      navigationTimer = setTimeout(() => router.push(url.pathname + url.search + url.hash), 720);
      finishTimer = setTimeout(() => { setProgress(100); setLoading(false); }, 2550);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (navigationTimer) clearTimeout(navigationTimer);
      if (finishTimer) clearTimeout(finishTimer);
      if (progressTimer) clearInterval(progressTimer);
    };
  }, [pathname, router, loading]);

  return <>
    <div className="rg-cursor-halo" ref={cursorRef} aria-hidden="true"><span>{palette.glyph}</span></div>
    <div className={`rg-cursor-dot${hovering ? " is-hovering" : ""}`} ref={dotRef} aria-hidden="true" />
    {loading && <div className="rg-transition-screen" role="status" aria-live="polite">
      <div className="rg-transition-grain" />
      <div className="rg-transition-orbit orbit-a" /><div className="rg-transition-orbit orbit-b" /><div className="rg-transition-orbit orbit-c" />
      <div className="rg-transition-center"><div className="rg-transition-symbol"><Command size={26} strokeWidth={1.3}/></div><span className="rg-transition-eyebrow">RAPIGENTS / INTERFACE SHIFT</span><h2>{label}</h2><div className="rg-transition-meter"><span style={{ width: `${progress}%` }} /></div><div className="rg-transition-bottom"><span>ROUTING SIGNAL</span><span>{Math.round(progress).toString().padStart(2,"0")}% <LoaderCircle className="rg-loader-spin" size={13}/></span></div></div>
      <span className="rg-transition-corner">DESIGNED TO MOVE<br/>NOT JUST TO SIT STILL <ArrowUpRight size={14}/></span>
    </div>}
  </>;
}
