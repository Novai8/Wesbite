import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reading a recommendation",
  description: "What Fyndra's scores, labels and warnings mean.",
};

export default function ReadingARecommendationPage() {
  return (
    <article className="container-page max-w-3xl py-12 md:py-16">
      <p className="eyebrow">Guide</p>
      <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">Reading a recommendation</h1>

      <div className="mt-8 space-y-6">
        <section className="panel">
          <h2 className="text-xl">The score breakdown</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Each recommendation lists six numbers — relevance, budget, features,
            data quality, freshness and category, as percentages of the maximum
            that axis can contribute. High relevance with low budget means a
            great match that stretches your money; that&apos;s a signal to compare
            the alternatives, not necessarily to walk away.
          </p>
        </section>

        <section className="panel">
          <h2 className="text-xl">The labels</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            <strong>Verified</strong> means the price was checked against a
            source record. <strong>AI explanation</strong> means a language
            model rewrote the plain-English reasoning — it can only describe
            what&apos;s already in the verified record, never invent prices, specs
            or availability. When no AI is configured, the same explanation is
            generated deterministically.
          </p>
        </section>

        <section className="panel">
          <h2 className="text-xl">Warnings</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            If nothing in the catalogue truly matches, we say so and show the
            closest overall picks instead — clearly flagged. If a pick runs
            over your budget, the warning tells you by exactly how much. We
            never hide a mismatch to make a result look better.
          </p>
        </section>
      </div>
    </article>
  );
}
