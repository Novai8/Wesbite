"use client";

import { useRef } from "react";
import { AudioLines, Braces, Mail, ScanLine, Sparkles, Workflow, Zap } from "lucide-react";

type SceneKind = "tools" | "about" | "contact" | "clip";

const sceneCopy: Record<SceneKind, { title: string; label: string; accent: string }> = {
  tools: { title: "Ideas in orbit", label: "TOOL SIGNALS / LIVE", accent: "#b9a0ff" },
  about: { title: "Flow, not friction", label: "CONNECTED STEPS", accent: "#65e4d0" },
  contact: { title: "Open channel", label: "SIGNAL RECEIVED", accent: "#ff8fbd" },
  clip: { title: "Cut to the moment", label: "AUDIO / FRAME / HOOK", accent: "#ff9a79" },
};

export function FloatingCardScene({ kind }: { kind: SceneKind }) {
  const root = useRef<HTMLDivElement>(null);
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !root.current) return;
    const rect = root.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - .5;
    const y = (event.clientY - rect.top) / rect.height - .5;
    root.current.style.setProperty("--scene-x", (x * 20).toFixed(1) + "px");
    root.current.style.setProperty("--scene-y", (y * 20).toFixed(1) + "px");
    root.current.style.setProperty("--scene-r", (x * 7).toFixed(2) + "deg");
    root.current.style.setProperty("--scene-light-x", ((x + .5) * 100).toFixed(1) + "%");
    root.current.style.setProperty("--scene-light-y", ((y + .5) * 100).toFixed(1) + "%");
  };
  const reset = () => {
    if (!root.current) return;
    root.current.style.setProperty("--scene-x", "0px");
    root.current.style.setProperty("--scene-y", "0px");
    root.current.style.setProperty("--scene-r", "0deg");
    root.current.style.setProperty("--scene-light-x", "50%");
    root.current.style.setProperty("--scene-light-y", "50%");
  };
  const copy = sceneCopy[kind];
  return <div ref={root} onPointerMove={move} onPointerLeave={reset} className={"rg-floating-scene rg-motion-scene rg-motion-scene-" + kind} style={{ "--scene-accent": copy.accent } as React.CSSProperties} role="img" aria-label={copy.title}>
    <div className="rg-motion-halo" aria-hidden="true" />
    {kind === "tools" && <div className="rg-atom-system" aria-hidden="true">
      <i className="rg-atom-ring ring-a"/><i className="rg-atom-ring ring-b"/><i className="rg-atom-ring ring-c"/>
      <span className="rg-atom-core"><Sparkles size={30}/></span>
      <span className="rg-atom-bit bit-a"><Braces size={19}/></span><span className="rg-atom-bit bit-b"><Zap size={18}/></span><span className="rg-atom-bit bit-c"><ScanLine size={17}/></span>
    </div>}
    {kind === "about" && <div className="rg-flow-map" aria-hidden="true">
      <svg viewBox="0 0 420 300" role="presentation"><path d="M45 165 C100 20 165 275 220 135 S330 30 375 150" /><path d="M45 165 C130 265 160 35 220 135 S320 260 375 150" className="flow-alt"/></svg>
      <span className="rg-flow-node node-a"><FileIcon/></span><span className="rg-flow-node node-b"><Sparkles size={23}/></span><span className="rg-flow-node node-c"><Workflow size={21}/></span>
      <i className="rg-flow-particle particle-a"/><i className="rg-flow-particle particle-b"/><i className="rg-flow-particle particle-c"/>
    </div>}
    {kind === "contact" && <div className="rg-signal-scene" aria-hidden="true">
      <i className="rg-signal-ring signal-a"/><i className="rg-signal-ring signal-b"/><i className="rg-signal-ring signal-c"/>
      <span className="rg-signal-core"><Mail size={30}/></span><span className="rg-signal-dot dot-a"/><span className="rg-signal-dot dot-b"/><span className="rg-signal-dot dot-c"/>
    </div>}
    {kind === "clip" && <div className="rg-clip-motion" aria-hidden="true">
      <div className="rg-clip-aperture"><span/><span/><span/><i/></div>
      <div className="rg-clip-wave">{Array.from({ length: 35 }, (_, i) => <i key={i} style={{ "--bar-i": i, "--bar-height": (5 + (i % 7) * 3) + "px" } as React.CSSProperties}/>)}</div>
      <div className="rg-clip-scanline"/>
      <span className="rg-clip-playhead"/>
      <span className="rg-clip-caption">HOOK FOUND <Sparkles size={13}/></span>
    </div>}
    <span className="rg-motion-spark spark-a" aria-hidden="true">✳</span><span className="rg-motion-spark spark-b" aria-hidden="true">✦</span><span className="rg-motion-spark spark-c" aria-hidden="true">·</span>
    <div className="rg-motion-label"><span>{copy.label}</span><strong>{copy.title}</strong></div>
  </div>;
}

function FileIcon() {
  return <AudioLines size={21}/>;
}
