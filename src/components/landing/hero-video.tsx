"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

// "still": the poster frame (t=8s of the source clip) behind the site copy.
// "live": the intro (8→9.5s) plays once, hands off to the seamless loop
// (9→12s, crossfaded seam) which revolves the bag for as long as it plays.
export function HeroVideo() {
  const introRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"still" | "live">("still");
  const [introDone, setIntroDone] = useState(false);
  const [loopPlaying, setLoopPlaying] = useState(false);

  // Scrolling past the first screen arms the video.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const arm = () => setPhase((current) => (current === "still" ? "live" : current));

    if (typeof IntersectionObserver === "undefined") {
      const id = window.setTimeout(arm, 400);
      return () => window.clearTimeout(id);
    }

    // Arm even if the observer never reports, so the hero can't stay frozen.
    const fallback = window.setTimeout(arm, 2500);

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) arm();
      }
    }, { threshold: 0.15 });

    io.observe(node);
    return () => {
      window.clearTimeout(fallback);
      io.disconnect();
    };
  }, []);

  // Reduced motion holds the poster: no clip ever plays.
  useEffect(() => {
    if (phase !== "live") return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia(REDUCED_MOTION).matches
    ) {
      return;
    }
    void introRef.current?.play();
  }, [phase]);

  const onIntroEnded = useCallback(() => {
    setIntroDone(true);
    setLoopPlaying(true);
    const loop = loopRef.current;
    if (loop) {
      loop.currentTime = 0;
      void loop.play();
    }
  }, []);

  return (
    <div ref={sectionRef} className="hero-video" data-phase={phase} aria-hidden="true">
      {/* Poster for the parked frame — optimization would not survive the video swap. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="hero-video-layer hero-video-poster" src="/video/bag-poster.jpg" alt="" />
      <video
        ref={introRef}
        className={`hero-video-layer hero-video-intro${introDone ? " is-done" : ""}`}
        src="/video/bag-intro.mp4"
        muted
        playsInline
        preload="auto"
        onEnded={onIntroEnded}
      />
      <video
        ref={loopRef}
        className={`hero-video-layer hero-video-loop${loopPlaying ? " is-playing" : ""}`}
        src="/video/bag-loop.mp4"
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="hero-video-scrim" />
    </div>
  );
}
