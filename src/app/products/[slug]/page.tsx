import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { Badge } from "@/components/ui/badge";
import { AffiliateButton } from "@/components/affiliate-button";
import { formatPrice, getProductBySlug, getRelatedProducts } from "@/lib/catalogue";
import { outboundPath } from "@/lib/affiliate";

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.title,
    description: product.description,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const related = getRelatedProducts(product, 3);

  return (
    <div className="container-page py-10 md:py-14">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/discover" className="hover:text-ink hover:underline">Discover</Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/discover?category=${product.categorySlug}`} className="hover:text-ink hover:underline">
          {product.categorySlug.replace(/-/g, " ")}
        </Link>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-surface-warm">
          <Image
            src={product.imageUrls[0] ?? "/products/placeholder-organiser.svg"}
            alt={product.title}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{product.merchant}</Badge>
            {product.priceVerifiedAt && <Badge tone="verified">Price verified</Badge>}
            <Badge tone="neutral">{product.budgetTier} tier</Badge>
          </div>

          <h1 className="mt-4 text-[clamp(1.75rem,3.5vw,2.5rem)]">{product.title}</h1>

          <div className="mt-3 flex items-baseline gap-3">
            <p className="price text-3xl">{formatPrice(product.price, product.currency)}</p>
            {product.previousPrice != null && product.previousPrice > product.price && (
              <p className="text-lg text-faint line-through">
                {formatPrice(product.previousPrice, product.currency)}
              </p>
            )}
          </div>

          <p className="mt-4 leading-relaxed text-muted">{product.description}</p>

          <div className="mt-6">
            <AffiliateButton
              href={outboundPath(product, "product-page")}
              available={product.availability === "in_stock"}
            />
            <p className="mt-2 text-xs leading-relaxed text-faint">
              Links marked Affiliate earn us a commission if you buy something.
              It doesn&apos;t change what we recommend or what you pay. Prices were
              verified at {new Date(product.priceVerifiedAt).toLocaleDateString("en-GB")} —
              check the merchant page for the live price.
            </p>
          </div>

          {product.pros.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg">What&apos;s good</h2>
              <ul className="verified-list mt-2">
                {product.pros.map((pro) => (
                  <li key={pro}>
                    <span aria-hidden="true" className="text-lime-ink">✓</span>
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {product.cons.length > 0 && (
            <div className="mt-5">
              <h2 className="text-lg">Trade-offs</h2>
              <ul className="verified-list mt-2">
                {product.cons.map((con) => (
                  <li key={con}>
                    <span aria-hidden="true" className="text-danger">–</span>
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Specs */}
      {Object.keys(product.specs).length > 0 && (
        <section className="mt-14" aria-labelledby="specs">
          <h2 id="specs" className="text-2xl">Specifications</h2>
          <dl className="mt-4 grid gap-x-10 sm:grid-cols-2">
            {Object.entries(product.specs).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-line py-3">
                <dt className="text-sm font-medium text-muted">{k}</dt>
                <dd className="text-sm text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-14" aria-labelledby="related">
          <h2 id="related" className="text-2xl">Solves the same problem</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
