/**
 * GET /api/n8n/admitad/aliexpress
 *
 * Answers the question the brief asks directly: is AliExpress WW available to
 * this publisher account, and can it be used for products and deeplinks?
 * Reads the ad-space programme list — the only authoritative source.
 */

import { NextResponse } from "next/server";
import { checkAliExpressAvailability, getProgramme } from "@/lib/admitad/programmes";
import { describeConfig, getAdmitadConfig, isAdmitadConfigured } from "@/lib/admitad/config";
import { requireWorkflowAuth } from "@/lib/workflow-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = requireWorkflowAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const config = getAdmitadConfig();
  if (!isAdmitadConfigured(config)) {
    return NextResponse.json(
      {
        checked: false,
        missing: describeConfig(config).missing,
        message:
          "Admitad credentials are not configured, so availability cannot be checked. This is not a 'not available' answer — it is an 'unknown' one.",
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";

  try {
    const availability = await checkAliExpressAvailability({ bypassCache: refresh, websiteId: config.websiteId });

    let catalogueEntry = null;
    if (availability.programme) {
      try {
        catalogueEntry = await getProgramme(availability.programme.id);
      } catch {
        catalogueEntry = null;
      }
    }

    return NextResponse.json({
      checked: true,
      available: availability.available,
      connectionStatus: availability.connectionStatus ?? null,
      canImportProducts: availability.canImportProducts,
      canUseDeeplinks: availability.canUseDeeplinks,
      reason: availability.reason,
      programme: availability.programme
        ? {
            id: availability.programme.id,
            name: availability.programme.name,
            siteUrl: availability.programme.site_url ?? null,
            currency: availability.programme.currency ?? null,
            deeplinkAllowed: availability.programme.allow_deeplink ?? null,
            showProductsLinks: availability.programme.show_products_links ?? null,
            hasCsvFeed: Boolean(availability.programme.products_csv_link || availability.programme.feeds_info?.some((f) => f.csv_link)),
            hasXmlFeed: Boolean(availability.programme.products_xml_link || availability.programme.feeds_info?.some((f) => f.xml_link)),
          }
        : null,
      catalogueRating: catalogueEntry?.rating ?? null,
      approvalNote:
        "If status is pending or the programme is absent: open Admitad → Catalogue → AliExpress WW → Join. Approval is the advertiser's decision and can take days.",
    });
  } catch (err) {
    return NextResponse.json(
      { checked: false, error: err instanceof Error ? err.message : "Availability check failed." },
      { status: 502 },
    );
  }
}