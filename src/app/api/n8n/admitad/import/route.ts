/**
 * POST /api/n8n/admitad/import
 *
 * Runs one import. Accepts either the feed text inline (small feeds / tests) or
 * a feed URL. When `feedUrl` is omitted the route can resolve the feed link from
 * the ad-space programme object itself (`useProgrammeFeed: true`).
 *
 * Admitad secrets stay in this app's environment: the workflow only needs
 * N8N_WEBHOOK_SECRET. That is deliberate — n8n never stores Admitad credentials.
 *
 * Body:
 *   {
 *     campaignId: number,
 *     feedUrl?: string,
 *     feedText?: string,
 *     useProgrammeFeed?: boolean,
 *     enrich?: boolean,
 *     maxRows?: number,
 *     subid?: string
 *   }
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getWebsiteProgramme,
  runImport,
  type ImportOptions,
} from "@/lib/admitad";
import { getAdmitadConfig, isAdmitadConfigured } from "@/lib/admitad/config";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { requireWorkflowAuth } from "@/lib/workflow-auth";

export const runtime = "nodejs";

interface Body {
  campaignId?: unknown;
  feedUrl?: unknown;
  feedText?: unknown;
  useProgrammeFeed?: unknown;
  enrich?: unknown;
  maxRows?: unknown;
  subid?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(req: Request) {
  const auth = requireWorkflowAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = rateLimit(clientKey(req, "n8n-admitad-import"), 6, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many import runs. Retry in ${rl.resetInSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.resetInSec) } },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const campaignId = Number(body.campaignId);
  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    return NextResponse.json({ error: "campaignId must be a positive number." }, { status: 422 });
  }

  let feedUrl = asString(body.feedUrl);
  const feedText = asString(body.feedText);
  const useProgrammeFeed = body.useProgrammeFeed === true;

  let programme: ImportOptions["programme"];
  let feedResolvedFrom: "body" | "programme" | "text" = feedText ? "text" : "body";

  if (!feedText && !feedUrl) {
    if (!useProgrammeFeed) {
      return NextResponse.json(
        { error: "Provide feedText, feedUrl, or set useProgrammeFeed to true." },
        { status: 422 },
      );
    }
    if (!isAdmitadConfigured()) {
      return NextResponse.json(
        {
          error:
            "Cannot resolve the programme feed without Admitad credentials. Set ADMITAD_CLIENT_ID/SECRET and ADMITAD_WEBSITE_ID, or pass feedUrl directly.",
        },
        { status: 503 },
      );
    }
    const config = getAdmitadConfig();
    const programmeData = await getWebsiteProgramme(campaignId, config.websiteId);
    if (!programmeData) {
      return NextResponse.json(
        { error: `Programme ${campaignId} is not connected to this ad space.` },
        { status: 404 },
      );
    }
    programme = programmeData;
    feedUrl =
      programmeData.products_csv_link ??
      programmeData.products_xml_link ??
      programmeData.feeds_info?.find((f) => f.csv_link)?.csv_link ??
      programmeData.feeds_info?.find((f) => f.xml_link)?.xml_link;
    feedResolvedFrom = "programme";
    if (!feedUrl) {
      return NextResponse.json(
        {
          error:
            "This programme exposes no product-feed link. Confirm show_products_links is enabled and the advertiser has published a feed.",
        },
        { status: 404 },
      );
    }
  } else if (useProgrammeFeed && isAdmitadConfigured()) {
    // Best-effort metadata so merchant naming and currency fallback are correct.
    try {
      programme = (await getWebsiteProgramme(campaignId, getAdmitadConfig().websiteId)) ?? undefined;
    } catch {
      // Metadata is optional; the import still runs with the campaign id.
    }
  }

  try {
    const result = await runImport({
      campaignId,
      feedText,
      feedUrl,
      programme,
      subid: asString(body.subid),
      enrich: body.enrich === true,
      maxRows: Number.isFinite(Number(body.maxRows)) ? Number(body.maxRows) : undefined,
    });

    const { report } = result;
    const status = report.blocked ? 409 : 200;

    // Surface the new rows immediately instead of waiting for the ISR window.
    if (result.persisted && report.imported > 0) {
      revalidatePath("/");
      revalidatePath("/discover");
    }

    return NextResponse.json(
      {
        ok: !report.blocked,
        feedResolvedFrom,
        summary: {
          campaignId: report.campaignId,
          programme: report.programmeName,
          format: report.format,
          totalRows: report.totalRows,
          imported: report.imported,
          duplicates: report.duplicates,
          skipped: report.skipped,
          errors: report.errors.length,
          unmappedColumns: report.unmappedColumns,
          durationMs: new Date(report.finishedAt).getTime() - new Date(report.startedAt).getTime(),
        },
        persisted: result.persisted,
        persistReason: result.persistReason,
        enriched: result.enriched,
        enrichmentNote: result.enrichmentSkipped,
        blockedReason: report.blockedReason,
        // First few errors only: enough to debug, small enough for a log entry.
        errorSample: report.errors.slice(0, 10),
      },
      { status },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed." },
      { status: 500 },
    );
  }
}
