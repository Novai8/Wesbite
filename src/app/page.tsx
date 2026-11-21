import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { Badge } from "@/components/ui/badge";
import { getCategories, getNewestProducts, getPopularProducts } from "@/lib/catalogue";
import { site } from "@/lib/site";

const howItWorks = [
  {
    step: "01",
    title: "Describe the problem",
    body: "Tell Fyndra what you're actually trying to solve — not a product name. \"My back hurts at my desk all day\" is enough.",
  },
  {
    step: "02",
    title: "Set budget and limits",
    body: "Pick a budget, currency and any must-haves. The engine works within what you gave it and never quietly goes over.",
  },
  {
    step: "03",
    title: "Get scored recommendations",
    body: "Every match comes with a score and a plain-English reason: relevance, budget fit, features, and how fresh the data is.",
  },
  {
    step: "04",
    title: "Click through when ready",
    body: "Buy from the merchant directly. Links marked Affiliate earn us a commission — it never changes what we recommend.",
  },
];

export default function HomePage() {
  const categories = getCategories();
  const featured = getPopularProducts(4);
  const recent = getNewestProducts(4);

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line">
        <div className="container-page py-16 md:py-24">
          <div className="max-w-3xl">
            <p className="eyebrow">AI shopping discovery</p>
            <h1 className="mt-4 text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.05]">
              People search for solutions.
              <br />
              <span className="text-cobalt">The platform finds the products.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              {site.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/assistant" className="btn btn-primary">
                Describe what you need
              </Link>
              <Link href="/discover" className="btn btn-secondary">
                Browse the catalogue
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-line bg-surface-warm" aria-labelledby="how-it-works">
        <div className="container-page py-16">
          <h2 id="how-it-works" className="text-3xl">How it works</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((s) => (
              <div key={s.step} className="panel bg-paper">
                <p className="font-display text-sm font-bold text-cobalt">{s.step}</p>
                <h3 className="mt-2 text-lg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="border-b border-line" aria-labelledby="categories">
        <div className="container-page py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="categories" className="text-3xl">Shop by problem area</h2>
            <Link href="/discover" className="text-sm font-medium text-cobalt-deep no-underline hover:underline">
              View everything →
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/discover?category=${c.slug}`}
                className="panel group no-underline hover:border-line-strong"
              >
                <h3 className="font-display text-lg group-hover:text-cobalt-deep">{c.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="border-b border-line" aria-labelledby="featured">
        <div className="container-page py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="featured" className="text-3xl">Frequently recommended</h2>
            <Link href="/discover" className="text-sm font-medium text-cobalt-deep no-underline hover:underline">
              More picks →
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 2} />
            ))}
          </div>
        </div>
      </section>

      {/* Assistant preview band */}
      <section className="border-b border-line bg-ink text-paper" aria-labelledby="assistant-preview">
        <div className="container-page grid gap-10 py-16 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <h2 id="assistant-preview" className="text-3xl text-paper">
              An answer, not a search results page
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-stone-200">
              Fyndra scores real catalogue data on six axes — relevance, budget
              fit, features, data quality, price freshness and category fit —
              then explains its pick in plain English. Prices and specs always
              come from verified records, never from a language model.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge tone="verified">Verified data</Badge>
              <Badge tone="ai">AI explains, never invents</Badge>
            </div>
            <Link href="/assistant" className="btn btn-primary mt-8">
              Try the assistant
            </Link>
          </div>
          <div className="rounded-[1.1rem] border border-stone-700 bg-stone-900 p-6 text-paper">
            <p className="font-mono text-xs uppercase tracking-widest text-stone-200">Example</p>
            <p className="mt-3 font-display text-lg leading-snug">
              “I get neck pain working at my laptop in a small apartment.”
            </p>
            <hr className="my-4 border-stone-700" />
            <p className="text-sm leading-relaxed text-stone-200">
              Fyndra pairs a laptop stand with a gas-spring monitor arm: the
              stand lifts the screen immediately for under $15, and the arm
              frees desk depth in tight spaces. Both fit a $50 budget together.
            </p>
          </div>
        </div>
      </section>

      {/* Recent */}
      <section aria-labelledby="recent">
        <div className="container-page py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="recent" className="text-3xl">Recently added</h2>
            <Link href="/guides" className="text-sm font-medium text-cobalt-deep no-underline hover:underline">
              Read the guides →
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
