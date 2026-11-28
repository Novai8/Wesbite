"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { CategoryTab } from "@/lib/category-tabs";
import type { Category, Product } from "@/lib/types";

/**
 * Electronics showcase.
 *
 * The video is ONE pre-merged file (`/videos/category/electronics.mp4`) built
 * from the three supplied clips in the order laptop → phone → watch.
 *
 * Each segment is a still of that clip's finished product, then the clip. The
 * still is taken from the clip's own last frame (the transport streams carry
 * burned-in text, so no other frame is honest), and the label is shown over it,
 * so the title on screen names the product the viewer is looking at. At the end
 * the player restarts one clip length early, inside the watch clip's own still
 * tail, so the jump lands between two near-identical frames instead of cutting
 * in mid-motion.
 *
 * Labels rotate with the clip, not just with the arrows: the arrows step by
 * clip, so "NEXT" skips the hold it is sitting in.
 */

const CLIP_SECONDS = 10.0417;
const FPS = 24;

type Clip = {
  poster: string;
  label: string;
  /** Seconds of finished-product still shown BEFORE this clip starts. */
  hold: number;
};

const BASE = "/videos/category";

/** Order is deliberate: laptop, phone, watch. */
const VIDEO_SRC = `${BASE}/electronics.mp4`;

const CLIPS: Clip[] = [
  { poster: `${BASE}/laptop-poster.jpg`, label: "Laptop", hold: 2.8 },
  { poster: `${BASE}/phone-poster.jpg`, label: "Phone", hold: 5.8 },
  { poster: `${BASE}/watch-poster.jpg`, label: "Watch", hold: 9.8 },
];

// A cycle is three (hold + clip) pairs.
const CYCLE_SECONDS = CLIPS.reduce((total, clip) => total + clip.hold + CLIP_SECONDS, 0);

/** Each segment is [still of the finished product][the clip], in order. */
const SEGMENT_STARTS = (() => {
  const starts: number[] = [];
  let cursor = 0;
  for (const clip of CLIPS) {
    starts.push(cursor);
    cursor += clip.hold + CLIP_SECONDS;
  }
  return starts;
})();

function clipNumber(time: number): number {
  let index = 0;
  for (let cursor = 0; cursor < CLIPS.length; cursor += 1) {
    if (time + 1 / FPS >= SEGMENT_STARTS[cursor]) index = cursor;
  }
  return index;
}

/** Hand back to the start inside the last clip, one clip length before the end. */
const RELAY_TIME = CLIP_SECONDS;

type Props = {
  tab: CategoryTab;
  products: Product[];
  shelves: Category[];
};

export function CategoryShowcase({ tab, products, shelves }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [clipIndex, setClipIndex] = useState(0);
  const [motionOk, setMotionOk] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotionOk(!query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  /** Move to a clip boundary; the `timeupdate` handler then re-reads the label. */
  const jumpTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    if (motionOk) void video.play().catch(() => undefined);
  }, [motionOk]);

  const step = useCallback(
    (direction: 1 | -1) => {
      const video = videoRef.current;
      if (!video) return;
      // An arrow moves between items and always lands on the hold, so the
      // picture changes on every press. Only an arrow walks backwards; the
      // auto loop always runs forward.
      const current = clipNumber(video.currentTime);
      const next = (current + direction + CLIPS.length) % CLIPS.length;
      setClipIndex(next);
      jumpTo(SEGMENT_STARTS[next]);
    },
    [jumpTo],
  );

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime;
    const next = clipNumber(time);
    setClipIndex((previous) => (previous === next ? previous : next));
    // Restart one clip length before the end, inside the last clip's still
    // tail, so the jump lands between two near-identical frames.
    if (time >= CYCLE_SECONDS - RELAY_TIME) jumpTo(SEGMENT_STARTS[0]);
  }, [jumpTo]);

  const handleEnded = useCallback(() => jumpTo(SEGMENT_STARTS[0]), [jumpTo]);

  const firstShelf = shelves[0];

  return (
    <section className="category-showcase" aria-labelledby="category-showcase-title">
      <div className="category-stage">
        <video
          ref={videoRef}
          className="category-stage-video"
          poster={CLIPS[0].poster}
          autoPlay={motionOk}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          data-playing={motionOk ? "true" : "false"}
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>

        <div className="category-stage-scrim" aria-hidden="true" />

        <div className="category-stage-top">
          <div className="category-stage-title" role="group" aria-label="Category">
            <button
              type="button"
              className="category-arrow"
              onClick={() => step(-1)}
              aria-label="Previous category"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
                <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h2 id="category-showcase-title" className="category-stage-word">
              Electronics
            </h2>
            <button
              type="button"
              className="category-arrow"
              onClick={() => step(1)}
              aria-label="Next category"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
                <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <p className="category-stage-now" aria-live="polite">
            <span className="category-stage-now-label">Now showing</span>
            <span>{CLIPS[clipIndex].label}</span>
            <span className="category-stage-count">
              {clipIndex + 1} / {CLIPS.length}
            </span>
          </p>
        </div>

        {!motionOk ? (
          <div className="category-stage-play">
            <button type="button" className="category-play" onClick={() => jumpTo(SEGMENT_STARTS[0])}>
              Play the walkthrough
            </button>
          </div>
        ) : null}

        <div className="category-stage-dots" role="tablist" aria-label="Walkthrough clip">
          {CLIPS.map((clip, index) => (
            <button
              key={clip.label}
              type="button"
              role="tab"
              aria-selected={index === clipIndex}
              aria-label={`Show ${clip.label}`}
              className="category-dot"
              data-active={index === clipIndex ? "true" : "false"}
              onClick={() => {
                setClipIndex(index);
                jumpTo(SEGMENT_STARTS[index]);
              }}
            />
          ))}
        </div>
      </div>

      <div className="container-page category-showcase-body">
        <header className="category-showcase-head">
          <p className="eyebrow">{shelves.length} shelves</p>
          <h1 className="category-showcase-name">{tab.name}</h1>
          <p className="category-showcase-blurb">{tab.blurb}</p>
          <ul className="category-shelf-chips">
            {shelves.map((shelf) => (
              <li key={shelf.slug}>
                <Link href={`/discover?category=${shelf.slug}`}>{shelf.name}</Link>
              </li>
            ))}
          </ul>
        </header>

        {products.length > 0 ? (
          <div className="category-product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="category-empty">
            Nothing approved on these shelves yet.{" "}
            <Link href="/discover">Open the full catalogue</Link>.
          </p>
        )}

        {firstShelf ? (
          <p className="category-showcase-foot">
            Every record below is approved, has a source price and a stated reason.{" "}
            <Link href={`/discover?category=${firstShelf.slug}`}>
              Browse {firstShelf.name} on Discover
            </Link>
            .
          </p>
        ) : null}
      </div>
    </section>
  );
}
