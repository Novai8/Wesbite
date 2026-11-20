import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Fyndra exists: shopping search is built around product names, but people have problems. An AI discovery engine that shows its reasoning.",
};

const principles = [
  {
    title: "Problems first, products second",
    body: "Nobody wakes up wanting a gas-spring monitor arm. They wake up with a sore neck. Fyndra starts where you start.",
  },
  {
    title: "Transparent reasoning, always",
    body: "Every recommendation shows its score, its breakdown, and why it beat the alternatives. No black box, no paid placement.",
  },
  {
    title: "Verified data over generated data",
    body: "Prices, specs and availability come from curated records. AI never invents a product fact — it can only explain what's already verified.",
  },
  {
    title: "Honest about the commission",
    body: "Some links are affiliate links and earn us a commission. That's disclosed on every page, and it never changes what we recommend.",
  },
];

export default function AboutPage() {
  return (
    <div className="container-page py-12 md:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">About</p>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">
          Shopping search is broken at the front end
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          {site.name} exists because search boxes want product names, and
          people have problems. Describe the problem — get scored, explained,
          honest product recommendations.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {principles.map((p) => (
          <section key={p.title} className="panel">
            <h2 className="font-display text-xl">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
          </section>
        ))}
      </div>

      <div className="panel-warm mt-12">
        <h2 className="text-xl">How the catalogue works</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Products enter the catalogue through curation and evaluation
          workflows, then wait for approval before they can ever be
          recommended. Every record carries its own data source, verification
          timestamp and affiliate programme. Products that fail validation are
          never shown and their links are never opened.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/affiliate-disclosure" className="font-medium text-cobalt-deep hover:underline">
            Read the full affiliate disclosure →
          </Link>
        </p>
      </div>
    </div>
  );
}
