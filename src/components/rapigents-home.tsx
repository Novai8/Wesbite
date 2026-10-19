"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, AudioLines, Braces, Captions, Check, Clapperboard, Code2, FileText, Film, Layers3, Play, Search, Scissors, Sparkles, WandSparkles, Zap } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;
const highlights = [
  { icon: FileText, title: "Write & refine", text: "Turn rough notes into something clear, polished, and ready to use.", tint: "pink" },
  { icon: Braces, title: "Clean & convert", text: "Format data, transform text, and get small technical jobs out of the way.", tint: "blue" },
  { icon: Zap, title: "Think faster", text: "Use AI helpers for research, planning, learning, and everyday work.", tint: "lime" },
];

export function RapigentsHome() {
  const router = useRouter();
  const [clipLaunching, setClipLaunching] = useState(false);
  const reduceMotion = useReducedMotion();
  const openClipAI = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    setClipLaunching(true);
    window.setTimeout(() => router.push("/clip-ai"), reduceMotion ? 0 : 760);
  };
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
            <Link href="/about" className="rg-fun-secondary">How it works <ArrowRight size={16}/></Link><a href="https://www.rapiflix.online/" target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:"10px",padding:"14px 18px",border:"1px solid rgba(216,255,99,.55)",borderRadius:"999px",background:"rgba(216,255,99,.10)",color:"#e7ffad",fontWeight:700,fontSize:"14px",lineHeight:1.2,textDecoration:"none",position:"relative",zIndex:2}}><Film size={17}/> Watch free movies, without ads <ArrowUpRight size={16}/></a>
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
        <div className="rg-fun-cards">{highlights.map((item, index) => { const Icon = item.icon; return <motion.article key={item.title} className={"rg-fun-card rg-interactive-card tint-" + item.tint} onPointerMove={(event) => { if (event.pointerType !== "mouse" || reduceMotion) return; const rect = event.currentTarget.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width - 0.5; const y = (event.clientY - rect.top) / rect.height - 0.5; event.currentTarget.style.setProperty("--rg-card-tilt-x", (y * -4.5).toFixed(2) + "deg"); event.currentTarget.style.setProperty("--rg-card-tilt-y", (x * 5.5).toFixed(2) + "deg"); event.currentTarget.style.setProperty("--rg-card-glow-x", ((x + 0.5) * 100).toFixed(1) + "%"); event.currentTarget.style.setProperty("--rg-card-glow-y", ((y + 0.5) * 100).toFixed(1) + "%"); }} onPointerLeave={(event) => { event.currentTarget.style.setProperty("--rg-card-tilt-x", "0deg"); event.currentTarget.style.setProperty("--rg-card-tilt-y", "0deg"); event.currentTarget.style.setProperty("--rg-card-glow-x", "50%"); event.currentTarget.style.setProperty("--rg-card-glow-y", "50%"); }} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: reduceMotion ? 0 : 0.55, delay: index * 0.1, ease }}><div className="rg-fun-card-top"><span>0{index + 1} / 03</span><Icon size={21}/></div><h3>{item.title}</h3><p>{item.text}</p><Link href="/tools#explore" aria-label={"Explore tools for " + item.title}>Explore tools <ArrowUpRight size={15}/></Link><span className="rg-fun-card-orb" aria-hidden="true"/></motion.article>; })}</div>
        <div className="rg-fun-cta-band"><div className="rg-cta-icon"><Search size={21}/></div><div><strong>Not sure where to start?</strong><p>Search the toolbox by task, not by technical jargon.</p></div><Link href="/tools" className="rg-cta-link">Find a tool <ArrowRight size={16}/></Link></div>
      </div>
    </section>
    <section className="rg-home-clip" aria-labelledby="rg-home-clip-title"><div className="rg-fun-shell rg-home-clip-layout"><div className="rg-home-clip-copy"><span className="rg-home-clip-kicker"><Film size={14}/> MEET YOUR NEXT CREATOR TOOL <span> / 002</span></span><h2 id="rg-home-clip-title">Long video.<br/><em>Short-form magic.</em></h2><p>Turn long videos into short-form edits with strong opening hooks, kinetic captions, and polished vertical framing.</p><Link href="/clip-ai" onClick={openClipAI} className="rg-home-clip-cta">Explore Clip AI <ArrowUpRight size={17}/></Link><div className="rg-home-clip-chips"><span><Scissors size={13}/> Smart cuts</span><span><Captions size={13}/> Pro captions</span><span><Clapperboard size={13}/> 9:16 framing</span></div></div><div className="rg-home-clip-art" aria-hidden="true"><div className="rg-home-clip-halo"/><div className="rg-home-clip-frame"><div className="rg-home-clip-scene"><div className="rg-home-clip-sun"/><div className="rg-home-clip-mountain mountain-a"/><div className="rg-home-clip-mountain mountain-b"/><div className="rg-home-clip-play"><Play size={22} fill="currentColor"/></div><div className="rg-home-clip-subtitles"><span>YOUR STORY</span><strong>IN MOTION.</strong></div><div className="rg-home-clip-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div><div className="rg-home-clip-frame-foot"><span>CLIP AI / PREVIEW</span><span>9:16</span></div></div><div className="rg-home-clip-float clip-float-cut"><Scissors size={15}/> CUT ON BEAT</div><div className="rg-home-clip-float clip-float-cap"><Captions size={15}/> CAPTIONS READY</div><span className="rg-home-clip-note">VERTICAL EDIT PREVIEW</span></div></div></section>
    <section className="rg-fun-last"><div className="rg-fun-shell rg-fun-last-inner"><div><span className="rg-fun-kicker"><AudioLines size={14}/> LESS TAB CHAOS, MORE GETTING-THINGS-DONE</span><h2>Your next shortcut<br/>is <em>right here.</em></h2></div><div className="rg-fun-actions"><Link href="/tools" className="rg-fun-primary">Explore all tools <ArrowUpRight size={18}/></Link><a href="https://www.rapiflix.online/" target="_blank" rel="noopener noreferrer" className="rg-fun-secondary rg-rapiflix-cta"><Film size={17}/> Watch free movies, without ads <ArrowUpRight size={16}/></a></div><div className="rg-last-orb" aria-hidden="true"/></div></section>
    {clipLaunching && <motion.div className="rg-clip-launch-overlay" initial={{opacity:0}} animate={{opacity:1}} role="status" aria-live="polite">
      <motion.div className="rg-clip-launch-card" initial={{y:18,scale:.96}} animate={{y:0,scale:1}} transition={{duration:.28}}>
        <div className="rg-clip-launch-top"><span className="rg-fun-pulse"/> RAPIGENTS / CLIP AI <span>PREPARING EDIT</span></div>
        <div className="rg-clip-launch-preview"><div className="rg-clip-launch-sun"/><div className="rg-clip-launch-mountain mountain-a"/><div className="rg-clip-launch-mountain mountain-b"/><span>SOURCE VIDEO</span></div>
        <div className="rg-clip-launch-timeline"><div className="rg-clip-launch-track"><i/><i/><i/><i/><i/></div><div className="rg-clip-launch-track captions"><i/><i/><i/><i/></div><motion.i className="rg-clip-launch-playhead" animate={{x:[0,260,0]}} transition={{duration:2.1,repeat:Infinity,ease:"easeInOut"}}/></div>
        <motion.div className="rg-clip-launch-caption" animate={{y:[0,-3,0],opacity:[.7,1,.7]}} transition={{duration:1.2,repeat:Infinity}}>CUTS · CAPTIONS · MOTION</motion.div>
        <strong>Finding the story inside your video.</strong><span>Opening your editing workspace…</span>
      </motion.div>
    </motion.div>}
  </main>;
}
