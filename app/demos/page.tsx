import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { DemosExplorer } from "@/components/demos-explorer";
import { parseFilters } from "@/data/demos";

export const metadata: Metadata = {
  title: "Workflow demos",
  description:
    "Problem-first workflow prototypes showing how messy business processes can become visible, reviewable operations.",
};

export default async function DemosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initial = parseFilters(await searchParams);

  return (
    <main id="content">
      <section className="page-hero">
        <div className="container-page page-hero-grid">
          <div>
            <div className="eyebrow-pill">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Prototype library
            </div>
            <h1>Problems turned into operations.</h1>
            <p>
              These demos are deliberately concrete. Each starts with a recurring
              business problem and shows the trigger, decisions, review points,
              outputs and audit trail.
            </p>
            <div className="page-hero-links">
              <Link href="/#analyze">Describe your problem <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              <span>·</span>
              <span>12 workflow patterns</span>
            </div>
          </div>
          <div className="page-hero-aside">
            <div className="page-stat">
              <span className="page-stat-number">01</span>
              <span>Problem first</span>
            </div>
            <div className="page-stat">
              <span className="page-stat-number">02</span>
              <span>Prototype before integration</span>
            </div>
            <div className="page-stat">
              <span className="page-stat-number">03</span>
              <span>Human review where it matters</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page pb-20">
        <DemosExplorer initial={initial} />
      </section>
    </main>
  );
}
