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
    const timer = window.setTimeout(() => setShow(false), reduce ? 850 : 5200);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = "";
    };
  }, [reduce]);

  useEffect(() => {
    if (!show) document.body.style.overflow = "";
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="intro-loader intro-sunrise"
          role="status"
          aria-label="Rapigents"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.015 }}
          transition={{ duration: reduce ? 0.2 : 0.65, ease }}
        >
          <motion.div
            className="intro-sunrise__sky"
            animate={reduce ? undefined : { backgroundColor: ["#07070b", "#111018", "#eeeef2", "#f8f8fa"] }}
            transition={{ duration: 4.35, times: [0, .3, .78, 1], ease }}
          />

          <motion.div
            className="intro-sunrise__sun"
            initial={{ y: "32vh", scale: .7, opacity: .2 }}
            animate={reduce ? { y: "10vh", scale: .9, opacity: .75 } : { y: ["32vh", "22vh", "10vh"], scale: [.7, .86, 1], opacity: [.2, .7, 1] }}
            transition={{ duration: 3.5, times: [0, .55, 1], ease }}
          />

          <div className="intro-sunrise__horizon" aria-hidden>
            <motion.div
              className="intro-sunrise__glow"
              animate={reduce ? undefined : { opacity: [0, .2, .55, .25], scaleX: [0.7, 1, 1.2, 1.35] }}
              transition={{ duration: 4.2, times: [0, .35, .72, 1], ease }}
            />
          </div>

          <motion.div
            className="intro-sunrise__brand"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: .7, duration: .9, ease }}
          >
            <span className="intro-sunrise__mark">RA</span>
            <span>RAPIGENTS</span>
          </motion.div>

          <motion.div
            className="intro-sunrise__word"
            initial={{ opacity: 0, y: 18, letterSpacing: ".28em" }}
            animate={reduce ? { opacity: .75, y: 0, letterSpacing: ".16em" } : { opacity: [0, 1, 0], y: [18, 0, -8], letterSpacing: [".28em", ".16em", ".16em"] }}
            transition={{ duration: 4.1, times: [0, .55, 1], ease }}
          >
            AUTOMATION
          </motion.div>

          <motion.div
            className="intro-sunrise__surface"
            initial={{ opacity: 0, y: 28, scale: .96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 3.75, duration: 1.1, ease }}
          >
            <span /><span /><span />
          </motion.div>

          <motion.div
            className="intro-sunrise__wash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1] }}
            transition={{ duration: 5.1, times: [0, .72, 1], ease }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
