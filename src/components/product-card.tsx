import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/catalogue";
import type { Product } from "@/lib/types";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const image = product.imageUrls[0] ?? "/products/placeholder-organiser.svg";

  return (
    <Link href={`/products/${product.slug}`} className="card group">
      <div className="relative aspect-[4/3] bg-surface-warm">
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover"
          priority={priority}
        />
        {product.priceVerifiedAt && (
          <span className="badge badge-verified absolute left-3 top-3">
            <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
              <path d="M2 6.5 4.8 9 10 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Verified
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-[1.02rem] font-semibold leading-snug">
            {product.title}
          </h3>
          <p className="price shrink-0 text-[1.02rem]">{formatPrice(product.price, product.currency)}</p>
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-muted">{product.description}</p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <Badge tone="neutral">{product.merchant}</Badge>
          {product.previousPrice != null && product.previousPrice > product.price && (
            <Badge tone="verified">
              Was {formatPrice(product.previousPrice, product.currency)}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
