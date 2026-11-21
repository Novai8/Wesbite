import { NextResponse } from "next/server";
import { recordClick, validateAffiliateUrl } from "@/lib/affiliate";
import { getCatalogue, getProductBySlug } from "@/lib/catalogue";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing product id." }, { status: 400 });
  }

  // Lookup by id; the discover/product UIs always pass internal ids.
  const product =
    getCatalogue().find((p) => p.id === id) ?? getProductBySlug(id);

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
