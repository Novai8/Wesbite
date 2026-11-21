import Link from "next/link";
import { LandingHero } from "@/components/landing/landing-hero";
import { ProductCard } from "@/components/product-card";
import { ScrollReveal } from "@/components/scroll-reveal";
import { Badge } from "@/components/ui/badge";
import { getCategories, getNewestProducts, getPopularProducts } from "@/lib/catalogue";

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
      <LandingHero />

      <section id="how-it-works" className="section-band section-band-warm" aria-labelledby="how-it-works-title">
        <div className="container-page">
          <ScrollReveal>
            <div className="section-head">
              <p className="eyebrow">The method</p>
              <h2 id="how-it-works-title" className="section-title">
                Four steps from a vague problem to a well-chosen thing.
              </h2>
            </div>
          </ScrollReveal>

          <ol className="steps">
            {howItWorks.map((step, index) => (
              <li key={step.step} className="step">
                <ScrollReveal className={`step-inner delay-${index}`}>
                  <span className="step-number" aria-hidden="true">
                    {step.step}
                  </span>
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-body">{step.body}</p>
                </ScrollReveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-band" aria-labelledby="categories-title">
        <div className="container-page">
          <ScrollReveal>
            <div className="section-head section-head-split">
              <div>
                <p className="eyebrow">Where to start</p>
                <h2 id="categories-title" className="section-title">
                  Shop by problem area
                </h2>
              </div>
              <Link href="/discover" className="quiet-link">
                View everything
              </Link>
            </div>
          </ScrollReveal>

          <ul className="category-list">
            {categories.map((category) => (
              <li key={category.slug}>
                <ScrollReveal>
                  <Link href={`/discover?category=${category.slug}`} className="category-row group">
                    <span className="category-name">{category.name}</span>
                    <span className="category-desc">{category.description}</span>
                    <span className="category-arrow" aria-hidden="true">
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                        <path d="M3 8h9.4M8.7 3.9 12.9 8l-4.2 4.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </Link>
                </ScrollReveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-band section-band-warm" aria-labelledby="featured-title">
        <div className="container-page">
          <ScrollReveal>
            <div className="section-head section-head-split">
              <div>
                <p className="eyebrow">Chosen often</p>
                <h2 id="featured-title" className="section-title">
                  Frequently recommended
                </h2>
              </div>
              <Link href="/discover" className="quiet-link">
                More picks
              </Link>
            </div>
          </ScrollReveal>
          <div className="product-grid">
            {featured.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 2} />
            ))}
          </div>
        </div>
      </section>

      <section className="assistant-band" aria-labelledby="assistant-title">
        <div className="container-page assistant-grid">
          <ScrollReveal>
            <div>
              <p className="eyebrow eyebrow-invert">How we think</p>
              <h2 id="assistant-title" className="section-title section-title-invert">
                An answer, not a search results page.
              </h2>
              <p className="assistant-body">
                Fyndra scores real catalogue data on six axes — relevance, budget
                fit, features, data quality, price freshness and category fit —
                then explains its pick in plain English. Prices and specs always
                come from verified records, never from a language model.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge tone="verified">Verified data</Badge>
                <Badge tone="ai">AI explains, never invents</Badge>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <figure className="assistant-card">
              <figcaption className="assistant-card-label">Example</figcaption>
              <blockquote className="assistant-card-quote">
                “I get neck pain working at my laptop in a small apartment.”
              </blockquote>
              <hr className="assistant-card-rule" />
              <p className="assistant-card-body">
                Fyndra pairs a laptop stand with a gas-spring monitor arm: the
                stand lifts the screen immediately for under $15, and the arm
                frees desk depth in tight spaces. Both fit a $50 budget together.
              </p>
            </figure>
          </ScrollReveal>
        </div>
      </section>

      <section className="section-band" aria-labelledby="recent-title">
        <div className="container-page">
          <ScrollReveal>
            <div className="section-head section-head-split">
              <div>
                <p className="eyebrow">Fresh in the catalogue</p>
                <h2 id="recent-title" className="section-title">
                  Recently added
                </h2>
              </div>
              <Link href="/guides" className="quiet-link">
                Read the guides
              </Link>
            </div>
          </ScrollReveal>
          <div className="product-grid">
            {recent.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
