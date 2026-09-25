"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion, useSpring, useMotionValue } from "framer-motion";

export function CursorField() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const trailX = useMotionValue(0);
  const trailY = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 85, damping: 24, mass: 0.7 });
  const springY = useSpring(y, { stiffness: 85, damping: 24, mass: 0.7 });
  const slowX = useSpring(trailX, { stiffness: 38, damping: 25, mass: 1.2 });
  const slowY = useSpring(trailY, { stiffness: 38, damping: 25, mass: 1.2 });

  useEffect(() => {
    if (reduce) return;

    const root = rootRef.current;
    if (!root) return;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      x.set(event.clientX);
      y.set(event.clientY);
      trailX.set(event.clientX);
      trailY.set(event.clientY);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, trailX, trailY, x, y]);

  return (
    <div ref={rootRef} className="cursor-field" aria-hidden="true">
      <div className="cursor-field__grid" />
      <motion.div
        className="cursor-field__orb cursor-field__orb--main"
        style={{ left: springX, top: springY }}
      />
      <motion.div
        className="cursor-field__orb cursor-field__orb--trail"
        style={{ left: slowX, top: slowY }}
      />
      <div className="cursor-field__glow cursor-field__glow--one" />
      <div className="cursor-field__glow cursor-field__glow--two" />
    </div>
  );
}
