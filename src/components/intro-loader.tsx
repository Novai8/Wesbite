"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

export function IntroLoader() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const key = "rapigents-intro-seen";
    try {
      if (sessionStorage.getItem(key) === "1") {
        setShow(false);
        return;
      }
      sessionStorage.setItem(key, "1");
    } catch {}

    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => setShow(false), reduce ? 700 : 4300);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = "";
    };
  }, [reduce]);

  useEffect(() => {
    if (!show) document.body.style.overflow = "";
  }, [show]);

  const points = "0,176 80,164 160,170 240,138 320,146 400,106 480,118 560,72 640,84 720,42";
  const area = `0,176 ${points.replace(/^0,176 /, "")} 720,190 0,190`;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="intro-loader intro-business"
          role="status"
          aria-label="Rapigents"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: reduce ? 0.2 : 0.55, ease }}
        >
          <motion.div
            className="intro-business__bg"
            animate={reduce ? undefined : { opacity: [0.9, 1, 1], scale: [1.03, 1, 1] }}
            transition={{ duration: 3.8, ease }}
          />

          <div className="intro-business__header">
            <motion.div
              className="intro-business__brand"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
            >
              <span className="intro-business__mark">RA</span>
              <span>RAPIGENTS</span>
            </motion.div>
            <motion.span
              className="intro-business__status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              LIVE SYSTEM
            </motion.span>
          </div>

          <motion.div
            className="intro-business__dashboard"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.9, ease }}
          >
            <div className="intro-business__dashboard-top">
              <div>
                <span>BUSINESS OPERATIONS</span>
                <strong>Automation in motion</strong>
              </div>
              <div className="intro-business__metrics">
                <div><small>LEADS</small><b>+38%</b></div>
                <div><small>TIME SAVED</small><b>24h</b></div>
                <div><small>STATUS</small><b>ACTIVE</b></div>
              </div>
            </div>

            <div className="intro-business__chart">
              <div className="intro-business__grid" />
              <div className="intro-business__ylabels"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div>
              <svg viewBox="0 0 720 190" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="intro-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity=".28" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                  </linearGradient>
                  <filter id="intro-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <polygon points={area} fill="url(#intro-area)" />
                <motion.polyline
                  points={points}
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#intro-glow)"
                  initial={{ pathLength: reduce ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.8, duration: 2.1, ease }}
                />
                {[["160", "170"], ["320", "146"], ["480", "118"], ["640", "84"], ["720", "42"]].map(([cx, cy], i) => (
                  <motion.circle
                    key={cx}
                    cx={cx}
                    cy={cy}
                    r="4"
                    fill="#fff"
                    stroke="#8b5cf6"
                    strokeWidth="3"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.15 + i * 0.28, duration: 0.35, ease }}
                  />
                ))}
              </svg>
              <div className="intro-business__xlabels"><span>INBOX</span><span>AI</span><span>CRM</span><span>FOLLOW-UP</span><span>RESULT</span></div>
            </div>
          </motion.div>

          <div className="intro-business__flow">
            {["CLIENT", "WORKFLOW", "BUSINESS"].map((label, i) => (
              <motion.div
                key={label}
                className="intro-business__flow-item"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.25 + i * 0.22, duration: 0.55, ease }}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>{label}</b>
                {i < 2 && <i />}
              </motion.div>
            ))}
          </div>

          <motion.div
            className="intro-business__wash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1] }}
            transition={{ duration: 4.15, times: [0, 0.78, 1], ease }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
