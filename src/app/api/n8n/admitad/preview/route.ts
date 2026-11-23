/**
 * POST /api/n8n/admitad/preview
 *
 * Parses a feed without calling Admitad or writing anything. This is the
 * endpoint to use when credentials are not yet available: it proves the parser,
 * column mapping and category inference against a real exported file, and
 * reports exactly which rows would fail and why.
 *
 * Body: { feedText: string, campaignId: number, maxRows?: number, defaultCurrency?: string }
 */

import { NextResponse } from "next/server";
import { parseFeed } from "@/lib/admitad/feed-parser";
import { inferBudgetTier, inferCategory, productSourceKey, buildProductSlug } from "@/lib/admitad/mapper";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { requireWorkflowAuth } from "@/lib/workflow-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = requireWorkflowAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = rateLimit(clientKey(req, "n8n-admitad-preview"), 12, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many previews. Retry in ${rl.resetInSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.resetInSec) } },
    );
  }

  let body: { feedText?: unknown; campaignId?: unknown; maxRows?: unknown; defaultCurrency?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const feedText = typeof body.feedText === "string" ? body.feedText : "";
  if (!feedText.trim()) {
    return NextResponse.json({ error: "feedText is required (the raw CSV/XML/JSON file contents)." }, { status: 422 });
  }
  if (feedText.length > 4_000_000) {
    return NextResponse.json({ error: "Feed is larger than the 4 MB preview limit." }, { status: 413 });
  }

  const campaignId = Number(body.campaignId);
  const maxRows = Number.isFinite(Number(body.maxRows)) ? Math.min(Number(body.maxRows), 500) : 50;

  const parsed = parseFeed(feedText, {
    maxRows,
    defaultCurrency: typeof body.defaultCurrency === "string" ? body.defaultCurrency : undefined,
  });

  return NextResponse.json({
    format: parsed.format,
    totalRows: parsed.totalRows,
    parsedRows: parsed.rows.length,
    unmappedColumns: parsed.unmappedColumns,
    skipped: parsed.skipped.slice(0, 25),
    sample: parsed.rows.slice(0, 5).map((row) => ({
      externalProductId: row.external_product_id,
      dedupeKey: productSourceKey("admitad", row.external_product_id),
      tier: inferBudgetTier(row.price),
      category: inferCategory(row.category, row.title),
      title: row.title.slice(0, 90),
      price: row.price,
      currency: row.currency,
      image: Boolean(row.image_url),
      productUrlHost: safeHost(row.product_url),
      hashSlug: buildProductSlug(row.title, row.external_product_id),
      campaignId: Number.isFinite(campaignId) ? campaignId : undefined,
    })),
    note:
      "Preview only. No deeplinks were generated and nothing was written. A deeplink is minted per row at import time.",
  });
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "invalid";
  }
}