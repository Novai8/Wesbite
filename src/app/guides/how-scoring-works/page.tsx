import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How Fyndra scores products",
  description: "The six scoring axes behind every Fyndra recommendation and what the weights mean.",
};

const axes = [
  { name: "Relevance", weight: "35%", body: "How closely the product's keywords, use cases and description overlap with what you described. Partial word matches earn half credit, so synonyms still surface." },
  { name: "Budget", weight: "25%", body: "How comfortably the price fits your budget. Way under budget scores fine; eating most of it scores lower; exceeding it scores zero." },
  { name: "Features", weight: "15%", body: "Whether the product's specs and stated features match the preferences you typed — wireless, quiet, compact and so on." },
  { name: "Data quality", weight: "10%", body: "How complete the product's record is: specs filled in, pros and cons listed, availability known. Thin records score lower so we don't over-recommend what we can't back up." },
  { name: "Price freshness", weight: "5%", body: "How recently the price was verified against the merchant. Stale prices quietly lose points." },
  { name: "Category fit", weight: "10%", body: "Whether the product sits in a category that plausibly answers your problem." },
];

export default function HowScoringWorksPage() {
  return (
    <article className="container-page max-w-3xl py-12 md:py-16">
      <p className="eyebrow">Guide</p>
      <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">How Fyndra scores products</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Every recommendation comes from a deterministic scoring engine — the
        same inputs always produce the same output. A language model never
        picks products and never changes scores; it can only rewrite the
        explanation text, and only from the verified record.
      </p>

      <div className="mt-10 space-y-6">
        {axes.map((a, i) => (
          <section key={a.name} className="panel" aria-labelledby={`axis-${i}`}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 id={`axis-${i}`} className="font-display text-xl">{a.name}</h2>
              <span className="badge badge-ai">{a.weight}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{a.body}</p>
          </section>
        ))}
      </div>

      <div className="panel-warm mt-10">
        <h2 className="text-xl">What this means for you</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          You can always see the breakdown: every recommendation shows its
          scores per axis. If a pick looks wrong, the numbers tell you why —
          and the alternatives show you the trade-offs we considered.
        </p>
      </div>
    </article>
  );
}
