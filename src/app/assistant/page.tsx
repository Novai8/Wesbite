import type { Metadata } from "next";
import { AssistantWizard } from "@/components/assistant-wizard";

export const metadata: Metadata = {
  title: "Assistant",
  description:
    "Describe what you need in plain language. Fyndra scores the catalogue and explains every pick.",
};

export default function AssistantPage() {
  return (
    <div className="container-page py-12 md:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Assistant</p>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">Tell it the problem, not the product</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Four quick steps. Fyndra searches its curated catalogue, scores each
          match, and shows the reasoning — every price and spec comes from a
          verified record.
        </p>
      </div>

      <div className="mt-10">
        <AssistantWizard />
      </div>
    </div>
  );
}
