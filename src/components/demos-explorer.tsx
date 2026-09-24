"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";
import { DemoCard } from "@/components/demo-card";
import { Disclaimer } from "@/components/disclaimer";
import { MediaFrame } from "@/components/media-frame";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  demos,
  filterDemos,
  filtersToQuery,
  getDemo,
  niches,
  parseFilters,
  reliabilityFeatures,
  workflowTypes,
  type FilterState,
} from "@/data/demos";
import { workflowMailto } from "@/lib/site";
import { cn } from "@/lib/utils";

const emptyFilters: FilterState = {
  q: "",
  niche: "all",
  tags: [],
  rel: [],
  preview: null,
};

export function DemosExplorer({ initial }: { initial: FilterState }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [filters, setFilters] = useState(initial);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      setFilters(
        parseFilters({
          q: params.get("q") ?? undefined,
          niche: params.get("niche") ?? undefined,
          tag: params.getAll("tag"),
          rel: params.getAll("rel"),
          preview: params.get("preview") ?? undefined,
        }),
      );
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const filtered = useMemo(() => filterDemos(filters), [filters]);
  const preview = filters.preview ? getDemo(filters.preview) : undefined;

  function writeUrl(next: FilterState, mode: "push" | "replace") {
    const query = filtersToQuery(next);
    const href = query ? `/demos?${query}` : "/demos";
    if (mode === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }

  function update(next: FilterState, mode: "push" | "replace" = "replace") {
    setFilters(next);
    if (timer.current) window.clearTimeout(timer.current);
    if (mode === "push") {
      writeUrl(next, "push");
      return;
    }
    timer.current = window.setTimeout(() => writeUrl(next, "replace"), 160);
  }

  function toggleList(list: string[], value: string) {
    return list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];
  }

  function openPreview(slug: string) {
    const next = { ...filters, preview: slug };
    update(next, filters.preview ? "replace" : "push");
  }

  function closePreview() {
    if (!filters.preview) return;
    const next = { ...filters, preview: null };
    setFilters(next);
    writeUrl(next, "replace");
  }

  const nicheOptions = [
    { id: "all" as const, label: "All", count: demos.length },
    ...niches.map((niche) => ({
      id: niche.id,
      label: niche.short,
      count: demos.filter((demo) => demo.niche === niche.label).length,
    })),
  ];

  return (
    <div>
      <div className="surface p-3 sm:p-4">
        <label className="relative block">
          <span className="sr-only">Search demos</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            value={filters.q}
            onChange={(event) =>
              update({ ...filters, q: event.target.value, preview: null })
            }
            placeholder="Search title, problem, or output"
            className="field pl-10"
            type="search"
          />
        </label>

        <div className="mt-3 flex flex-col gap-3">
          <NichePills
            value={filters.niche}
            options={nicheOptions}
            onChange={(niche) =>
              update({ ...filters, niche, preview: filters.preview })
            }
          />
          <ChipRow
            label="Workflow type"
            options={workflowTypes}
            selected={filters.tags}
            onToggle={(tag) =>
              update({
                ...filters,
                tags: toggleList(filters.tags, tag),
              })
            }
          />
          <ChipRow
            label="Reliability"
            options={reliabilityFeatures}
            selected={filters.rel}
            onToggle={(item) =>
              update({
                ...filters,
                rel: toggleList(filters.rel, item),
              })
            }
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {filtered.length} of {demos.length} workflows
          <span className="text-slate-400"> · any selected chip</span>
        </p>
        <button
          type="button"
          className="btn btn-ghost h-10 px-3 text-sm"
          onClick={() => update({ ...emptyFilters }, "replace")}
        >
          Clear filters
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="surface mt-5 px-6 py-14 text-center">
          <p className="text-lg font-medium tracking-tight">No demos match</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Try a shorter search, or clear the niche and chips. Every workflow
            in this library is still on the page when filters are reset.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-6"
            data-cursor="invert"
            onClick={() => update({ ...emptyFilters }, "replace")}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="card-grid mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.map((demo, index) => (
              <motion.div
                key={demo.slug}
                layout={false}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                transition={{
                  duration: 0.32,
                  delay: Math.min(index * 0.03, 0.18),
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <DemoCard demo={demo} onSelect={() => openPreview(demo.slug)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && closePreview()}>
        {preview ? (
          <DialogContent className="max-h-[min(86vh,780px)] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="text-xl leading-snug font-medium tracking-tight text-balance">
                  {preview.title}
                </DialogTitle>
                <DialogDescription className="mt-2 text-sm leading-relaxed text-muted">
                  {preview.shortProblem}
                </DialogDescription>
              </div>
              <DialogCloseButton />
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Badge tone="accent">{preview.niche}</Badge>
              {preview.workflowTypeTags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
            <div className="mt-5">
              <MediaFrame
                title={preview.title}
                videoUrl={preview.videoUrl}
                thumbnailUrl={preview.thumbnailUrl}
              />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-paper p-4">
                <p className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase">
                  Before
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink">
                  {preview.beforeSummary}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-paper p-4">
                <p className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase">
                  After
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink">
                  {preview.afterSummary}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/demos/${preview.slug}`} data-cursor-label="Open">
                  Open details
                </Link>
              </Button>
              {preview.youtubeUrl ? (
                <a
                  href={preview.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary h-12 px-5 text-[15px]"
                >
                  Watch on YouTube
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : null}
              <Button asChild variant="secondary">
                <a href={workflowMailto(preview.title)}>Request this workflow</a>
              </Button>
            </div>
            <Disclaimer className="mt-4" />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function NichePills({
  value,
  options,
  onChange,
}: {
  value: FilterState["niche"];
  options: { id: FilterState["niche"]; label: string; count: number }[];
  onChange: (id: FilterState["niche"]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0, ready: false });

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>("[data-active='true']");
      if (!active) return;
      setBox({
        x: active.offsetLeft,
        y: active.offsetTop,
        w: active.offsetWidth,
        h: active.offsetHeight,
        ready: true,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [value, options.length]);

  return (
    <div>
      <p className="mb-2 text-[11px] font-medium tracking-[0.16em] text-slate-500 uppercase">
        Niche
      </p>
      <div
        ref={ref}
        role="tablist"
        aria-label="Niche"
        className="relative flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1"
      >
        {box.ready ? (
          <motion.span
            aria-hidden
            className="absolute rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-accent-line"
            initial={false}
            animate={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 420, damping: 34 }
            }
          />
        ) : null}
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-active={active}
              className={cn(
                "relative z-10 rounded-xl px-3 py-2 text-sm font-medium text-slate-600",
                active && "text-ink",
              )}
              onClick={() => onChange(option.id)}
            >
              {option.label}
              <span className="ml-1.5 font-mono text-[11px] text-slate-400">
                {option.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChipRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium tracking-[0.16em] text-slate-500 uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(option)}
              className={cn("filter-chip", active && "is-on")}
              data-cursor={active ? "invert" : undefined}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
