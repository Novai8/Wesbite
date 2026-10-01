"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

const stages = [
  { number: "01", label: "Enquiry" },
  { number: "02", label: "Build" },
  { number: "03", label: "Connect" },
  { number: "04", label: "Handoff" },
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
    const duration = reduce ? 900 : 10000;
    const timers = reduce
      ? [window.setTimeout(() => active && setShow(false), duration)]
      : [
          window.setTimeout(() => active && setStage(1), 2500),
          window.setTimeout(() => active && setStage(2), 5000),
          window.setTimeout(() => active && setStage(3), 7500),
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
          aria-label="Rapigents introduction"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: reduce ? 1 : 1.025, filter: reduce ? "none" : "blur(10px)" }}
          transition={{ duration: reduce ? 0.18 : 0.7, ease }}
        >
          <div className="intro-loader__grain" aria-hidden />
          <div className="intro-loader__aurora intro-loader__aurora--one" aria-hidden />
          <div className="intro-loader__aurora intro-loader__aurora--two" aria-hidden />

          <div className="intro-loader__content">
            <motion.div
              className="intro-loader__brand"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
            >
              <div className="intro-loader__mini-mark" aria-hidden>RA</div>
              <span className="intro-loader__brand-name">RAPIGENTS</span>
            </motion.div>

            <div className="intro-loader__timeline" aria-hidden>
              <motion.div
                className="intro-loader__timeline-line"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 8.8, ease }}
              />
              {stages.map((item, index) => (
                <motion.div
                  key={item.number}
                  className="intro-loader__node"
                  animate={stage >= index ? { opacity: 1, scale: 1 } : { opacity: 0.3, scale: 0.88 }}
                  transition={{ duration: 0.4, ease }}
                >
                  <motion.span
                    className="intro-loader__node-dot"
                    animate={stage === index && !reduce ? { scale: [1, 1.45, 1] } : undefined}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <span className="intro-loader__node-number">{item.number}</span>
                </motion.div>
              ))}
            </div>

            <div className="intro-loader__scene">
              <AnimatePresence mode="wait">
                <motion.div
                  key={stage}
                  className="intro-loader__scene-inner"
                  initial={{ opacity: 0, scale: 0.97, filter: "blur(6px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 1.03, filter: "blur(5px)" }}
                  transition={{ duration: 0.65, ease }}
                >
                  <SceneVisual stage={stage} reduce={Boolean(reduce)} />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="intro-loader__footer">
              <span>{stages[stage].label}</span>
              <div className="intro-loader__progress">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: (stage + 1) / stages.length }}
                  transition={{ duration: 0.6, ease }}
                />
              </div>
              <span>{String(stage + 1).padStart(2, "0")} / 04</span>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SceneVisual({ stage, reduce }: { stage: number; reduce: boolean }) {
  const packet = reduce
    ? { opacity: 1 }
    : { left: stage === 0 ? ["8%", "28%"] : stage === 1 ? ["28%", "50%"] : stage === 2 ? ["50%", "74%"] : ["74%", "94%"] };

  return (
    <div className="intro-loader__scene-visual intro-loader__scene-visual--full">
      <div className="intro-loader__network">
        <svg viewBox="0 0 900 420" fill="none" aria-hidden>
          <defs>
            <linearGradient id="introFlow" x1="70" y1="210" x2="830" y2="210" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A78BFA" />
              <stop offset=".5" stopColor="#8B5CF6" />
              <stop offset="1" stopColor="#DDD6FE" />
            </linearGradient>
          </defs>
          <path d="M80 210 C190 210 190 90 330 90 S500 210 610 210 S710 330 820 210" stroke="#8B5CF6" strokeOpacity=".18" strokeWidth="2" />
          <path d="M80 210 C190 210 190 330 330 330 S500 210 610 210 S710 90 820 210" stroke="#8B5CF6" strokeOpacity=".18" strokeWidth="2" />
          <motion.path d="M80 210 C190 210 190 90 330 90 S500 210 610 210 S710 330 820 210" stroke="url(#introFlow)" strokeWidth="4" strokeLinecap="round" strokeDasharray="12 18" animate={reduce ? undefined : { strokeDashoffset: [0, -60] }} transition={{ duration: .8, repeat: Infinity, ease: "linear" }} />
          <motion.path d="M80 210 C190 210 190 330 330 330 S500 210 610 210 S710 90 820 210" stroke="url(#introFlow)" strokeWidth="4" strokeLinecap="round" strokeDasharray="12 18" animate={reduce ? undefined : { strokeDashoffset: [0, -60] }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
        </svg>

        {[
          ["10%", "50%", "MAIL"],
          ["37%", "22%", "AI"],
          ["67%", "50%", "CRM"],
          ["91%", "50%", "READY"],
        ].map(([left, top, label], index) => (
          <motion.div
            key={label}
            className="intro-loader__process-node"
            style={{ left, top }}
            animate={reduce ? undefined : { y: [0, index % 2 ? -7 : 5, 0] }}
            transition={{ duration: 2 + index * .2, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="intro-loader__process-pulse" />
            <b>{label}</b>
          </motion.div>
        ))}

        <motion.div
          className="intro-loader__packet"
          animate={packet}
          transition={{ duration: 1.7, ease, repeat: Infinity, repeatType: "mirror" }}
        >
          <span />
        </motion.div>
      </div>

      {stage === 0 && (
        <motion.div className="intro-loader__window intro-loader__window--large" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, ease }}>
          <span className="intro-loader__window-top">INCOMING</span>
          <strong>New client request</strong>
          <div className="intro-loader__fake-lines"><i /><i /><i /></div>
        </motion.div>
      )}

      {stage === 1 && (
        <div className="intro-loader__workflow intro-loader__workflow--large">
          {["Trigger", "AI", "Decision", "Route"].map((label, index) => (
            <motion.div key={label} className="intro-loader__workflow-node" initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * .16, duration: .45, ease }}>
              <span />{label}
            </motion.div>
          ))}
        </div>
      )}

      {stage === 2 && (
        <div className="intro-loader__connection-map">
          {["Gmail", "n8n", "OpenAI", "CRM"].map((label, index) => (
            <motion.div key={label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .14, duration: .4, ease }}>
              <span>{label}</span>
              {index < 3 && <i />}
            </motion.div>
          ))}
        </div>
      )}

      {stage === 3 && (
        <motion.div className="intro-loader__handoff intro-loader__handoff--large" initial={{ opacity: 0, scale: .86 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .65, ease }}>
          <span className="intro-loader__handoff-check">✓</span>
          <strong>Workflow ready</strong>
        </motion.div>
      )}
    </div>
  );
}
