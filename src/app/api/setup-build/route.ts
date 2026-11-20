import { NextResponse } from "next/server";
import { buildSetup } from "@/lib/recommendation-engine";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { parseShoppingInput } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "setup-build"), 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.resetInSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.resetInSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseShoppingInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = buildSetup({ ...parsed.value, mode: "setup-builder" });

  return NextResponse.json({
    categories: result.categories.map((c) => ({
      categorySlug: c.categorySlug,
      product: c.product,
      allocated: c.allocated,
    })),
    total: Number(result.total.toFixed(2)),
    remaining: Number(result.remaining.toFixed(2)),
    overBudget: result.overBudget,
    explanation: result.explanation,
    warnings: result.warnings,
  });
}
