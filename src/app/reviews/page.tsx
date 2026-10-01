import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Client feedback for Rapigents.",
};

export default function ReviewsPage() {
  return (
    <main className="container-page py-14 sm:py-20">
      <Reveal>
        <p className="text-xs font-medium tracking-[0.18em] text-accent-ink uppercase">Reviews</p>
        <h1 className="mt-3 max-w-3xl text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98] font-medium tracking-[-0.04em] text-balance">
          Real projects. Real feedback.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted text-pretty">
          This page is reserved for feedback from real clients after completed projects.
          No invented testimonials, no mystery CEOs, and no fictional success stories dressed
          up as customer reviews.
        </p>
      </Reveal>

      <Reveal className="mt-12" delay={0.05}>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="surface p-6 sm:p-7">
            <p className="text-xs font-medium tracking-[0.16em] text-accent-ink uppercase">Client feedback</p>
            <h2 className="mt-3 text-2xl font-medium tracking-tight">Reviews will appear here</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Once a real client has completed a project, their feedback can be added here
              with their permission and accurate attribution.
            </p>
          </article>
          <article className="surface p-6 sm:p-7">
            <p className="text-xs font-medium tracking-[0.16em] text-accent-ink uppercase">Until then</p>
            <h2 className="mt-3 text-2xl font-medium tracking-tight">See the work itself</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              The current site focuses on independent automation prototypes using fictional
              data. The demos show the workflows without pretending they are client results.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild><Link href="/demos">View demos</Link></Button>
              <Button asChild variant="secondary"><Link href="/contact">Start a project</Link></Button>
            </div>
          </article>
        </div>
      </Reveal>

      <Reveal className="mt-8" delay={0.08}>
        <div className="surface p-6 sm:p-7">
          <p className="text-sm leading-relaxed text-muted">
            Want to leave feedback after working with {site.name}? Contact {site.owner} at{" "}
            <a className="font-medium text-foreground underline underline-offset-4" href={"mailto:" + site.email}>
              {site.email}
            </a>.
          </p>
        </div>
      </Reveal>
    </main>
  );
}
