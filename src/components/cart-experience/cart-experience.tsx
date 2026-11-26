"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const CartStage = dynamic(
  () => import("./cart-stage").then((module) => module.CartStage),
  { ssr: false, loading: () => null },
);

type Capability = "pending" | "ready" | "unsupported" | "reduced";

type NavigatorWithMemory = Navigator & { deviceMemory?: number };

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) ??
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false });
    if (!context) return false;

    const lose = context.getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function isLowPowerDevice(): boolean {
  const memory = (navigator as NavigatorWithMemory).deviceMemory;
  return typeof memory === "number" && memory <= 2;
}

export function CartExperience() {
  const [capability, setCapability] = useState<Capability>("pending");
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => {
      if (motionQuery.matches) {
        setCapability("reduced");
        return;
      }
      setCapability(detectWebGL() ? "ready" : "unsupported");
    };

    decide();
    motionQuery.addEventListener("change", decide);
    return () => motionQuery.removeEventListener("change", decide);
  }, []);

  useEffect(() => {
    if (capability !== "ready" || isLowPowerDevice()) return;

    let cancelled = false;
    const start = () => {
      if (!cancelled) setMounted(true);
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const supportsIdle = typeof idleWindow.requestIdleCallback === "function";
    const idleId = supportsIdle
      ? idleWindow.requestIdleCallback!(start, { timeout: 1200 })
      : window.setTimeout(start, 350);

    return () => {
      cancelled = true;
      if (supportsIdle) {
        idleWindow.cancelIdleCallback?.(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, [capability]);

  useEffect(() => {
    const onVisibility = () => {
      hiddenRef.current = document.hidden;
      setHidden(document.hidden);
    };
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (capability === "reduced") {
    return (
      <div className="cart-stage" aria-hidden="true" data-cart-stage="static">
        <div className="cart-stage-inner">
          <CartStage mode="static" />
        </div>
      </div>
    );
  }

  if (capability !== "ready" || !mounted) return null;

  return (
    <div
      className="cart-stage"
      data-cart-stage="fyndra"
      aria-hidden="true"
      data-paused={hidden ? "true" : "false"}
    >
      <div className="cart-stage-inner" data-hidden={hidden ? "true" : "false"}>
        <CartStage mode="interactive" paused={hidden} />
      </div>
    </div>
  );
}
