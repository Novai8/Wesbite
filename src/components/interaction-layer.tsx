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
  const [transition, setTransition] = useState<{ label: string; accent: string; kind: string } | null>(null);
  const [burst, setBurst] = useState<{ x: number; y: number; id: number } | null>(null);
  const navigating = useRef(false);
  const accent = accents[pathname] ?? accents["/"];

  useEffect(() => {
    document.documentElement.style.setProperty("--page-accent", accent);
  }, [accent]);

  useEffect(() => {
    let frame = 0;
    let burstTimer = 0;
    const move = (event: PointerEvent) => {
      target.current = { x: event.clientX, y: event.clientY };
      setCursorSeen(true);
      if (coreRef.current) coreRef.current.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
      const targetElement = document.elementFromPoint(event.clientX, event.clientY);
      setHovering(Boolean(targetElement?.closest("a,button,[role=button],input,textarea,select,label")));
    };
    const click = (event: PointerEvent) => {
      if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const id = Date.now();
      setBurst({ x: event.clientX, y: event.clientY, id });
      window.clearTimeout(burstTimer);
      burstTimer = window.setTimeout(() => setBurst((active) => active?.id === id ? null : active), 650);
    };
    const animate = () => {
      current.current.x += (target.current.x - current.current.x) * 0.19;
      current.current.y += (target.current.y - current.current.y) * 0.19;
      if (auraRef.current) auraRef.current.style.transform = `translate3d(${current.current.x}px,${current.current.y}px,0)`;
      frame = window.requestAnimationFrame(animate);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerdown", click, { passive: true });
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerdown", click);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(burstTimer);
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
      const pageTransitions: Record<string, { label: string; kind: string }> = {
        "/": { label: "A little more imagination", kind: "home" },
        "/tools": { label: "Ideas, meet useful tools", kind: "tools" },
        "/about": { label: "Follow the signal", kind: "about" },
        "/contact": { label: "Opening a channel", kind: "contact" },
        "/clip-ai": { label: "Finding the right moment", kind: "clip" },
        "/demos": { label: "Workflows in motion", kind: "demos" },
        "/reviews": { label: "Checking the details", kind: "reviews" },
      };
      const page = pageTransitions[url.pathname] ?? { label: "Making room for what’s next", kind: "default" };
      setTransition({ ...page, accent: nextAccent });
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
    {burst && <span key={burst.id} className="rg-click-burst" aria-hidden="true" style={{ left: burst.x, top: burst.y, "--burst-accent": accent } as React.CSSProperties}>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ "--burst-i": i } as React.CSSProperties} />)}</span>}
    {transition && <div className={"rg-page-flash rg-page-flash-" + transition.kind} role="status" aria-live="polite" style={{ "--flash-accent": transition.accent } as React.CSSProperties}>
      <div className="rg-flash-orb rg-flash-orb-one" /><div className="rg-flash-orb rg-flash-orb-two" />
      <div className="rg-flash-content"><span className="rg-flash-icon"><Sparkles size={24}/></span><span className="rg-flash-label">RAPIGENTS / IN MOTION</span><h2>{transition.label}</h2><span className="rg-flash-arrow"><ArrowRight size={16}/> ONE MOMENT</span></div>
    </div>}
  </>;
}
