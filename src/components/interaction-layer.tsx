"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

const accents: Record<string, string> = {
  "/": "#b8ff6a",
  "/tools": "#a99aff",
  "/about": "#65e4d0",
  "/contact": "#ff8fbd",
};

export function InteractionLayer() {
  const pathname = usePathname();
  const router = useRouter();
  const auraRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: -80, y: -80 });
  const current = useRef({ x: -80, y: -80 });
  const [hovering, setHovering] = useState(false);
  const [transition, setTransition] = useState<{ label: string; accent: string } | null>(null);
  const navigating = useRef(false);
  const accent = accents[pathname] ?? accents["/"];

  useEffect(() => {
    document.documentElement.style.setProperty("--page-accent", accent);
  }, [accent]);

  useEffect(() => {
    let frame = 0;
    const move = (event: PointerEvent) => {
      target.current = { x: event.clientX, y: event.clientY };
      if (coreRef.current) {
        coreRef.current.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
      }
      const interactive = document.elementFromPoint(event.clientX, event.clientY)?.closest("a,button,[role=button],input,textarea,select,label");
      setHovering(Boolean(interactive));
    };
    const animate = () => {
      current.current.x += (target.current.x - current.current.x) * 0.19;
      current.current.y += (target.current.y - current.current.y) * 0.19;
      if (auraRef.current) {
        auraRef.current.style.transform = `translate3d(${current.current.x}px,${current.current.y}px,0)`;
      }
      frame = window.requestAnimationFrame(animate);
    };
    window.addEventListener("pointermove", move, { passive: true });
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("pointermove", move);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    let navigateTimer: ReturnType<typeof setTimeout> | undefined;
    let finishTimer: ReturnType<typeof setTimeout> | undefined;
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
      }, 850);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (navigateTimer) clearTimeout(navigateTimer);
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, [router]);

  return <>
    <div ref={auraRef} className="rg-pointer-aura" aria-hidden="true"><span>✳</span></div>
    <div ref={coreRef} className={`rg-pointer-core${hovering ? " is-hovering" : ""}`} aria-hidden="true" />
    {transition && <div className="rg-page-flash" role="status" aria-live="polite" style={{ "--flash-accent": transition.accent } as React.CSSProperties}>
      <div className="rg-flash-orb rg-flash-orb-one" /><div className="rg-flash-orb rg-flash-orb-two" />
      <div className="rg-flash-content"><span className="rg-flash-icon"><Sparkles size={24}/></span><span className="rg-flash-label">RAPIGENTS / IN MOTION</span><h2>{transition.label}</h2><span className="rg-flash-arrow"><ArrowRight size={16}/> ONE MOMENT</span></div>
    </div>}
  </>;
}
