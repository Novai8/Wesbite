/**
 * POST /api/n8n/admitad/enrich
 *
 * Runs AI copy generation for one product record supplied by the workflow, and
 * persists only the `ai_*` fields. Product facts in the payload are ignored on
 * the way out — they are read from the stored row, not from the request body.
 */

import { NextResponse } from "next/server";
import { enrichProduct, computeQualityFlags } from "@/lib/admitad/enrich";
import { getSupabaseConfig, selectRows, SUPABASE_TABLES } from "@/lib/supabase-rest";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { requireWorkflowAuth } from "@/lib/workflow-auth";
import type { Product } from "@/lib/types";
import { fromProductRow } from "@/lib/admitad/supabase-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = requireWorkflowAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = rateLimit(clientKey(req, "n8n-admitad-enrich"), 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Retry in ${rl.resetInSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.resetInSec) } },
    );
  }

  let body: { productId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const productId = typeof body.productId === "string" ? body.productId : "";
  if (!productId) {
    return NextResponse.json({ error: "productId is required." }, { status: 422 });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Supabase is not configured, so there is no stored record to enrich." },
      { status: 503 },
    );
  }

  const rows = await selectRows<Record<string, unknown>>(
    SUPABASE_TABLES.products,
    { select: "*", id: `eq.${productId}`, limit: 1 },
    config,
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const product: Product = fromProductRow(rows[0]);
  if (product.dataSource === "manual") {
    return NextResponse.json(
      { error: "This is a manually curated record; AI copy is not applied to manual rows." },
      { status: 409 },
    );
  }

  const result = await enrichProduct({ product, keywords: product.keywords });
  if (!result.configured) {
    return NextResponse.json(
      {
        configured: false,
        qualityFlags: result.qualityFlags ?? computeQualityFlags(product),
        message: "GROQ_API_KEY is not set. Quality flags were computed locally; no copy was generated.",
      },
      { status: 200 },
    );
  }

  const patched = await patchAiFields(productId, config, result);
  if (!patched) {
    return NextResponse.json({ error: "Failed to store AI fields." }, { status: 502 });
  }

  return NextResponse.json({
    configured: true,
    provider: result.provider,
    headline: result.headline ?? null,
    description: result.description ?? null,
    qualityFlags: result.qualityFlags ?? [],
    warning: result.error ?? null,
  });
}

async function patchAiFields(
  productId: string,
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  result: Awaited<ReturnType<typeof enrichProduct>>,
): Promise<boolean> {
  const url = new URL(`${config.url}/rest/v1/${SUPABASE_TABLES.products}`);
  url.searchParams.set("id", `eq.${productId}`);
  url.searchParams.set("data_source", "neq.manual");
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      ai_headline: result.headline ?? null,
      ai_description: result.description ?? null,
      ai_quality_flags: result.qualityFlags ?? [],
    }),
    cache: "no-store",
  });
  return res.ok;
}