import type { Metadata } from "next";
import { DemosExplorer } from "@/components/demos-explorer";
import { parseFilters } from "@/data/demos";

export const metadata: Metadata = {
  title: "Demos",
  description:
    "Twelve niche-specific n8n workflow demos with search, filters, and review-first reliability notes. Fictional data.",
};

export default async function DemosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initial = parseFilters(await searchParams);

  return (
    <main className="container-page py-12 sm:py-16">
      <p className="text-xs font-medium tracking-[0.18em] text-accent-ink uppercase">
        Library
      </p>
      <h1 className="mt-3 max-w-3xl text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98] font-medium tracking-[-0.04em] text-balance">
        Workflow demos, held for review
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
        Search the library, filter by niche or control, and open a walkthrough.
        Video frames are blank until a recording is attached.
      </p>
      <div className="mt-8">
        <DemosExplorer initial={initial} />
      </div>
    </main>
  );
}
