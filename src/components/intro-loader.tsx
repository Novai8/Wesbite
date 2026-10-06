"use client";

import { useEffect, useState } from "react";

export function IntroLoader() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setVisible(false), reduce ? 350 : 1750);
    return () => window.clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className="sunrise" role="status" aria-label="Loading Rapigents">
      <span className="sunrise-glow" aria-hidden="true" />
      <span className="sunrise-line" aria-hidden="true" />
      <div className="sunrise-text">
        <strong>RAPIGENTS</strong>
        <span>WORK, MADE VISIBLE.</span>
      </div>
    </div>
  );
}
