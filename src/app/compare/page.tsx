import type { Metadata } from "next";
import { CompareTool } from "@/components/compare-tool";

export const metadata: Metadata = {
  title: "Compare",
  description:
    "Put up to three Fyndra catalogue products side by side — price, specs, pros and trade-offs in one table.",
};

export default function ComparePage() {
  return (
    <div className="container-page py-12 md:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Compare</p>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">Side by side</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Pick up to three products and see price, specs and trade-offs in one
          table. All data comes from verified catalogue records.
        </p>
      </div>

      <div className="mt-10">
        <CompareTool />
      </div>
    </div>
  );
}
