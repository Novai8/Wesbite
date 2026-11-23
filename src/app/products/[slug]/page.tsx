import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { Badge } from "@/components/ui/badge";
import { AffiliateButton } from "@/components/affiliate-button";
import { formatPrice, getCategories } from "@/lib/catalogue";
import {
  getCatalogueSnapshot,
  getLiveProductBySlug,
  relatedFrom,
} from "@/lib/catalogue-server";
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
  const product = await getLiveProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return { title: product.title, description: product.aiDescription ?? product.description };
}

const tierCopy: Record<string, string> = {
  budget: "Budget",
  mid: "Mid-range",
  premium: "Premium",
};

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { products } = await getCatalogueSnapshot();
  const product = products.find((item) => item.slug === slug);
  if (!product) notFound();

  const related = relatedFrom(products, product, 3);
  const category = getCategories().find((item) => item.slug === product.categorySlug);
  const image = product.imageUrls[0] ?? "/products/placeholder-organiser.svg";

  return (
    <div className="product-room">
      <div className="container-page product-room-top">
        <nav aria-label="Breadcrumb" className="product-breadcrumb">
          <Link href="/discover">Catalogue</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/discover?category=${product.categorySlug}`}>
            {category?.name ?? product.categorySlug.replace(/-/g, " ")}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.title}</span>
        </nav>

        <div className="product-stage">
          <div className="product-media">
            <span className="product-media-tag">{product.merchant}</span>
            <Image
              src={image}
              alt={product.title}
              fill
              sizes="(max-width: 1024px) 100vw, 56vw"
              className="object-cover"
              priority
            />
            <span className="product-media-index" aria-hidden="true">01 — 01</span>
          </div>

          <div className="product-detail">
            <div className="product-detail-topline">
              <Badge tone="neutral">{tierCopy[product.budgetTier] ?? product.budgetTier}</Badge>
              {product.priceVerifiedAt ? <Badge tone="verified">Price verified</Badge> : null}
              <Badge tone="neutral">
                {product.availability === "in_stock" ? "Listed in stock" : "Check availability"}
              </Badge>
            </div>

            <h1>{product.title}</h1>

            {product.aiHeadline ? (
              <p className="product-price-note">
                Fyndra note: {product.aiHeadline}
              </p>
            ) : null}

            <div className="product-price-row">
              <p className="price">{formatPrice(product.price, product.currency)}</p>
              {product.previousPrice != null && product.previousPrice > product.price ? (
                <p className="product-price-was">
                  {formatPrice(product.previousPrice, product.currency)}
                </p>
              ) : null}
              <p className="product-price-note">Source record</p>
            </div>

            <p className="product-description">{product.description}</p>

            <div className="product-buy">
              <AffiliateButton
                href={outboundPath(product, "product-page")}
                available={product.availability === "in_stock"}
              />
              <p className="product-buy-disclosure">
                Links marked Affiliate earn Fyndra a commission if you buy
                something. It does not change what we recommend or what you
                pay. Price verified{" "}
                {new Date(product.priceVerifiedAt).toLocaleDateString("en-GB")} —
                check the merchant page for the live price.
              </p>
            </div>

            <dl className="product-facts">
              <div className="product-fact">
                <dt>Merchant</dt>
                <dd>{product.merchant}</dd>
              </div>
              <div className="product-fact">
                <dt>Category</dt>
                <dd>{category?.name ?? product.categorySlug.replace(/-/g, " ")}</dd>
              </div>
              {product.subcategory ? (
                <div className="product-fact">
                  <dt>Subcategory</dt>
                  <dd>{product.subcategory}</dd>
                </div>
              ) : null}
              <div className="product-fact">
                <dt>Regions</dt>
                <dd>{product.region.join(", ")}</dd>
              </div>
              {product.source ? (
                <div className="product-fact">
                  <dt>Source</dt>
                  <dd>
                    {product.source === "admitad"
                      ? "Imported from Admitad"
                      : product.source === "aliexpress"
                        ? "AliExpress listing"
                        : "Fyndra curation"}
                    {product.sourceUrl ? (
                      <>
                        {" · "}
                        <a
                          href={product.sourceUrl}
                          rel="nofollow noopener"
                          target="_blank"
                          className="quiet-link"
                        >
                          View original listing
                        </a>
                      </>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {product.lastSyncedAt ? (
                <div className="product-fact">
                  <dt>Last synced</dt>
                  <dd>{new Date(product.lastSyncedAt).toLocaleDateString("en-GB")}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>

        {product.pros.length > 0 || product.cons.length > 0 ? (
          <div className="product-notes">
            {product.pros.length > 0 ? (
              <section className="product-note-block" aria-labelledby="product-pros">
                <h2 id="product-pros">What&apos;s good</h2>
                <ul className="product-notes-list">
                  {product.pros.map((pro) => (
                    <li key={pro}>{pro}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {product.cons.length > 0 ? (
              <section className="product-note-block is-cons" aria-labelledby="product-cons">
                <h2 id="product-cons">Trade-offs</h2>
                <ul className="product-notes-list">
                  {product.cons.map((con) => (
                    <li key={con}>{con}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}

        {Object.keys(product.specs).length > 0 ? (
          <section className="product-specs" aria-labelledby="specifications">
            <div className="product-specs-head">
              <h2 id="specifications">Specifications</h2>
              <p>From the source record</p>
            </div>
            <dl className="product-spec-grid">
              {Object.entries(product.specs).map(([key, value]) => (
                <div key={key} className="product-spec-row">
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className="product-related" aria-labelledby="related">
            <div className="product-related-head">
              <h2 id="related">Solves the same problem</h2>
              <Link href={`/discover?category=${product.categorySlug}`} className="quiet-link">
                More in {category?.name ?? "this category"}
              </Link>
            </div>
            <div className="product-related-grid">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
