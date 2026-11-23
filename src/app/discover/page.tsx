import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverGrid } from "@/components/discover-grid";
import { DiscoverSkeleton } from "@/components/discover-skeleton";
import { getCatalogueSnapshot } from "@/lib/catalogue-server";

export const metadata: Metadata = {
  title: "Discover",
  description:
    "Browse Fyndra's full curated catalogue of approved products. Filter by category, budget tier and price, then sort by what matters to you.",
};

export default async function DiscoverPage() {
  const { products: catalogue, categories } = await getCatalogueSnapshot();

  return (
    <div className="catalogue-page">
      <header className="catalogue-hero">
        <div className="container-page catalogue-hero-copy">
          <p className="catalogue-eyebrow">The catalogue</p>
          <h1>
            Good things,
            <br />
            <em>on purpose.</em>
          </h1>
          <p className="catalogue-hero-lede">
            A working shelf of {catalogue.length} approved products across six
            categories. Every record has a merchant, a source price and a stated
            reason for being here. Nothing is placed by a sponsored feed.
          </p>
          <div className="catalogue-meta">
            <span>{catalogue.length} approved records</span>
            <span>{categories.length} categories</span>
            <span>Affiliate links labelled</span>
          </div>
        </div>
      </header>

      <div className="container-page catalogue-body">
        <Suspense fallback={<DiscoverSkeleton />}>
          <DiscoverGrid initialProducts={catalogue} initialCategories={categories} />
        </Suspense>
      </div>
    </div>
  );
}
