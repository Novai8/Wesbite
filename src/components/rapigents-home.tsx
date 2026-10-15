"use client";

import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Bot, Braces, Check, Command, GitBranch, Layers3, ScanLine, Workflow, Zap } from "lucide-react";
import { useRef } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

const systems = [
  { n: "01", title: "Capture", detail: "Catch the signal before it goes cold.", icon: ScanLine },
  { n: "02", title: "Interpret", detail: "Turn scattered context into a clear next step.", icon: Braces },
  { n: "03", title: "Execute", detail: "Move the work forward, with a human in control.", icon: Zap },
];

export function RapigentsHome() {
  const scene = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: scene, offset: ["start start", "end start"] });
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 170]);
  const sceneRotate = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -9]);
  const sceneScale = useTransform(scrollYProgress, [0, 1], [1, reduceMotion ? 1 : 0.88]);

  return (
    <main id="content" className="rg-home">
      <section ref={scene} className="rg-hero">
        <div className="rg-hero-grid" aria-hidden="true" />
        <div className="rg-hero-scan" aria-hidden="true" />
        <div className="rg-shell rg-hero-layout">
          <motion.div className="rg-hero-copy" initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }}>
            <div className="rg-kicker"><span className="rg-status-dot" /> INDEPENDENT AUTOMATION STUDIO <span className="rg-kicker-index">/ 001</span></div>
            <h1>Work should<br />move <em>without</em><br /><span>the chaos.</span></h1>
            <p className="rg-hero-deck">We design practical AI tools and business workflows that turn repetitive operations into clear, reviewable systems.</p>
            <div className="rg-hero-actions">
              <Link href="/demos" className="rg-button rg-button-primary">Explore the systems <ArrowUpRight size={16} /></Link>
              <Link href="/tools" className="rg-button rg-button-quiet">Find your first tool <ArrowRight size={16} /></Link>
            </div>
            <div className="rg-hero-foot"><span>BUILT FOR REAL WORK</span><span className="rg-foot-rule" /><span>HUMAN REVIEW STAYS IN THE LOOP</span></div>
          </motion.div>

          <motion.div className="rg-machine-wrap" style={{ y: sceneY, rotateX: sceneRotate, scale: sceneScale }} initial={{ opacity: 0, x: 36, rotateY: -12 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} transition={{ duration: 1.1, delay: 0.1, ease }} aria-label="Abstract visualization of a business workflow">
            <div className="rg-machine-label rg-machine-label-top"><span>FIG. 01</span><span>OPERATIONS ENGINE</span><span>LIVE MODEL</span></div>
            <div className="rg-machine-orbit rg-orbit-a" />
            <div className="rg-machine-orbit rg-orbit-b" />
            <div className="rg-machine-orbit rg-orbit-c" />
            <div className="rg-machine-core"><div className="rg-core-mark"><Workflow size={31} strokeWidth={1.3} /></div><span>ROUTE / REASON / RESOLVE</span></div>
            <div className="rg-node rg-node-capture"><span className="rg-node-symbol"><ScanLine size={15}/></span><span><b>INBOUND SIGNAL</b><small>01 / CAPTURE</small></span><i>↘</i></div>
            <div className="rg-node rg-node-intelligence"><span className="rg-node-symbol"><Bot size={15}/></span><span><b>CONTEXT ENGINE</b><small>02 / INTERPRET</small></span><i>↗</i></div>
            <div className="rg-node rg-node-action"><span className="rg-node-symbol"><Check size={15}/></span><span><b>REVIEWED ACTION</b><small>03 / EXECUTE</small></span><i>↗</i></div>
            <div className="rg-machine-rail"><span>INPUT</span><span className="rg-rail-line" /><span>DECISION</span><span className="rg-rail-line" /><span>OUTPUT</span></div>
            <div className="rg-machine-coordinate">24° / RG—OPS / 006</div>
          </motion.div>
        </div>
        <div className="rg-hero-bottom"><span>RAPIGENTS / WORK, MADE VISIBLE</span><a href="#approach">SCROLL TO TRACE THE SYSTEM <ArrowDownRight size={13}/></a><span>PAKISTAN · WORKING WORLDWIDE</span></div>
      </section>

      <section className="rg-intro rg-section" id="approach">
        <div className="rg-shell">
          <div className="rg-section-meta"><span>01 — THE PRINCIPLE</span><span>LESS REPETITION. MORE MOMENTUM.</span></div>
          <div className="rg-intro-grid">
            <h2>Not more software.<br /><em>Less friction.</em></h2>
            <div className="rg-intro-copy"><p>Most teams do not need another dashboard. They need the handoffs, follow-ups and small decisions between their tools to stop leaking time.</p><p>Rapigents builds focused systems around that gap. Start with a clear task, test it on realistic data, keep people in control.</p><Link href="/about" className="rg-text-link">How we think about the work <ArrowUpRight size={15}/></Link></div>
          </div>
          <div className="rg-process">
            {systems.map((step) => {
              const Icon = step.icon;
              return <motion.article key={step.n} className="rg-process-step" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.65, delay: Number(step.n) * 0.08, ease }}>
                <div className="rg-process-top"><span>{step.n} / 03</span><Icon size={19} strokeWidth={1.4}/></div>
                <h3>{step.title}</h3><p>{step.detail}</p><span className="rg-process-arrow"><ArrowDownRight size={16}/></span>
              </motion.article>;
            })}
          </div>
        </div>
      </section>

      <section className="rg-tools-band">
        <div className="rg-shell rg-tools-layout">
          <div className="rg-tools-orbit" aria-hidden="true"><div className="rg-tools-orbit-ring ring-one"/><div className="rg-tools-orbit-ring ring-two"/><div className="rg-tools-orbit-ring ring-three"/><div className="rg-tools-orbit-core"><Command size={27}/></div><span className="orbit-chip chip-a">WRITE</span><span className="orbit-chip chip-b">BUILD</span><span className="orbit-chip chip-c">THINK</span></div>
          <div className="rg-tools-copy"><div className="rg-kicker"><span className="rg-status-dot" /> FIELD TOOL / 002</div><h2>Small tools.<br /><em>Useful output.</em></h2><p>Explore a growing lab of AI-assisted and browser-native utilities for writing, research, study, data cleanup and everyday operations.</p><div className="rg-tools-points"><span><Check size={14}/> AI-assisted workflows</span><span><Check size={14}/> Local browser utilities</span><span><Check size={14}/> No fake buttons or mystery steps</span></div><Link href="/tools" className="rg-button rg-button-primary">Open AI Tools Lab <ArrowUpRight size={16}/></Link></div>
        </div>
      </section>

      <section className="rg-work-section rg-section">
        <div className="rg-shell">
          <div className="rg-section-meta"><span>02 — PROTOTYPES, NOT PROMISES</span><span>REAL FLOWS / FICTIONAL DEMO DATA</span></div>
          <div className="rg-work-heading"><h2>See how the<br /><em>work moves.</em></h2><p>Browse workflow prototypes built around real operational patterns. Each one shows the trigger, decision path and handoff, with review points made visible.</p></div>
          <div className="rg-work-diagram" aria-label="Example workflow: enquiry, qualification, human review, response">
            <div className="rg-diagram-head"><span>WORKFLOW / ENQUIRY TO RESPONSE</span><span>DEMO STATE <i /></span></div>
            <div className="rg-diagram-flow">
              <div className="rg-diagram-node"><span>01</span><ScanLine size={18}/><b>Enquiry</b><small>Capture signal</small></div><div className="rg-diagram-connector"><span/></div>
              <div className="rg-diagram-node"><span>02</span><Layers3 size={18}/><b>Qualify</b><small>Structure context</small></div><div className="rg-diagram-connector"><span/></div>
              <div className="rg-diagram-node node-review"><span>03</span><Check size={18}/><b>Human review</b><small>Approve action</small></div><div className="rg-diagram-connector"><span/></div>
              <div className="rg-diagram-node"><span>04</span><ArrowUpRight size={18}/><b>Respond</b><small>Close the loop</small></div>
            </div>
            <div className="rg-diagram-foot"><span><span className="rg-status-dot"/> AUDITABLE STEPS</span><span>NO AUTONOMOUS EXTERNAL ACTIONS IN THIS DEMO</span></div>
          </div>
          <div className="rg-work-footer"><span>EXAMPLES ARE ILLUSTRATIVE. ACTUAL RESULTS DEPEND ON CONTEXT.</span><Link href="/demos" className="rg-text-link">Browse workflow patterns <ArrowUpRight size={15}/></Link></div>
        </div>
      </section>

      <section className="rg-close">
        <div className="rg-close-grid" aria-hidden="true"/>
        <div className="rg-shell rg-close-inner"><div className="rg-kicker"><span className="rg-status-dot"/> START WITH THE BOTTLENECK</div><h2>What keeps getting<br /><em>left until later?</em></h2><p>Start with one repetitive task. We will make the steps visible, then figure out what is worth automating.</p><div className="rg-close-actions"><Link href="/contact" className="rg-button rg-button-primary">Describe the bottleneck <ArrowUpRight size={16}/></Link><Link href="/demos" className="rg-button rg-button-quiet">See workflow patterns <ArrowRight size={16}/></Link></div><div className="rg-close-note"><GitBranch size={14}/> SMALL SYSTEMS. CLEAR HANDOFFS. HUMAN CONTROL.</div></div>
      </section>
    </main>
  );
}
