"use client";

import { useRef } from "react";
import { Braces, Captions, Clapperboard, FileText, Mail, Sparkles, WandSparkles, Zap } from "lucide-react";

type SceneKind = "tools" | "about" | "contact" | "clip";

const scenes: Record<SceneKind, { eyebrow: string; title: string; subtitle: string; cards: { icon: typeof Sparkles; label: string; title: string; detail: string; className: string }[] }> = {
  tools: {
    eyebrow: "AI TOOLS LAB / LIVE",
    title: "Little tools. Big momentum.",
    subtitle: "A workspace for getting the small stuff done.",
    cards: [
      { icon: Braces, label: "FORMAT / 01", title: "Clean code", detail: "Readable · structured · ready", className: "back" },
      { icon: WandSparkles, label: "IDEA → DONE", title: "Make it\nmake sense.", detail: "Your next task, simplified.", className: "front" },
      { icon: FileText, label: "WRITE / REFINE", title: "Words, sorted.", detail: "Drafts to polished copy", className: "side" },
    ],
  },
  about: {
    eyebrow: "THE WORKFLOW / IN MOTION",
    title: "Input. Think. Done.",
    subtitle: "Useful steps, connected without the busywork.",
    cards: [
      { icon: FileText, label: "01 / INPUT", title: "Bring context", detail: "Text · files · ideas", className: "back" },
      { icon: Sparkles, label: "02 / THINK", title: "Find the signal.", detail: "Useful answers, fewer steps.", className: "front" },
      { icon: Zap, label: "03 / OUTPUT", title: "Move forward", detail: "Review, refine, use", className: "side" },
    ],
  },
  contact: {
    eyebrow: "OPEN CHANNEL / 03",
    title: "Good ideas start here.",
    subtitle: "Feedback, questions, and better ways to work.",
    cards: [
      { icon: Mail, label: "MESSAGE / IN", title: "Your note", detail: "A question or an idea", className: "back" },
      { icon: Sparkles, label: "LET'S CONNECT", title: "Make contact.", detail: "A real person will read it.", className: "front" },
      { icon: Captions, label: "FEEDBACK / OUT", title: "Better tools", detail: "Built from useful feedback", className: "side" },
    ],
  },
  clip: {
    eyebrow: "CLIP AI / EDIT SUITE",
    title: "Find the moment.",
    subtitle: "From long-form footage to a short with a pulse.",
    cards: [
      { icon: Clapperboard, label: "SOURCE / 01", title: "Raw footage", detail: "Long video in", className: "back" },
      { icon: Captions, label: "SMART EDIT", title: "Hook. Cut. Caption.", detail: "A sharper short, ready to review.", className: "front" },
      { icon: WandSparkles, label: "EXPORT / 9:16", title: "Made to move", detail: "Vertical · punchy · shareable", className: "side" },
    ],
  },
};

export function FloatingCardScene({ kind }: { kind: SceneKind }) {
  const root = useRef<HTMLDivElement>(null);
  const scene = scenes[kind];
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !root.current) return;
    const bounds = root.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    root.current.style.setProperty("--scene-rx", (y * -9).toFixed(2) + "deg");
    root.current.style.setProperty("--scene-ry", (x * 11).toFixed(2) + "deg");
    root.current.style.setProperty("--scene-x", (x * 15).toFixed(1) + "px");
    root.current.style.setProperty("--scene-y", (y * 15).toFixed(1) + "px");
    root.current.style.setProperty("--scene-light-x", ((x + 0.5) * 100).toFixed(1) + "%");
    root.current.style.setProperty("--scene-light-y", ((y + 0.5) * 100).toFixed(1) + "%");
  };
  const reset = () => {
    if (!root.current) return;
    root.current.style.setProperty("--scene-rx", "0deg");
    root.current.style.setProperty("--scene-ry", "0deg");
    root.current.style.setProperty("--scene-x", "0px");
    root.current.style.setProperty("--scene-y", "0px");
    root.current.style.setProperty("--scene-light-x", "50%");
    root.current.style.setProperty("--scene-light-y", "50%");
  };
  return <div className={"rg-floating-scene rg-floating-scene-" + kind} ref={root} onPointerMove={move} onPointerLeave={reset} aria-label={scene.title}>
    <div className="rg-floating-orbit orbit-one" aria-hidden="true"/><div className="rg-floating-orbit orbit-two" aria-hidden="true"/>
    <span className="rg-floating-spark spark-a" aria-hidden="true">✳</span><span className="rg-floating-spark spark-b" aria-hidden="true">✦</span><span className="rg-floating-spark spark-c" aria-hidden="true">✧</span>
    {scene.cards.map((card) => { const Icon = card.icon; return <article key={card.className} className={"rg-floating-card card-" + card.className}>
      <span className="rg-floating-icon"><Icon size={20}/></span><span className="rg-floating-eyebrow">{card.label}</span><strong>{card.title.split("\n").map((line, i) => <span key={i}>{line}</span>)}</strong><small>{card.detail}</small><i className="rg-floating-card-shine" aria-hidden="true"/>
    </article>; })}
    <div className="rg-floating-scene-foot"><span>{scene.eyebrow}</span><span>MOVE YOUR MOUSE ↗</span></div>
  </div>;
}
