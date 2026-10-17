"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

type InteractiveCardProps = {
  children: ReactNode;
  className?: string;
  label?: string;
};

export function InteractiveCard({ children, className = "", label }: InteractiveCardProps) {
  const cardRef = useRef<HTMLElement>(null);

  function move(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--rg-card-tilt-x", (y * -4.5).toFixed(2) + "deg");
    card.style.setProperty("--rg-card-tilt-y", (x * 5.5).toFixed(2) + "deg");
    card.style.setProperty("--rg-card-glow-x", ((x + 0.5) * 100).toFixed(1) + "%");
    card.style.setProperty("--rg-card-glow-y", ((y + 0.5) * 100).toFixed(1) + "%");
  }

  function reset() {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--rg-card-tilt-x", "0deg");
    card.style.setProperty("--rg-card-tilt-y", "0deg");
    card.style.setProperty("--rg-card-glow-x", "50%");
    card.style.setProperty("--rg-card-glow-y", "50%");
  }

  return (
    <article
      ref={cardRef}
      className={className + " rg-interactive-card"}
      onPointerMove={move}
      onPointerLeave={reset}
      aria-label={label}
    >
      {children}
    </article>
  );
}
