"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const steps = [
  { key: "inbox", label: "Inbox", detail: "New enquiry received", metric: "1 message" },
  { key: "ai", label: "AI", detail: "Classifying the request", metric: "Analyzing" },
  { key: "decision", label: "Decision", detail: "Routing the next action", metric: "Matched" },
  { key: "crm", label: "CRM", detail: "Updating the record", metric: "Synced" },
  { key: "handoff", label: "Handoff", detail: "Ready for human review", metric: "Ready" },
];

export function HeroStage() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % steps.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [paused, reduce]);

  const current = steps[active];

  return (
    <div
      className="hero-stage relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="hero-stage__top">
        <div className="hero-stage__title">
          <span className="hero-stage__live-dot" />
          Automation layer
        </div>
        <span className="hero-stage__status">
          <i />
          {paused ? "Paused" : "Running"}
        </span>
      </div>

      <div className="hero-stage__canvas">
        <div className="hero-stage__ambient" />
        <div className="hero-stage__grid" />

        <div className="hero-stage__flow">
          <div className="hero-stage__flow-line" />
          <motion.div
            className="hero-stage__data-packet"
            animate={reduce ? undefined : { left: ["3%", "24%", "48%", "72%", "96%"] }}
            transition={reduce ? undefined : { duration: 7.5, repeat: Infinity, ease: "linear" }}
          />
          {steps.map((step, index) => {
            const isActive = index === active;
            const isDone = index < active;
            return (
              <button
                key={step.key}
                type="button"
                className={`hero-stage__node ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""}`}
                onClick={() => setActive(index)}
                aria-label={`Show ${step.label} automation step`}
              >
                <span className="hero-stage__node-ring">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </span>
                <strong>{step.label}</strong>
              </button>
            );
          })}
        </div>

        <motion.div
          key={current.key}
          className="hero-stage__activity"
          initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="hero-stage__activity-head">
            <span>NOW PROCESSING</span>
            <b>{current.metric}</b>
          </div>
          <div className="hero-stage__activity-main">
            <span className="hero-stage__activity-icon">{String(active + 1).padStart(2, "0")}</span>
            <div>
              <strong>{current.detail}</strong>
              <small>Human review remains in control</small>
            </div>
          </div>
          <div className="hero-stage__activity-bar">
            <motion.span
              animate={{ width: `${Math.max(18, ((active + 1) / steps.length) * 100)}%` }}
              transition={{ duration: 0.45 }}
            />
          </div>
        </motion.div>

        <div className="hero-stage__microcopy">
          <span>Trigger</span>
          <span>→</span>
          <span>AI decision</span>
          <span>→</span>
          <span>Integration</span>
          <span>→</span>
          <span>Review</span>
        </div>
      </div>

      <div className="hero-stage__legend">
        <div>
          <span>LIVE WORKFLOW</span>
          <b>Click a node to inspect the flow</b>
        </div>
        <div className="hero-stage__legend-state">
          <i />
          {paused ? "Interaction mode" : "Auto-running"}
        </div>
      </div>
    </div>
  );
}
