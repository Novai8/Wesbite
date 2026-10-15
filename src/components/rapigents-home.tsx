"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, AudioLines, Braces, Check, Code2, FileText, Layers3, Search, Sparkles, WandSparkles, Zap } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;
const highlights = [
  { icon: FileText, title: "Write & refine", text: "Turn rough notes into something clear, polished, and ready to use.", tint: "pink" },
  { icon: Braces, title: "Clean & convert", text: "Format data, transform text, and get small technical jobs out of the way.", tint: "blue" },
  { icon: Zap, title: "Think faster", text: "Use AI helpers for research, planning, learning, and everyday work.", tint: "lime" },
];

export function RapigentsHome() {
  const reduceMotion = useReducedMotion();
  const tiltScene = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    event.currentTarget.style.setProperty("--tilt-x", (y * -10).toFixed(2) + "deg");
    event.currentTarget.style.setProperty("--tilt-y", (x * 12).toFixed(2) + "deg");
    event.currentTarget.style.setProperty("--float-x", (x * 18).toFixed(1) + "px");
    event.currentTarget.style.setProperty("--float-y", (y * 18).toFixed(1) + "px");
  };
  const resetScene = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
    event.currentTarget.style.setProperty("--float-x", "0px");
    event.currentTarget.style.setProperty("--float-y", "0px");
  };

  return <main id="content" className="rg-home rg-home-fun">
    <section className="rg-fun-hero">
      <div className="rg-fun-grid" aria-hidden="true"/>
      <div className="rg-fun-glow rg-fun-glow-a" aria-hidden="true"/>
      <div className="rg-fun-glow rg-fun-glow-b" aria-hidden="true"/>
      <div className="rg-fun-shell rg-fun-layout">
        <motion.div className="rg-fun-copy" initial={{ opacity: 0, y: 28, filter: "blur(12px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: reduceMotion ? 0 : 0.9, ease }}>
          <div className="rg-fun-kicker"><span className="rg-fun-pulse"/> YOUR NEW FAVOURITE TOOLBOX <span className="rg-kicker-index">✳ 001</span></div>
          <h1>Less <span className="rg-word-gradient">busywork.</span><br/>More <em>brainpower.</em></h1>
          <p>Meet the little tools that make the annoying tasks easier. Write, think, clean up data, explore ideas, and get on with your day.</p>
          <div className="rg-fun-actions">
            <Link href="/tools" className="rg-fun-primary">Get into the tools <ArrowUpRight size={18}/></Link>
            <Link href="/about" className="rg-fun-secondary">How it works <ArrowRight size={16}/></Link>
          </div>
          <div className="rg-fun-trust"><span><Check size={14}/> AI-powered helpers</span><span><Check size={14}/> Handy browser tools</span><span><Check size={14}/> No setup maze</span></div>
        </motion.div>
        <motion.div className="rg-fun-scene-wrap" initial={{ opacity: 0, scale: 0.86, y: 22 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 1.05, delay: 0.12, ease }}>
          <div className="rg-fun-scene" onPointerMove={tiltScene} onPointerLeave={resetScene} aria-label="A playful three-dimensional stack of floating tool cards">
            <div className="rg-scene-shadow"/>
            <div className="rg-scene-orbit rg-scene-orbit-one"/><div className="rg-scene-orbit rg-scene-orbit-two"/>
            <div className="rg-scene-spark spark-one">✳</div><div className="rg-scene-spark spark-two">✦</div><div className="rg-scene-spark spark-three">✧</div>
            <div className="rg-float-tile tile-back"><span className="rg-tile-icon icon-blue"><Code2 size={22}/></span><span className="rg-tile-label">CLEAN CODE</span><div className="rg-code-lines"><i/><i/><i/><i/></div></div>
            <div className="rg-float-tile tile-front"><span className="rg-tile-icon icon-pink"><WandSparkles size={24}/></span><span className="rg-tile-label">IDEA → DONE</span><strong>Make it<br/><em>make sense.</em></strong><div className="rg-tile-wave"><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
            <div className="rg-float-tile tile-side"><span className="rg-tile-icon icon-lime"><Layers3 size={20}/></span><span className="rg-tile-label">TOOLS THAT CLICK</span><div className="rg-side-dots"><i/><i/><i/></div></div>
            <div className="rg-fun-sticker"><Sparkles size={15}/> MAKE ROOM FOR THE GOOD STUFF</div>
            <div className="rg-scene-caption"><span>THE RAPIGENTS TOOLBOX</span><span>MOVE YOUR MOUSE ↗</span></div>
          </div>
        </motion.div>
      </div>
      <a className="rg-fun-scroll" href="#toolkit">SCROLL A LITTLE <ArrowDownRight size={14}/></a>
      <div className="rg-fun-bottomline"><span>TOOLS FOR THE EVERYDAY STUFF</span><span>CURIOUS BY DESIGN <Sparkles size={12}/></span></div>
    </section>

    <section className="rg-fun-toolkit" id="toolkit">
      <div className="rg-fun-shell">
        <div className="rg-fun-section-head"><div><span className="rg-fun-kicker">A TOOL FOR THAT? PROBABLY.</span><h2>Small tasks.<br/><em>Big sigh of relief.</em></h2></div><p>Open a tool, add what it needs, and get a useful starting point without wrestling another complicated app.</p></div>
        <div className="rg-fun-cards">{highlights.map((item, index) => { const Icon = item.icon; return <motion.article key={item.title} className={"rg-fun-card tint-" + item.tint} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: reduceMotion ? 0 : 0.55, delay: index * 0.1, ease }}><div className="rg-fun-card-top"><span>0{index + 1} / 03</span><Icon size={21}/></div><h3>{item.title}</h3><p>{item.text}</p><Link href="/tools#explore" aria-label={"Explore tools for " + item.title}>Explore tools <ArrowUpRight size={15}/></Link><span className="rg-fun-card-orb" aria-hidden="true"/></motion.article>; })}</div>
        <div className="rg-fun-cta-band"><div className="rg-cta-icon"><Search size={21}/></div><div><strong>Not sure where to start?</strong><p>Search the toolbox by task, not by technical jargon.</p></div><Link href="/tools" className="rg-cta-link">Find a tool <ArrowRight size={16}/></Link></div>
      </div>
    </section>
    <section className="rg-fun-last"><div className="rg-fun-shell rg-fun-last-inner"><div><span className="rg-fun-kicker"><AudioLines size={14}/> LESS TAB CHAOS, MORE GETTING-THINGS-DONE</span><h2>Your next shortcut<br/>is <em>right here.</em></h2></div><Link href="/tools" className="rg-fun-primary">Explore all tools <ArrowUpRight size={18}/></Link><div className="rg-last-orb" aria-hidden="true"/></div></section>
  </main>;
}
