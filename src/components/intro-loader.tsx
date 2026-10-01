"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

const stages = [
  { number: "01", label: "Client enquiry", title: "You send the problem", detail: "Email lands with the process, tools, and bottleneck." },
  { number: "02", label: "Workflow build", title: "Rapigents builds the flow", detail: "Triggers, AI decisions, routing, integrations, review gates." },
  { number: "03", label: "Client handoff", title: "You receive the workflow", detail: "A tested workflow, walkthrough, and clear handoff." },
];

export function IntroLoader() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(true);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let active = true;
    const key = "rapigents-intro-seen";
    try {
      if (sessionStorage.getItem(key) === "1") {
        setShow(false);
        return;
      }
      sessionStorage.setItem(key, "1");
    } catch {}

    document.body.style.overflow = "hidden";
    const duration = reduce ? 900 : 4050;
    const timers = reduce
      ? [window.setTimeout(() => active && setShow(false), duration)]
      : [
          window.setTimeout(() => active && setStage(1), 1250),
          window.setTimeout(() => active && setStage(2), 2500),
          window.setTimeout(() => active && setShow(false), duration),
        ];

    return () => {
      active = false;
      timers.forEach(window.clearTimeout);
      document.body.style.overflow = "";
    };
  }, [reduce]);

  useEffect(() => {
    if (!show) document.body.style.overflow = "";
  }, [show]);

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className="intro-loader"
          role="status"
          aria-label="Rapigents workflow introduction"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: reduce ? 1 : 1.035, filter: reduce ? "none" : "blur(12px)" }}
          transition={{ duration: reduce ? 0.18 : 0.6, ease }}
        >
          <div className="intro-loader__grain" aria-hidden />
          <div className="intro-loader__aurora intro-loader__aurora--one" aria-hidden />
          <div className="intro-loader__aurora intro-loader__aurora--two" aria-hidden />

          <div className="intro-loader__content">
            <motion.div className="intro-loader__brand" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease }}>
              <div className="intro-loader__mini-mark" aria-hidden>RA</div>
              <div>
                <p className="intro-loader__eyebrow">RAPIGENTS</p>
                <p className="intro-loader__tag">From problem → workflow → handoff</p>
              </div>
            </motion.div>

            <div className="intro-loader__timeline" aria-hidden>
              <motion.div className="intro-loader__timeline-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 3.25, ease }} />
              {stages.map((item, index) => (
                <motion.div key={item.number} className="intro-loader__node" animate={stage >= index ? { opacity: 1, scale: 1 } : { opacity: 0.38, scale: 0.9 }} transition={{ duration: 0.35, ease }}>
                  <motion.span
                    className="intro-loader__node-dot"
                    animate={stage === index && !reduce ? { scale: [1, 1.35, 1], boxShadow: ["0 0 0 rgba(139,92,246,0)", "0 0 28px rgba(139,92,246,.75)", "0 0 0 rgba(139,92,246,0)"] } : undefined}
                    transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <span className="intro-loader__node-number">{item.number}</span>
                </motion.div>
              ))}
            </div>

            <div className="intro-loader__scene">
              <AnimatePresence mode="wait">
                <motion.div key={stage} className="intro-loader__scene-inner" initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 1.01 }} transition={{ duration: 0.38, ease }}>
                  <div className="intro-loader__scene-copy">
                    <p className="intro-loader__scene-label">{stages[stage].number} · {stages[stage].label}</p>
                    <h1>{stages[stage].title}</h1>
                    <p>{stages[stage].detail}</p>
                  </div>
                  <SceneVisual stage={stage} reduce={Boolean(reduce)} />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="intro-loader__footer">
              <span>BUILDING AUTOMATION</span>
              <div className="intro-loader__progress"><motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 3.6, ease }} /></div>
              <span>{String(stage + 1).padStart(2, "0")} / 03</span>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SceneVisual({ stage, reduce }: { stage: number; reduce: boolean }) {
  return (
    <div className="intro-loader__scene-visual">
      <div className="intro-loader__network">
        <svg viewBox="0 0 560 300" fill="none" aria-hidden>
          <defs><linearGradient id="introFlow" x1="40" y1="150" x2="520" y2="150" gradientUnits="userSpaceOnUse"><stop stopColor="#A78BFA" /><stop offset=".5" stopColor="#8B5CF6" /><stop offset="1" stopColor="#DDD6FE" /></linearGradient></defs>
          <path d="M70 150 C160 150 160 70 280 70 S400 150 490 150" stroke="#6D28D9" strokeOpacity=".25" strokeWidth="2" />
          <path d="M70 150 C160 150 160 230 280 230 S400 150 490 150" stroke="#6D28D9" strokeOpacity=".25" strokeWidth="2" />
          <motion.path d="M70 150 C160 150 160 70 280 70 S400 150 490 150" stroke="url(#introFlow)" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 16" animate={reduce ? undefined : { strokeDashoffset: [0, -52] }} transition={{ duration: .8, repeat: Infinity, ease: "linear" }} />
          <motion.path d="M70 150 C160 150 160 230 280 230 S400 150 490 150" stroke="url(#introFlow)" strokeWidth="3" strokeLinecap="round" strokeDasharray="10 16" animate={reduce ? undefined : { strokeDashoffset: [0, -52] }} transition={{ duration: .95, repeat: Infinity, ease: "linear" }} />
        </svg>
        {[["14%", "50%", "MAIL"], ["50%", "24%", "AI"], ["86%", "50%", "HANDOFF"]].map(([left, top, label], index) => (
          <motion.div key={label} className="intro-loader__process-node" style={{ left, top }} animate={reduce ? undefined : { y: [0, index === 1 ? -5 : 4, 0] }} transition={{ duration: 2.2 + index * .25, repeat: Infinity, ease: "easeInOut" }}>
            <span className="intro-loader__process-pulse" /><b>{label}</b>
          </motion.div>
        ))}
        <motion.div className="intro-loader__packet" animate={reduce ? { opacity: 1 } : { left: ["13%", "49%", "85%"] }} transition={{ duration: 2.6, ease, times: [0, .48, 1], repeat: Infinity }}><span /></motion.div>
      </div>

      {stage === 0 ? (
        <motion.div className="intro-loader__window" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .45, ease }}>
          <span className="intro-loader__window-top">INBOX · NEW MESSAGE</span>
          <strong>Need to automate our lead follow-up</strong>
          <small>“Can you connect our form, AI qualification and CRM?”</small>
        </motion.div>
      ) : stage === 1 ? (
        <motion.div className="intro-loader__workflow">
          {["Trigger", "AI decision", "Route", "Review", "CRM"].map((label, index) => (
            <motion.div key={label} className="intro-loader__workflow-node" initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * .09, duration: .3, ease }}>
              <span />{label}
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div className="intro-loader__handoff" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .45, ease }}>
          <span className="intro-loader__handoff-check">✓</span>
          <div><strong>Workflow ready</strong><small>Tested · documented · handed off</small></div>
        </motion.div>
      )}
    </div>
  );
}
