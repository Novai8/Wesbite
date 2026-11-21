import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Short, practical guides from Fyndra — how we score products, how to brief the assistant, and how to read a recommendation.",
};

const guides = [
  {
    href: "/guides/how-scoring-works",
    title: "How Fyndra scores products",
    excerpt:
      "The six axes behind every recommendation — relevance, budget, features, data quality, freshness and category — and what the weights mean.",
    readTime: "4 min",
  },
  {
    href: "/guides/briefing-the-assistant",
    title: "Briefing the assistant well",
    excerpt:
      "Why “my back hurts at my desk” gets better results than “office chair”, and how preferences shape the shortlist.",
    readTime: "3 min",
  },
  {
    href: "/guides/reading-a-recommendation",
    title: "Reading a recommendation",
    excerpt:
      "What the score means, what “verified” and “AI explanation” labels tell you, and when to trust the alternatives.",
    readTime: "3 min",
  },
];

export default function GuidesPage() {
  return (
    <div className="container-page py-12 md:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Guides</p>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">How to use Fyndra well</h1>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {guides.map((g) => (
          <Link key={g.href} href={g.href} className="panel group no-underline hover:border-line-strong">
            <p className="text-xs font-medium uppercase tracking-widest text-faint">{g.readTime} read</p>
            <h2 className="mt-2 font-display text-xl group-hover:text-cobalt-deep">{g.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{g.excerpt}</p>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted">
        More guides land as the catalogue grows. Something you want explained?{" "}
        <Link href="/contact" className="text-cobalt-deep hover:underline">Tell us</Link>.
      </p>
    </div>
  );
}
