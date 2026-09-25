"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";

const INTERACTIVE_SELECTOR =
  "a, button, [role='button'], summary, [data-cursor='pointer'], input[type='checkbox'], input[type='radio'], label";

const TEXT_FIELD_SELECTOR = "input, textarea, select, [contenteditable='true']";

/**
 * Cursor
 *
 * A smooth, spring-driven circular cursor that replaces the native pointer.
 * A slower trailing ring and a fast-tracking center dot combine for an
 * "ultra smooth" feel. Colors are theme-driven (purple + white) via CSS
 * variables in globals.css, and automatically match light/dark mode.
 *
 * Mount this once, near the root of the app (see layout.tsx). It no-ops
 * on touch devices and respects prefers-reduced-motion.
 */
export function Cursor() {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);

  // Trailing outer ring: slower spring for a soft, floaty follow.
  const ringX = useSpring(x, { stiffness: 260, damping: 26, mass: 0.6 });
  const ringY = useSpring(y, { stiffness: 260, damping: 26, mass: 0.6 });
  // Snappy center dot: tighter spring so it stays glued to the pointer.
  const dotX = useSpring(x, { stiffness: 900, damping: 40, mass: 0.2 });
  const dotY = useSpring(y, { stiffness: 900, damping: 40, mass: 0.2 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (reduce) return;

    setReady(true);
    document.documentElement.classList.add("has-custom-cursor");

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      x.set(event.clientX);
      y.set(event.clientY);
      setVisible(true);

      const target = event.target;
      if (target instanceof Element) {
        setHovering(Boolean(target.closest(INTERACTIVE_SELECTOR)));
      }
    };

    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);
    const onLeaveWindow = () => setVisible(false);
    const onEnterWindow = () => setVisible(true);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.documentElement.addEventListener("mouseleave", onLeaveWindow);
    document.documentElement.addEventListener("mouseenter", onEnterWindow);

    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("mouseleave", onLeaveWindow);
      document.documentElement.removeEventListener("mouseenter", onEnterWindow);
    };
  }, [reduce, x, y]);

  if (!ready) return null;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="app-cursor"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <motion.span
            className="app-cursor__ring"
            style={{ left: ringX, top: ringY }}
            animate={{
              scale: pressed ? 0.82 : hovering ? 1.9 : 1,
              opacity: hovering ? 0.9 : 1,
            }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
          />
          <motion.span
            className="app-cursor__dot"
            style={{ left: dotX, top: dotY }}
            animate={{
              scale: pressed ? 0.6 : hovering ? 0 : 1,
            }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// Re-exported so callers can check whether the current pointer/device
// supports the custom cursor before rendering cursor-dependent UI.
export function supportsCustomCursor() {
  if (typeof window === "undefined") return false;
  return !window.matchMedia("(pointer: coarse)").matches;
}

export { TEXT_FIELD_SELECTOR };
