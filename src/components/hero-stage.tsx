"use client";

import { motion, useReducedMotion } from "framer-motion";

const points = [
  { x: "12%", y: "72%", label: "Capture" },
  { x: "34%", y: "54%", label: "Qualify" },
  { x: "56%", y: "43%", label: "Route" },
  { x: "78%", y: "24%", label: "Follow up" },
];

export function HeroStage() {
  const reduce = useReducedMotion();

  return (
    <div className="hero-stage relative overflow-hidden">
      <div className="hero-stage__top">
        <span>Automation layer</span>
        <span className="hero-stage__status">
          <i />
          Active
        </span>
      </div>

      <div className="hero-stage__canvas" aria-hidden="true">
        <div className="hero-stage__rings" />
        <svg viewBox="0 0 720 420" className="hero-stage__svg" fill="none">
          <defs>
            <linearGradient id="heroGraph" x1="45" y1="370" x2="665" y2="55" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6D28D9" />
              <stop offset="0.55" stopColor="#8B5CF6" />
              <stop offset="1" stopColor="#C4B5FD" />
            </linearGradient>
            <linearGradient id="heroFill" x1="0" y1="420" x2="0" y2="30" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7C3AED" stopOpacity="0" />
              <stop offset="1" stopColor="#7C3AED" stopOpacity="0.18" />
            </linearGradient>
          </defs>

          <g opacity="0.2">
            {[80, 160, 240, 320, 400].map((y) => (
              <line key={y} x1="35" x2="685" y1={y} y2={y} stroke="currentColor" strokeDasharray="3 10" />
            ))}
            {[110, 250, 390, 530, 670].map((x) => (
              <line key={x} y1="38" y2="382" x1={x} x2={x} stroke="currentColor" strokeDasharray="2 12" />
            ))}
          </g>

          <motion.path
            d="M 40 368 C 96 360, 126 335, 176 342 C 242 351, 265 289, 328 281 C 392 273, 418 252, 474 244 C 530 236, 548 168, 604 144 C 635 130, 662 95, 684 52"
            stroke="url(#heroGraph)"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: reduce ? 0 : 1.7, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path
            d="M 40 368 C 96 360, 126 335, 176 342 C 242 351, 265 289, 328 281 C 392 273, 418 252, 474 244 C 530 236, 548 168, 604 144 C 635 130, 662 95, 684 52 L 684 382 L 40 382 Z"
            fill="url(#heroFill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0 : 0.7, duration: 1.1 }}
          />
          {[{cx:176,cy:342},{cx:328,cy:281},{cx:474,cy:244},{cx:604,cy:144},{cx:684,cy:52}].map((p, i) => (
            <motion.g
              key={p.cx}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduce ? 0 : 0.35 + i * 0.3, duration: 0.35 }}
              style={{ originX: p.cx, originY: p.cy }}
            >
              <circle cx={p.cx} cy={p.cy} r="10" fill="#8B5CF6" fillOpacity="0.16" />
              <circle cx={p.cx} cy={p.cy} r="4" fill="#EDE9FE" />
            </motion.g>
          ))}
        </svg>

        <motion.div
          className="hero-stage__signal hero-stage__signal--capture"
          animate={reduce ? undefined : { y: [0, -5, 0] }}
          transition={reduce ? undefined : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="hero-stage__signal-dot" />
          Lead captured
        </motion.div>

        <motion.div
          className="hero-stage__signal hero-stage__signal--route"
          animate={reduce ? undefined : { y: [0, 5, 0] }}
          transition={reduce ? undefined : { duration: 4.1, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="hero-stage__signal-dot" />
          AI routes the next step
        </motion.div>

        <motion.div
          className="hero-stage__signal hero-stage__signal--review"
          animate={reduce ? undefined : { y: [0, -4, 0] }}
          transition={reduce ? undefined : { duration: 3.7, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="hero-stage__signal-dot" />
          Human review stays in control
        </motion.div>
      </div>

      <div className="hero-stage__legend">
        {points.map((point, index) => (
          <motion.div
            key={point.label}
            className="hero-stage__legend-item"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.35 + index * 0.12, duration: 0.35 }}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <b>{point.label}</b>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
