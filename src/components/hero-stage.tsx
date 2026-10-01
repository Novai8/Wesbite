"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const steps = [
  { key: "inbox", label: "Inbox", detail: "New enquiry", metric: "Received" },
  { key: "ai", label: "AI", detail: "Classifying", metric: "Running" },
  { key: "decision", label: "Decision", detail: "Routing", metric: "Matched" },
  { key: "crm", label: "CRM", detail: "Updating", metric: "Synced" },
  { key: "handoff", label: "Handoff", detail: "Human review", metric: "Ready" },
];

export function HeroStage() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % steps.length), 1300);
    return () => window.clearInterval(timer);
  }, [reduce]);

  const current = steps[active];

  return (
    <div className="hero-stage relative overflow-hidden">
      <div className="hero-stage__top">
        <div className="hero-stage__title"><span className="hero-stage__live-dot" />Live workflow</div>
        <span className="hero-stage__status"><i />Active</span>
      </div>

      <div className="hero-stage__canvas">
        <div className="hero-stage__ambient" />
        <div className="hero-stage__grid" />

        <div className="hero-stage__flow">
          <div className="hero-stage__flow-line" />
          <motion.div
            className="hero-stage__data-packet"
            animate={reduce ? undefined : { left: ["3%", "24%", "48%", "72%", "96%"] }}
            transition={reduce ? undefined : { duration: 6.5, repeat: Infinity, ease: "linear" }}
          />
          {steps.map((step, index) => (
            <button
              key={step.key}
              type="button"
              className={`hero-stage__node ${index === active ? "is-active" : ""} ${index < active ? "is-done" : ""}`}
              onClick={() => setActive(index)}
              aria-label={step.label}
            >
              <span className="hero-stage__node-ring"><span>{String(index + 1).padStart(2, "0")}</span></span>
              <strong>{step.label}</strong>
            </button>
          ))}
        </div>

        <motion.div
          key={current.key}
          className="hero-stage__activity"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          <div className="hero-stage__activity-head">
            <span>{current.detail}</span>
            <b>{current.metric}</b>
          </div>
          <div className="hero-stage__activity-main">
            <span className="hero-stage__activity-icon">{String(active + 1).padStart(2, "0")}</span>
            <div><strong>{current.label}</strong></div>
          </div>
          <div className="hero-stage__activity-bar">
            <motion.span
              animate={{ width: `${Math.max(18, ((active + 1) / steps.length) * 100)}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </motion.div>
      </div>

      <div className="hero-stage__legend">
        <span>Trigger</span><i /> <span>AI</span><i /> <span>Integration</span><i /> <span>Review</span>
      </div>
    </div>
  );
}
