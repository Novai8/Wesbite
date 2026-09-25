import Link from "next/link";
import { CursorField } from "@/components/cursor-field";
import { FocusRotator } from "@/components/focus-rotator";
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
      <section className="hero-section relative overflow-hidden">
        <CursorField />
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="container-page relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.18em] text-accent-ink uppercase">
              Rapid Agents · AI automation
            </p>
            <h1 className="mt-4 max-w-4xl text-[clamp(2.5rem,6.4vw,5.35rem)] leading-[0.96] font-medium tracking-[-0.045em] text-balance">
              Help your business grow with{" "}
              <span className="font-serif font-normal text-accent italic">automation.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted text-pretty">
              Automate repetitive work, connect the tools you already use, and give your team more time to do work that actually moves the business forward.
            </p>
            <div className="mt-7 text-[clamp(1.05rem,2.5vw,1.45rem)] font-medium tracking-tight">
              Keep your team focused on <FocusRotator /><span className="text-accent">.</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/demos">
                  Explore automations
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/contact">
                  Talk about a workflow
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
                01 — What automation does
              </p>
              <h2 className="mt-2 text-3xl font-medium tracking-tight text-balance">
                More momentum. Less repetitive work.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              Capture the work, make the decision, route the next step, and keep people in control.
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
                02 — Workflow library
              </p>
              <h2 className="mt-2 text-3xl font-medium tracking-tight">Built around business friction</h2>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/demos">View all</Link>
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
                03 — The approach
              </p>
              <h2 className="mt-2 text-3xl font-medium tracking-tight text-balance">
                Automate the busywork. Keep the important decisions human.
              </h2>
              <Button asChild variant="secondary" className="mt-6">
                <Link href="/about">See how it works</Link>
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
