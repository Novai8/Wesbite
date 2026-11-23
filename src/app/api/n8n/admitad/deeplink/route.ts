/**
 * POST /api/n8n/admitad/deeplink
 *
 * Generates and validates a tracked link for one destination URL. This is the
 * endpoint to use when verifying the integration against a live account:
 * it exercises deeplink generation and `/validate_links/` in one call and
 * returns Admitad's own message verbatim.
 *
 * Body: { campaignId: number, url: string, subid?: string, validate?: boolean }
 */

import { NextResponse } from "next/server";
import { generateDeeplink, validateDeeplink } from "@/lib/admitad/deeplink";
import { ADMITAD_DEEPLINK_DOMAIN } from "@/lib/admitad/mapper";
import { isAdmitadFullyConfigured, getAdmitadConfig } from "@/lib/admitad/config";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { requireWorkflowAuth } from "@/lib/workflow-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = requireWorkflowAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = rateLimit(clientKey(req, "n8n-admitad-deeplink"), 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Retry in ${rl.resetInSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.resetInSec) } },
    );
  }

  let body: { campaignId?: unknown; url?: unknown; subid?: unknown; validate?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const campaignId = Number(body.campaignId);
  if (!Number.isFinite(campaignId) || campaignId <= 0) {
    return NextResponse.json({ error: "campaignId must be a positive number." }, { status: 422 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("protocol");
  } catch {
    return NextResponse.json({ error: "url must be an absolute HTTPS URL." }, { status: 422 });
  }

  if (!isAdmitadFullyConfigured(getAdmitadConfig())) {
    return NextResponse.json(
      {
        error:
          "Deeplinks need ADMITAD_CLIENT_ID, ADMITAD_CLIENT_SECRET and ADMITAD_WEBSITE_ID (or ADMITAD_ACCESS_TOKEN + ADMITAD_WEBSITE_ID).",
        configured: false,
      },
      { status: 503 },
    );
  }

  try {
    const link = await generateDeeplink(campaignId, {
      ulp: url,
      subid: typeof body.subid === "string" ? body.subid : undefined,
    });

    let hostOk = false;
    try {
      hostOk = new URL(link.link).hostname.endsWith(ADMITAD_DEEPLINK_DOMAIN);
    } catch {
      hostOk = false;
    }

    const validation = body.validate === false ? undefined : await validateDeeplink(link.link);

    return NextResponse.json({
      ok: Boolean(validation?.ok ?? hostOk),
      link: link.link,
      isAffiliateProduct: link.is_affiliate_product ?? null,
      hostOnTrackingDomain: hostOk,
      validation: validation ? { ok: validation.ok, message: validation.message } : "skipped",
      note:
        validation && !validation.ok
          ? "Admitad generated the link but validation did not confirm it will be paid. Do not publish this row until the programme/domain issue is resolved."
          : undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Deeplink generation failed." },
      { status: 502 },
    );
  }
}