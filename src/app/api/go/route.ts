import { NextResponse } from "next/server";
import { recordClick, validateAffiliateUrl } from "@/lib/affiliate";
import { getCatalogue, getProductBySlug } from "@/lib/catalogue";
import { getLiveCatalogue } from "@/lib/catalogue-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing product id." }, { status: 400 });
  }

  // Seed lookup is synchronous and always available; imported products live in
  // Supabase, so fall through to the live catalogue only when the seed misses.
  let product = getCatalogue().find((p) => p.id === id) ?? getProductBySlug(id);

  if (!product) {
    const live = await getLiveCatalogue();
    product = live.find((p) => p.id === id || p.slug === id);
  }

  if (!product) {
    return NextResponse.json({ error: "Unknown product." }, { status: 404 });
  }

  const check = validateAffiliateUrl(product.affiliateUrl, product.programSlug);
  if (!check.ok) {
    console.error(`[affiliate-refused] ${product.id}: ${check.reason}`);
    return NextResponse.json(
      { error: "This product's purchase link failed validation and was not opened." },
      { status: 502 },
    );
  }

  await recordClick(product, searchParams.get("src") ?? undefined);

  // 302 (temporary) so affiliate networks never cache the redirect target.
  return NextResponse.redirect(product.affiliateUrl, {
    status: 302,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
