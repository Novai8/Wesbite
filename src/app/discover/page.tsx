import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverGrid } from "@/components/discover-grid";
import { DiscoverSkeleton } from "@/components/discover-skeleton";

export const metadata: Metadata = {
  title: "Discover",
  description:
    "Browse Fyndra's full curated catalogue — filter by category, budget tier and price, and sort by what matters to you.",
};

export default function DiscoverPage() {
  return (
    <div className="container-page py-12 md:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Discover</p>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">The whole catalogue</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Every product here is in an approved affiliate programme, with prices
          verified against source records. Filter down to what you need.
        </p>
      </div>

      <div className="mt-10">
        <Suspense fallback={<DiscoverSkeleton />}>
          <DiscoverGrid />
        </Suspense>
      </div>
    </div>
  );
}
