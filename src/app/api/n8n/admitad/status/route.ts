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
  getAdmitadConfig,
  isAdmitadConfigured,
  isAdmitadFullyConfigured,
  listWebsiteProgrammes,
} from "@/lib/admitad";
import { isSupabaseConfigured } from "@/lib/supabase-rest";
import { requireWorkflowAuth } from "@/lib/workflow-auth";

export const runtime = "nodejs";

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
    if (!isAdmitadFullyConfigured(config)) {
      return NextResponse.json({
        ...base,
        live: true,
        message: "OAuth credentials are present but ADMITAD_WEBSITE_ID is missing; programme and AliExpress checks need an ad space.",
      });
    }

    const [aliExpress, programmes] = await Promise.all([
      checkAliExpressAvailability(),
      listWebsiteProgrammes({ connectionStatus: "active" }),
    ]);

    return NextResponse.json({
      ...base,
      live: true,
      aliExpress,
      connectedProgrammes: programmes.length,
      programmesWithProducts: programmes.filter(
        (p) => p.show_products_links || p.products_csv_link || p.products_xml_link,
      ).length,
    });
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