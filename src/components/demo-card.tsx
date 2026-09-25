"use client";

import Link from "next/link";
import { useRef, type MouseEvent, type Ref } from "react";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MediaFrame } from "@/components/media-frame";
import { demoIndex, niches, type Demo } from "@/data/demos";
import { cn } from "@/lib/utils";

function nicheShort(label: Demo["niche"]) {
  return niches.find((niche) => niche.label === label)?.short ?? label;
}

function CardBody({ demo }: { demo: Demo }) {
  const index = String(demoIndex(demo.slug) + 1).padStart(2, "0");
  return (
    <>
      <MediaFrame
        title={demo.title}
        videoUrl={demo.videoUrl}
        thumbnailUrl={demo.thumbnailUrl}
        embed={false}
      />
      <div className="flex min-w-0 flex-1 flex-col px-4 pt-4 pb-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <Badge tone="accent">{nicheShort(demo.niche)}</Badge>
          <span className="font-mono text-xs text-slate-400">{index}</span>
        </div>
        <h3 className="mt-3 text-[1.05rem] leading-snug font-medium tracking-tight text-balance">
          {demo.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
          {demo.shortProblem}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {demo.outputs.map((output) => (
            <Badge key={output}>{output}</Badge>
          ))}
        </div>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-ink">
          View
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
    </>
  );
}

export function DemoCard({
  demo,
  href,
  onSelect,
  className,
}: {
  demo: Demo;
  href?: string;
  onSelect?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement>(null);

  function onMove(event: MouseEvent<HTMLElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--rx", `${(-py * 1.6).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * 1.6).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  const shared = {
    className: cn("demo-card", className),
    onMouseMove: onMove,
    onMouseLeave: onLeave,
  };

  if (href) {
    return (
      <Link
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        aria-label={`View ${demo.title}`}
        {...shared}
      >
        <CardBody demo={demo} />
      </Link>
    );
  }

  return (
    <button
      ref={ref as Ref<HTMLButtonElement>}
      type="button"
      aria-label={`View ${demo.title}`}
      onClick={onSelect}
      {...shared}
    >
      <CardBody demo={demo} />
    </button>
  );
}
