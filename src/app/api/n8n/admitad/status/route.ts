/**
 * GET /api/n8n/admitad/status
 *
 * Connection + availability report for the workflow. Reports configuration
 * *presence* only — never a credential value. Live API checks run only when
 * credentials exist; otherwise the response says exactly what is missing.
 */

import { NextResponse } from "next/server";
import {
  checkAliExpressAvailability,
  describeConfig,
  getAccessToken,
  getAdmitadConfig,
  getWebsite,
  isAdmitadConfigured,
  isAdmitadFullyConfigured,
  listWebsiteProgrammes,
} from "@/lib/admitad";
import {
  checkFeedPermission,
  describeFeedEntries,
  type FeedPermission,
} from "@/lib/admitad/permissions";
import { isSupabaseConfigured } from "@/lib/supabase-rest";
import { requireWorkflowAuth } from "@/lib/workflow-auth";

export const runtime = "nodejs";

/**
 * A check is only ever `ok` when the call actually succeeded. Everything else
 * is `failed`, `skipped` (no credentials), or `not_run` (needs a later step).
 * This shape exists so a caller cannot mistake "not attempted" for "healthy".
 */
interface CheckResult {
  status: "ok" | "failed" | "skipped" | "not_run";
  detail: string;
  data?: unknown;
}

function errorDetail(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error.";
}

/**
 * Per-programme permission state for the diagnostics view.
 *
 * Includes the feed ids we know about (never the signed URLs) plus the exact
 * reason the importer would accept or refuse. `ambiguous` is listed explicitly
 * so an operator can see the contradiction without reading logs.
 */
function summarisePermissions(
  programmes: Awaited<ReturnType<typeof listWebsiteProgrammes>>,
): {
  counts: Record<string, number>;
  programmes: Array<{
    id: number;
    name: string;
    state: FeedPermission["state"];
    reason: string;
    feedIds: string[];
    evidence: FeedPermission["evidence"];
  }>;
} {
  const counts: Record<string, number> = { allowed: 0, ambiguous: 0, denied: 0 };
  const rows = programmes.map((programme) => {
    const permission = checkFeedPermission(programme);
    counts[permission.state] = (counts[permission.state] ?? 0) + 1;
    return {
      id: programme.id,
      name: programme.name,
      state: permission.state,
      reason: permission.reason,
      feedIds: describeFeedEntries(programme)
        .map((entry) => entry.feedId)
        .filter((id): id is string => Boolean(id)),
      evidence: permission.evidence,
    };
  });
  return { counts, programmes: rows };
}

export async function GET(req: Request) {
  const auth = requireWorkflowAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const config = getAdmitadConfig();
  const status = describeConfig(config);

  const base = {
    admitad: status,
    supabase: { configured: isSupabaseConfigured() },
    groq: { configured: Boolean(process.env.GROQ_API_KEY) },
    // This endpoint proves configuration and connectivity. It never imports
    // products, so those steps are explicitly reported as not run.
    checks: {
      oauth: { status: "skipped", detail: "No credentials." } as CheckResult,
      website: { status: "skipped", detail: "No credentials." } as CheckResult,
      programmes: { status: "skipped", detail: "No credentials." } as CheckResult,
      feedDownload: {
        status: "not_run",
        detail: "Feed retrieval happens in the import endpoint, not the status check.",
      } as CheckResult,
      productImport: {
        status: "not_run",
        detail: "Importing is a separate, explicit action; nothing was written.",
      } as CheckResult,
    },
  };

  if (!isAdmitadConfigured(config)) {
    return NextResponse.json({
      ...base,
      live: false,
      message:
        "Admitad credentials are not configured. Add ADMITAD_CLIENT_ID and ADMITAD_CLIENT_SECRET (and ADMITAD_WEBSITE_ID) to the server environment, then re-run this check.",
    });
  }

  try {
    // A real token request: this is the strongest proof the credentials work.
    await getAccessToken();
    base.checks.oauth = {
      status: "ok",
      detail: config.accessToken
        ? "Using the static ADMITAD_ACCESS_TOKEN; it was not re-validated against the API."
        : "OAuth client-credentials grant succeeded.",
    };
  } catch (err) {
    base.checks.oauth = { status: "failed", detail: errorDetail(err) };
    return NextResponse.json(
      { ...base, live: false, error: "Admitad OAuth failed; later checks were not run." },
      { status: 502 },
    );
  }

  try {
    if (!isAdmitadFullyConfigured(config)) {
      return NextResponse.json({
        ...base,
        live: true,
        message: "OAuth credentials are present but ADMITAD_WEBSITE_ID is missing; programme and AliExpress checks need an ad space.",
      });
    }

    try {
      const website = await getWebsite(config.websiteId as string);
      base.checks.website = website
        ? {
            status: "ok",
            detail: "ADMITAD_WEBSITE_ID resolves to this publisher ad space.",
            data: {
              id: website.id,
              name: website.name,
              status: website.status ?? null,
              validationPassed: website.validation_passed ?? null,
            },
          }
        : { status: "failed", detail: "Admitad returned no ad space for ADMITAD_WEBSITE_ID." };
      if (!website) {
        return NextResponse.json(
          { ...base, live: false, error: "ADMITAD_WEBSITE_ID did not resolve." },
          { status: 502 },
        );
      }
    } catch (err) {
      base.checks.website = { status: "failed", detail: errorDetail(err) };
      return NextResponse.json(
        { ...base, live: false, error: "Ad-space lookup failed." },
        { status: 502 },
      );
    }

    try {
      const [aliExpress, programmes] = await Promise.all([
        checkAliExpressAvailability(),
        listWebsiteProgrammes({ connectionStatus: "active" }),
      ]);

      base.checks.programmes = {
        status: "ok",
        detail: `${programmes.length} active programme(s) on this ad space.`,
        data: {
          aliExpress,
          connectedProgrammes: programmes.length,
          // Counted by permission *state*, never by "a download link exists".
          // A link is not permission; see lib/admitad/permissions.ts.
          feedPermissions: summarisePermissions(programmes),
        },
      };

      return NextResponse.json({
        ...base,
        live: true,
        aliExpress,
        feedPermission: aliExpress.programme
          ? checkFeedPermission(aliExpress.programme)
          : null,
      });
    } catch (err) {
      base.checks.programmes = { status: "failed", detail: errorDetail(err) };
      return NextResponse.json(
        { ...base, live: false, error: "Programme listing failed." },
        { status: 502 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        ...base,
        live: false,
        error: err instanceof Error ? err.message : "Admitad status check failed.",
      },
      { status: 502 },
    );
  }
}
