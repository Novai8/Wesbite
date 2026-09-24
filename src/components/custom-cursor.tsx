"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { usePrefs } from "@/components/providers";

const CURSOR_DARK = "#4C1D95";
const CURSOR_LIGHT = "#FFFFFF";
const HOVER_SELECTOR =
  "a, button, input, textarea, select, summary, [data-cursor~='hover'], [role='button']";
const INVERT_SELECTOR =
  "[data-cursor='invert'], [data-cursor~='invert'], .btn-primary, .filter-chip.is-on, .bg-accent, .text-accent, .text-accent-ink";

export function CustomCursor() {
  const { cursor } = usePrefs();
  const reduce = useReducedMotion();
  const [fine, setFine] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState(false);
  const [invert, setInvert] = useState(false);
  const [label, setLabel] = useState("");
  const glowRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(false);
  const stateKey = useRef("");
  const x = useMotionValue(-80);
  const y = useMotionValue(-80);
  const sx = useSpring(x, { stiffness: 460, damping: 34, mass: 0.32 });
  const sy = useSpring(y, { stiffness: 460, damping: 34, mass: 0.32 });

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setFine(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const active = cursor && fine;
    document.documentElement.classList.toggle("cursor-fx", active);
    return () => document.documentElement.classList.remove("cursor-fx");
  }, [cursor, fine]);

  useEffect(() => {
    if (!cursor || !fine) return;

    function onMove(event: MouseEvent) {
      x.set(event.clientX);
      y.set(event.clientY);
      const glow = glowRef.current;
      if (glow) {
        glow.style.setProperty("--cx", `${event.clientX}px`);
        glow.style.setProperty("--cy", `${event.clientY}px`);
      }
      const target = event.target instanceof Element ? event.target : null;
      const zone = target?.closest(HOVER_SELECTOR) ?? null;
      const labeled = target?.closest("[data-cursor~='hover']");
      const nextLabel = labeled?.getAttribute("data-cursor-label") ?? "";
      const nextHover = Boolean(zone);
      const nextInvert = Boolean(target?.closest(INVERT_SELECTOR));
      const key = `${nextHover}:${nextInvert}:${nextLabel}`;
      if (key !== stateKey.current) {
        stateKey.current = key;
        setHover(nextHover);
        setInvert(nextInvert);
        setLabel(nextLabel);
      }
      if (!visibleRef.current) {
        visibleRef.current = true;
        setVisible(true);
      }
    }

    function onLeave() {
      visibleRef.current = false;
      stateKey.current = "";
      setVisible(false);
      setHover(false);
      setInvert(false);
      setLabel("");
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [cursor, fine, x, y]);

  if (!cursor || !fine) return null;

  return (
    <>
      {reduce ? null : <div ref={glowRef} className="cursor-glow" aria-hidden />}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[120]"
        style={{ x: reduce ? x : sx, y: reduce ? y : sy, opacity: visible ? 1 : 0 }}
      >
        <motion.div
          className="relative"
          style={{ transformOrigin: "0px 0px" }}
          animate={{ scale: hover ? 1.15 : 1 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 30 }}
        >
          <svg width="28" height="32" viewBox="0 0 28 32" className="block overflow-visible">
            <motion.circle
              cx="12"
              cy="14"
              r="13.25"
              fill="none"
              strokeWidth="1"
              initial={false}
              animate={{
                stroke: invert ? CURSOR_LIGHT : CURSOR_DARK,
                opacity: invert ? 0.2 : 0.16,
              }}
              transition={{ duration: reduce ? 0 : 0.2, ease: "easeOut" }}
            />
            <motion.path
              d="M0.4 0.2 L22.6 12.4 Q14.2 19.6 9.8 27.8 Z"
              strokeLinejoin="miter"
              strokeMiterlimit={8}
              initial={false}
              animate={{
                fill: invert ? CURSOR_LIGHT : CURSOR_DARK,
                stroke: invert ? CURSOR_DARK : CURSOR_LIGHT,
                strokeWidth: invert ? 1.15 : 0.8,
              }}
              transition={{ duration: reduce ? 0 : 0.2, ease: "easeOut" }}
            />
          </svg>
          {label ? (
            <span className="pointer-events-none absolute top-3.5 left-6 whitespace-nowrap rounded-full border border-accent-line bg-white px-1.5 py-px text-[9px] leading-4 font-semibold tracking-[0.14em] text-accent-ink uppercase">
              {label}
            </span>
          ) : null}
        </motion.div>
      </motion.div>
    </>
  );
}
