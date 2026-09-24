"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { usePrefs } from "@/components/providers";

export function CustomCursor() {
  const { cursor } = usePrefs();
  const reduce = useReducedMotion();
  const [fine, setFine] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState(false);
  const [label, setLabel] = useState("");
  const glowRef = useRef<HTMLDivElement>(null);
  const hoverKey = useRef("");
  const x = useMotionValue(-120);
  const y = useMotionValue(-120);
  const spring = reduce
    ? { stiffness: 900, damping: 70, mass: 0.2 }
    : { stiffness: 260, damping: 28, mass: 0.55 };
  const ringX = useSpring(x, spring);
  const ringY = useSpring(y, spring);

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

    const onMove = (event: MouseEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      const target = event.target;
      const field =
        target instanceof Element
          ? target.closest("input, textarea, select, [contenteditable='true']")
          : null;
      if (field) {
        setVisible(false);
        if (hoverKey.current) {
          hoverKey.current = "";
          setHover(false);
          setLabel("");
        }
        return;
      }
      setVisible(true);
      if (glowRef.current) {
        glowRef.current.style.background = `radial-gradient(560px circle at ${event.clientX}px ${event.clientY}px, rgba(249,115,22,0.065), transparent 62%)`;
      }
      const zone =
        target instanceof Element
          ? target.closest("a, button, [data-cursor-label], [role='button']")
          : null;
      const nextLabel = zone?.getAttribute("data-cursor-label") ?? "";
      const nextHover = Boolean(zone);
      const key = `${nextHover}:${nextLabel}`;
      if (key !== hoverKey.current) {
        hoverKey.current = key;
        setHover(nextHover);
        setLabel(nextLabel);
      }
    };

    const onLeave = () => setVisible(false);
    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, [cursor, fine, x, y]);

  if (!cursor || !fine) return null;

  const ring = label ? 78 : hover ? 54 : 36;

  return (
    <>
      <div ref={glowRef} className="cursor-glow" aria-hidden />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[120] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          x,
          y,
          opacity: visible ? 1 : 0,
          background: hover ? "#F97316" : "#0F172A",
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[120] grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border"
        style={{
          x: reduce ? x : ringX,
          y: reduce ? y : ringY,
          opacity: visible ? 1 : 0,
        }}
        animate={{
          width: ring,
          height: ring,
          borderColor: hover ? "rgba(249,115,22,0.95)" : "rgba(15,23,42,0.45)",
          backgroundColor: label ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0)",
        }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", stiffness: 340, damping: 28 }
        }
      >
        {label ? (
          <span className="text-[10px] font-semibold tracking-[0.14em] text-ink uppercase">
            {label}
          </span>
        ) : null}
      </motion.div>
    </>
  );
}
