"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

const accents: Record<string, string> = {
  "/": "#b8ff6a",
  "/tools": "#a99aff",
  "/about": "#65e4d0",
  "/contact": "#ff8fbd",
  "/clip-ai": "#ff7a54",
};

export function InteractionLayer() {
  const pathname = usePathname();
  const router = useRouter();
  const auraRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: -80, y: -80 });
  const current = useRef({ x: -80, y: -80 });
  const [hovering, setHovering] = useState(false);
  const [cursorSeen, setCursorSeen] = useState(false);
  const [transition, setTransition] = useState<{ label: string; accent: string } | null>(null);
  const navigating = useRef(false);
  const accent = accents[pathname] ?? accents["/"];

  useEffect(() => {
    document.documentElement.style.setProperty("--page-accent", accent);
  }, [accent]);

  useEffect(() => {
    let frame = 0;
    let activeCard: HTMLElement | null = null;
    const cardSelector = '[class*="card"], [class*="tile"], [class*="step"]';
    const resetCard = (card: HTMLElement | null) => {
      if (!card) return;
      card.style.setProperty("--rg-card-tilt-x", "0deg");
      card.style.setProperty("--rg-card-tilt-y", "0deg");
      card.style.setProperty("--rg-card-glow-x", "50%");
      card.style.setProperty("--rg-card-glow-y", "50%");
    };
    const move = (event: PointerEvent) => {
      target.current = { x: event.clientX, y: event.clientY };
      setCursorSeen(true);
      if (coreRef.current) {
        coreRef.current.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
      }
      const targetElement = document.elementFromPoint(event.clientX, event.clientY);
      const interactive = targetElement?.closest("a,button,[role=button],input,textarea,select,label");
      setHovering(Boolean(interactive));
      if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const nextCard = targetElement instanceof Element ? targetElement.closest<HTMLElement>(cardSelector) : null;
      if (nextCard !== activeCard) { resetCard(activeCard); activeCard = nextCard; }
      if (!activeCard) return;
      activeCard.classList.add("rg-site-card");
      const rect = activeCard.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      activeCard.style.setProperty("--rg-card-tilt-x", (y * -4.5).toFixed(2) + "deg");
      activeCard.style.setProperty("--rg-card-tilt-y", (x * 5.5).toFixed(2) + "deg");
      activeCard.style.setProperty("--rg-card-glow-x", ((x + 0.5) * 100).toFixed(1) + "%");
      activeCard.style.setProperty("--rg-card-glow-y", ((y + 0.5) * 100).toFixed(1) + "%");
    };
    const leave = () => { resetCard(activeCard); activeCard = null; };
    const animate = () => {
      current.current.x += (target.current.x - current.current.x) * 0.19;
      current.current.y += (target.current.y - current.current.y) * 0.19;
      if (auraRef.current) {
        auraRef.current.style.transform = `translate3d(${current.current.x}px,${current.current.y}px,0)`;
      }
      frame = window.requestAnimationFrame(animate);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerleave", leave);
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", leave);
      resetCard(activeCard);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    let navigateTimer: number | undefined;
    let finishTimer: number | undefined;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || link.target === "_blank" || link.hasAttribute("download")) return;
      if (url.pathname === window.location.pathname && (url.hash || !url.search)) return;
      if (link.hasAttribute("data-no-transition")) return;
      event.preventDefault();
      if (navigating.current) return;
      navigating.current = true;
      const nextAccent = accents[url.pathname] ?? accents["/"];
      setTransition({ label: url.pathname === "/tools" ? "Let’s make something useful" : "Moving things into place", accent: nextAccent });
      navigateTimer = window.setTimeout(() => router.push(url.pathname + url.search + url.hash), 160);
      finishTimer = window.setTimeout(() => {
        setTransition(null);
        navigating.current = false;
      }, 1350);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (navigateTimer) window.clearTimeout(navigateTimer);
      if (finishTimer) window.clearTimeout(finishTimer);
    };
  }, [router]);

  return <>
    <div ref={auraRef} className={"rg-pointer-aura" + (cursorSeen ? " is-visible" : "") + (hovering ? " is-hovering" : "")} aria-hidden="true"><span>✳</span></div>
    <div ref={coreRef} className={`rg-pointer-core${cursorSeen ? " is-visible" : ""}${hovering ? " is-hovering" : ""}`} aria-hidden="true" />
    {transition && <div className="rg-page-flash" role="status" aria-live="polite" style={{ "--flash-accent": transition.accent } as React.CSSProperties}>
      <div className="rg-flash-orb rg-flash-orb-one" /><div className="rg-flash-orb rg-flash-orb-two" />
      <div className="rg-flash-content"><span className="rg-flash-icon"><Sparkles size={24}/></span><span className="rg-flash-label">RAPIGENTS / IN MOTION</span><h2>{transition.label}</h2><span className="rg-flash-arrow"><ArrowRight size={16}/> ONE MOMENT</span></div>
    </div>}
  </>;
}
