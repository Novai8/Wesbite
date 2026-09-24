import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AssumptionsPanel } from "@/components/assumptions-panel";
import { Disclaimer } from "@/components/disclaimer";
import { MediaFrame } from "@/components/media-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  demos,
  getDemo,
  nicheIdFor,
  relatedDemos,
} from "@/data/demos";
import { toolLinks, workflowMailto } from "@/lib/site";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return demos.map((demo) => ({ slug: demo.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const demo = getDemo(slug);
  if (!demo) return { title: "Demo" };
  return {
    title: demo.title,
    description: demo.shortProblem,
  };
}

export default async function DemoDetailPage({ params }: Props) {
  const { slug } = await params;
  const demo = getDemo(slug);
  if (!demo) notFound();
  const related = relatedDemos(demo.slug);

  return (
    <main className="container-page py-10 sm:py-14">
      <Link
        href={`/demos?niche=${nicheIdFor(demo.niche)}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All demos
      </Link>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="accent">{demo.niche}</Badge>
            {demo.workflowTypeTags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
          <h1 className="mt-4 text-[clamp(2rem,4vw,3.4rem)] leading-[1.02] font-medium tracking-[-0.04em] text-balance">
            {demo.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
            {demo.shortProblem}
          </p>
          <div className="mt-6">
            <MediaFrame
              title={demo.title}
              videoUrl={demo.videoUrl}
              thumbnailUrl={demo.thumbnailUrl}
            />
          </div>
        </div>
        <aside className="surface h-fit p-5 sm:sticky sm:top-40 sm:p-6">
          <p className="text-xs font-medium tracking-[0.16em] text-accent-ink uppercase">
            Next step
          </p>
          <h2 className="mt-2 text-xl font-medium tracking-tight">
            Request this workflow
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Opens an email to Hussnain with the subject already set. Nothing is
            sent until you send it.
          </p>
          <Button asChild className="mt-5 w-full">
            <a href={workflowMailto(demo.title)}>Request this workflow</a>
          </Button>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {demo.reliabilityFeatures.map((item) => (
              <Badge key={item}>{item}</Badge>
            ))}
          </div>
          <Disclaimer className="mt-4" />
        </aside>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <section className="surface min-w-0 p-5 sm:p-6">
          <p className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase">
            Problem
          </p>
          <h2 className="mt-2 text-2xl font-medium tracking-tight">Before</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{demo.beforeSummary}</p>
        </section>
        <section className="surface min-w-0 p-5 sm:p-6">
          <p className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase">
            Workflow
          </p>
          <h2 className="mt-2 text-2xl font-medium tracking-tight">After</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{demo.afterSummary}</p>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="surface min-w-0 p-5 sm:p-6">
          <h2 className="text-xl font-medium tracking-tight">What the client sees</h2>
          <ul className="mt-4 space-y-3">
            {demo.whatClientSees.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="surface min-w-0 p-5 sm:p-6">
          <h2 className="text-xl font-medium tracking-tight">Reliability and safety</h2>
          <ul className="mt-4 space-y-3">
            {demo.reliability.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-4">
        <AssumptionsPanel assumptions={demo.assumptions} />
      </div>

      <section className="surface mt-4 p-5 sm:p-6">
        <h2 className="text-xl font-medium tracking-tight">Tools used</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {demo.tools.map((tool) => {
            const href = toolLinks[tool];
            return (
              <li key={tool}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center rounded-full border border-line bg-white px-3.5 text-sm font-medium"
                  >
                    {tool}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="inline-flex h-10 items-center rounded-full border border-dashed border-line bg-paper px-3.5 text-sm text-slate-600">
                    {tool}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {related.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-medium tracking-tight">Same niche</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={`/demos/${item.slug}`}
                data-cursor-label="View"
                className="surface block min-w-0 p-4 transition-transform duration-200 hover:-translate-y-0.5"
              >
                <p className="text-xs text-slate-500">{item.niche}</p>
                <p className="mt-1 font-medium tracking-tight">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{item.shortProblem}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
