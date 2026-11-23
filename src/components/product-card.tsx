import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/catalogue";
import type { Product } from "@/lib/types";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const image = product.imageUrls[0] ?? "/products/placeholder-organiser.svg";
  const wasPrice =
    product.previousPrice != null && product.previousPrice > product.price
      ? formatPrice(product.previousPrice, product.currency)
      : null;

  return (
    <Link href={`/products/${product.slug}`} className="product-card group">
      <div className="product-card-media">
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1180px) 33vw, 25vw"
          className="object-cover"
          priority={priority}
        />
        {product.priceVerifiedAt && (
          <span className="product-card-badge">
            <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
              <path
                d="M2 6.5 4.8 9 10 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Verified
          </span>
        )}
      </div>

      <div className="product-card-body">
        <p className="product-card-kicker">
          <span>{product.merchant}</span>
          <span>{product.categorySlug.replace(/-/g, " ")}</span>
        </p>
        <h3 className="product-card-title">{product.title}</h3>
        <p className="product-card-desc">{product.description}</p>

        <div className="product-card-footer">
          <span>
            <span className="product-card-price">
              {formatPrice(product.price, product.currency)}
            </span>
            {wasPrice ? <span className="product-card-was">{wasPrice}</span> : null}
          </span>
          <span className="product-card-arrow" aria-hidden="true">
            ↗
          </span>
        </div>
      </div>
    </Link>
  );
}
