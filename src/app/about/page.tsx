import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Hussnain Tariq and Rapigents. A portfolio prototype of n8n workflows with human review, audit logs, and fictional data.",
};

const principles = [
  {
    title: "Safety",
    body: "Automation prepares the work. It does not send, book, or write a customer record unless a person has approved that step. High-impact actions stay manual.",
  },
  {
    title: "Audit logs",
    body: "A run should be reconstructable: what came in, what the model returned, what was held, and who reviewed it. Silent success is not a feature.",
  },
  {
    title: "Human review",
    body: "Confidence is not permission. Low-confidence and high-impact steps wait. The review is part of the workflow, not a footnote.",
  },
  {
    title: "Fictional data",
    body: "Names, companies, volumes, and minutes on this site are invented. These pages are not client case studies and are not connected to anyone’s inbox.",
  },
  {
    title: "No inflated claims",
    body: "Time-saved figures are arithmetic on stated assumptions. They are not measured production results. Actual results vary.",
  },
];

export default function AboutPage() {
  return (
    <main className="container-page py-14 sm:py-20">
      <Reveal>
        <p className="text-xs font-medium tracking-[0.18em] text-accent-ink uppercase">
          About
        </p>
        <h1 className="mt-3 max-w-3xl text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98] font-medium tracking-[-0.04em] text-balance">
          {site.owner}, {site.name}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted text-pretty">
          I build n8n workflows that show a before state, an after state, and the
          controls that keep automation honest. This site is an independent
          portfolio prototype. It is not a client roster and it is not a promise
          of hours saved.
        </p>
      </Reveal>

      <Reveal className="mt-12" delay={0.05}>
        <div className="grid gap-4 md:grid-cols-2">
          {principles.map((item, index) => (
            <article key={item.title} className="surface min-w-0 p-5 sm:p-6">
              <p className="font-mono text-xs text-slate-400">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-3 text-xl font-medium tracking-tight">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </Reveal>

      <Reveal className="mt-8" delay={0.08}>
        <div className="surface flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <h2 className="text-xl font-medium tracking-tight">What this is not</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Not an official system for any employer or client. Not live customer
              data. Not a claim that a model should own a mailbox, a calendar, or
              a CRM. If a workflow cannot show its evidence, it does not ship here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/demos" data-cursor-label="Open">
                View demos
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/contact">Contact</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </main>
  );
}
