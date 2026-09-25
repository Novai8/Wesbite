import Link from "next/link";
import { DemoCard } from "@/components/demo-card";
import { HeroStage } from "@/components/hero-stage";
import { NicheTiles } from "@/components/niche-tiles";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { demos } from "@/data/demos";

const principles = [
  {
    title: "Held, not sent",
    body: "A draft is not a message. Anything that leaves the building waits for a person.",
  },
  {
    title: "Evidence, not polish",
    body: "Missing fields stay empty. A failed pull is shown as failed, not filled in.",
  },
  {
    title: "Fictional on purpose",
    body: "Names, volumes, and minutes on this site are invented so the pattern can be shown safely.",
  },
];

export default function HomePage() {
  const featured = demos.slice(0, 4);

  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="container-page relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.18em] text-accent-ink uppercase">
              Hussnain Tariq · Rapigents
            </p>
            <h1 className="mt-4 max-w-4xl text-[clamp(2.5rem,6.4vw,5.35rem)] leading-[0.96] font-medium tracking-[-0.045em] text-balance">
              AI Workflow Automation Demos Built in{" "}
              <span className="font-serif font-normal text-accent italic">n8n</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted text-pretty">
              Niche-specific, before-and-after demos with reliability, human review, and audit logs.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/demos">
                  View demos
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/contact">
                  Contact
                </Link>
              </Button>
            </div>
          </div>
          <HeroStage />
        </div>
      </section>

      <section className="container-page pb-6">
        <Reveal>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-[0.16em] text-accent-ink uppercase">
                01 — Niches
              </p>
              <h2 className="mt-2 text-3xl font-medium tracking-tight text-balance">
                Three places the same pattern shows up
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              Twelve workflows. Same rule: the automation prepares, a person decides.
            </p>
          </div>
          <div className="mt-8">
            <NicheTiles />
          </div>
        </Reveal>
      </section>

      <section className="container-page py-16 sm:py-20">
        <Reveal>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium tracking-[0.16em] text-accent-ink uppercase">
                02 — Featured
              </p>
              <h2 className="mt-2 text-3xl font-medium tracking-tight">Selected workflows</h2>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/demos">All demos</Link>
            </Button>
          </div>
          <div className="card-grid mt-8 grid gap-4 sm:grid-cols-2">
            {featured.map((demo) => (
              <DemoCard key={demo.slug} demo={demo} href={`/demos/${demo.slug}`} />
            ))}
          </div>
        </Reveal>
      </section>

      <section className="container-page pb-16 sm:pb-24">
        <Reveal>
          <div className="surface grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-medium tracking-[0.16em] text-accent-ink uppercase">
                03 — How to read a demo
              </p>
              <h2 className="mt-2 text-3xl font-medium tracking-tight text-balance">
                Before, review, after. No inflated result.
              </h2>
              <Button asChild variant="secondary" className="mt-6">
                <Link href="/about">About the practice</Link>
              </Button>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3">
              {principles.map((item, index) => (
                <li key={item.title} className="min-w-0 rounded-2xl border border-line bg-paper p-4">
                  <p className="font-mono text-xs text-slate-400">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-3 text-base font-medium tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
