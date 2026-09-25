"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

export function IntroLoader() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(true);

  useEffect(() => {
    let active = true;
    const key = "rapigents-intro-seen";

    try {
      if (sessionStorage.getItem(key) === "1") {
        setShow(false);
        return;
      }
      sessionStorage.setItem(key, "1");
    } catch {
      // If storage is unavailable, still show the intro once for this render.
    }

    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      if (active) setShow(false);
    }, reduce ? 900 : 3650);

    return () => {
      active = false;
      window.clearTimeout(timer);
      document.body.style.overflow = "";
    };
  }, [reduce]);

  useEffect(() => {
    if (!show) {
      document.body.style.overflow = "";
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className="intro-loader"
          role="status"
          aria-label="Loading Rapigents"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: reduce ? 1 : 1.025,
            filter: reduce ? "none" : "blur(10px)",
          }}
          transition={{ duration: reduce ? 0.18 : 0.62, ease }}
        >
          <div className="intro-loader__grain" aria-hidden />
          <motion.div
            className="intro-loader__halo"
            aria-hidden
            initial={{ scale: 0.7, opacity: 0 }}
            animate={
              reduce
                ? { scale: 1, opacity: 0.22 }
                : { scale: 1, opacity: [0, 0.32, 0.18, 0.24] }
            }
            transition={{
              duration: reduce ? 0.2 : 2.4,
              ease,
              times: reduce ? undefined : [0, 0.32, 0.68, 1],
            }}
          />

          <div className="intro-loader__content">
            <motion.div
              className="intro-loader__brand"
              initial={reduce ? { opacity: 1 } : { opacity: 0, y: 12, filter: "blur(7px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: reduce ? 0 : 0.7, ease }}
            >
              <div className="intro-loader__mark intro-loader__mark--image" aria-hidden>
                <Image src="/brand/logo-mark.svg" alt="" width={88} height={53} priority />
              </div>
              <div>
                <p className="intro-loader__eyebrow">RAPIGENTS</p>
                <p className="intro-loader__tag">AI workflow automation</p>
              </div>
            </motion.div>

            <div className="intro-loader__visual" aria-hidden>
              <svg
                viewBox="0 0 1100 520"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="intro-loader__graph"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="introLine" x1="90" y1="460" x2="990" y2="70" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6D28D9" />
                    <stop offset="0.52" stopColor="#8B5CF6" />
                    <stop offset="1" stopColor="#C4B5FD" />
                  </linearGradient>
                  <linearGradient id="introFill" x1="0" y1="520" x2="0" y2="40" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#7C3AED" stopOpacity="0" />
                    <stop offset="1" stopColor="#7C3AED" stopOpacity="0.18" />
                  </linearGradient>
                  <filter id="introGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="12" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <g opacity="0.18">
                  {[90, 170, 250, 330, 410].map((y) => (
                    <line
                      key={y}
                      x1="50"
                      x2="1050"
                      y1={y}
                      y2={y}
                      stroke="#C4B5FD"
                      strokeDasharray="3 12"
                    />
                  ))}
                  {[140, 300, 460, 620, 780, 940].map((x) => (
                    <line
                      key={x}
                      y1="52"
                      y2="448"
                      x1={x}
                      x2={x}
                      stroke="#A78BFA"
                      strokeDasharray="2 14"
                    />
                  ))}
                </g>

                <motion.path
                  d="M 58 440 C 150 436, 188 425, 246 402 C 320 372, 354 405, 432 344 C 516 277, 555 298, 626 254 C 709 202, 762 228, 835 152 C 910 74, 969 116, 1040 58"
                  stroke="url(#introLine)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  filter="url(#introGlow)"
                  initial={{ pathLength: 0, opacity: 0.9 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: reduce ? 0.01 : 2.1, ease }}
                />

                <motion.path
                  d="M 58 440 C 150 436, 188 425, 246 402 C 320 372, 354 405, 432 344 C 516 277, 555 298, 626 254 C 709 202, 762 228, 835 152 C 910 74, 969 116, 1040 58 L 1040 470 L 58 470 Z"
                  fill="url(#introFill)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: reduce ? 0.08 : 1 }}
                  transition={{ delay: reduce ? 0 : 1.2, duration: 1.2, ease }}
                />

                {[
                  { cx: 246, cy: 402, delay: 1.1 },
                  { cx: 432, cy: 344, delay: 1.45 },
                  { cx: 626, cy: 254, delay: 1.8 },
                  { cx: 835, cy: 152, delay: 2.1 },
                  { cx: 1040, cy: 58, delay: 2.35 },
                ].map((point) => (
                  <motion.g
                    key={point.cx}
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: reduce ? 0 : point.delay, duration: reduce ? 0 : 0.45, ease }}
                    style={{ originX: point.cx, originY: point.cy }}
                  >
                    <circle cx={point.cx} cy={point.cy} r="12" fill="#7C3AED" fillOpacity="0.15" />
                    <circle cx={point.cx} cy={point.cy} r="5" fill="#EDE9FE" />
                  </motion.g>
                ))}
              </svg>

              <motion.div
                className="intro-loader__metric intro-loader__metric--left"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduce ? 0 : 1, duration: 0.45, ease }}
              >
                <span className="intro-loader__metric-label">REPETITIVE WORK</span>
                <strong>↓</strong>
              </motion.div>

              <motion.div
                className="intro-loader__metric intro-loader__metric--right"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduce ? 0 : 2.05, duration: 0.45, ease }}
              >
                <span className="intro-loader__metric-label">ROOM TO GROW</span>
                <strong>↑</strong>
              </motion.div>

              <div className="intro-loader__chat intro-loader__chat--one">
                <motion.span
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 1.35, duration: 0.4, ease }}
                >
                  Lead captured
                </motion.span>
              </div>
              <div className="intro-loader__chat intro-loader__chat--two">
                <motion.span
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 1.75, duration: 0.4, ease }}
                >
                  AI decision
                </motion.span>
              </div>
              <div className="intro-loader__chat intro-loader__chat--three">
                <motion.span
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 2.12, duration: 0.4, ease }}
                >
                  Workflow complete
                </motion.span>
              </div>
            </div>

            <motion.div
              className="intro-loader__footer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 2.45, duration: 0.5, ease }}
            >
              <span>01</span>
              <div className="intro-loader__progress">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: reduce ? 0.1 : 2.8, ease }}
                />
              </div>
              <span>BUILD → REVIEW → GROW</span>
            </motion.div>
          </div>

          <motion.div
            className="intro-loader__wipe"
            aria-hidden
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: reduce ? 0.15 : 2.9, duration: reduce ? 0.2 : 0.55, ease }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
