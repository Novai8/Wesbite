import Link from "next/link";
import { LandingHero } from "@/components/landing/landing-hero";
import { ProductCard } from "@/components/product-card";
import { getCatalogue, getCategories } from "@/lib/catalogue";

function realImageHandle(product: { imageUrls: string[] }) {
  const image = product.imageUrls[0];
  return Boolean(image && !image.endsWith(".svg"));
}

export default function HomePage() {
  const catalogue = getCatalogue();
  const categories = getCategories();

  const categoryLinks = categories.map((category) => ({
    name: category.name,
    href: `/discover?category=${category.slug}`,
    description: category.description,
    count: catalogue.filter((product) => product.categorySlug === category.slug).length,
  }));

  const shelfPicks = categories
    .map((category) =>
      catalogue.find(
        (product) => product.categorySlug === category.slug && realImageHandle(product),
      ),
    )
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  return (
    <>
      <LandingHero categories={categoryLinks} />

      <section className="home-shelf" aria-labelledby="home-shelf-title">
        <div className="container-page">
          <div className="home-shelf-head">
            <div>
              <p className="eyebrow">Every shelf, one real object</p>
              <h2 id="home-shelf-title">The catalogue is the point.</h2>
            </div>
            <p>
              Six categories, {catalogue.length} approved records, and no filler.
              Here is one real listing from each shelf so the shortlist starts
              with something you can actually inspect.
            </p>
            <Link href="/discover" className="quiet-link">
              Open the full catalogue
            </Link>
          </div>

          <div className="home-shelf-grid">
            {shelfPicks.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="home-shelf-foot">
            <p>
              Prices are source records, not estimates. Check the merchant for
              the live price before buying.
            </p>
            <Link href="/guides/reading-a-recommendation" className="quiet-link">
              How to read a recommendation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
