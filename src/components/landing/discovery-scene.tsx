"use client";

// The `/next` entry is an async Server Component; this wrapper defers
// mounting from the client, so it uses the client entry instead.
import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";
import { useEffect, useRef, useState } from "react";
import { discoveryScene } from "@/lib/discovery-scene";
import { SceneLoading } from "./scene-loading";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export function DiscoveryScene() {
  const frame = useRef<HTMLDivElement>(null);
  const app = useRef<Application | null>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  // The scene animates itself, so keep its first frame on screen as a still
  // when the visitor has asked for reduced motion.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(REDUCED_MOTION);
    const sync = () => {
      if (!app.current) return;
      if (query.matches) app.current.stop();
      else app.current.play();
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Leave the scene unmounted until it is near the viewport, so a mid-page
  // anchor visit never pays for a WebGL context it will not show.
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }

    // The hero scene is on the first screen; mount it even if the observer
    // never reports, so the right column can't stay an empty frame.
    const fallback = window.setTimeout(() => setVisible(true), 1200);

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(node);
    return () => {
      window.clearTimeout(fallback);
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={frame}
      className="scene-frame"
      data-ready={ready}
      aria-hidden="true"
    >
      {visible ? (
        <Spline
          scene={discoveryScene.url}
          onLoad={(spline) => {
            app.current = spline;
            const reduce =
              typeof window.matchMedia === "function" &&
              window.matchMedia(REDUCED_MOTION).matches;
            // Let the first frames paint before pausing, or the canvas is blank.
            if (reduce) {
              requestAnimationFrame(() =>
                requestAnimationFrame(() => spline.stop()),
              );
            }
            setReady(true);
          }}
          className="scene-canvas"
        />
      ) : null}
      <SceneLoading />
    </div>
  );
}
