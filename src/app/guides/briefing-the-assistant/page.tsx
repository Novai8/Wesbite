import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Briefing the assistant well",
  description: "How to describe your problem so the Fyndra engine finds the right products.",
};

export default function BriefingTheAssistantPage() {
  return (
    <article className="container-page max-w-3xl py-12 md:py-16">
      <p className="eyebrow">Guide</p>
      <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">Briefing the assistant well</h1>

      <div className="mt-8 space-y-6">
        <section className="panel">
          <h2 className="text-xl">Describe the problem, not the product</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The engine matches your words against what each product solves.
            “Neck pain at my laptop desk” matches laptop stands, monitor arms
            and risers. Searching “office chair” would never surface any of
            them — and the actual fix might cost $15.
          </p>
        </section>

        <section className="panel">
          <h2 className="text-xl">Name the constraints</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Small rooms, shared desks, night-time use, rental walls you can&apos;t
            drill — constraints are what separate a good pick from a returned
            one. Put them in the extra-detail field or as comma-separated
            preferences.
          </p>
        </section>

        <section className="panel">
          <h2 className="text-xl">Set a real budget</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            With a budget, Fyndra scores every product on how comfortably it
            fits and shows what&apos;s left over. Without one, we score on fit
            alone — and we&apos;ll still tell you if a pick runs over what you
            typed later.
          </p>
        </section>
      </div>
    </article>
  );
}
