"use client";

import Link from "next/link";
import { useRef, type MouseEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { demos, niches } from "@/data/demos";

export function NicheTiles() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {niches.map((niche, index) => (
        <NicheTile
          key={niche.id}
          id={niche.id}
          index={String(index + 1).padStart(2, "0")}
          short={niche.short}
          label={niche.label}
          summary={niche.summary}
          count={demos.filter((demo) => demo.niche === niche.label).length}
        />
      ))}
    </div>
  );
}

function NicheTile({
  id,
  index,
  short,
  label,
  summary,
  count,
}: {
  id: string;
  index: string;
  short: string;
  label: string;
  summary: string;
  count: number;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  function onMove(event: MouseEvent<HTMLAnchorElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--px", px.toFixed(3));
    el.style.setProperty("--py", py.toFixed(3));
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--px", "0");
    el.style.setProperty("--py", "0");
  }

  return (
    <Link
      ref={ref}
      href={`/demos?niche=${id}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="niche-tile group"
    >
      <span className="niche-index" aria-hidden>
        {index}
      </span>
      <div className="relative z-10 flex h-full min-w-0 flex-col">
        <p className="text-xs font-medium tracking-[0.16em] text-accent-ink uppercase">
          {short}
        </p>
        <h3 className="mt-3 text-xl leading-snug font-medium tracking-tight text-balance">
          {label}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted">{summary}</p>
        <span className="mt-8 inline-flex items-center gap-1 text-sm font-medium">
          {count} demos
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}
