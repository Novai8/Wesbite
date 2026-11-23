/**
 * Publisher ad spaces (`/websites/v2/`).
 * Used at setup time to confirm ADMITAD_WEBSITE_ID is valid and verified.
 */

import { admitadRequest } from "./client";
import type { AdmitadPagedResponse, AdmitadWebsite } from "./types";

export async function listWebsites(): Promise<AdmitadWebsite[]> {
  const data = await admitadRequest<AdmitadPagedResponse<AdmitadWebsite> | AdmitadWebsite[]>(
    "/websites/v2/",
  );
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
}

export async function getWebsite(id: number | string): Promise<AdmitadWebsite | null> {
  return admitadRequest<AdmitadWebsite | null>(
    `/websites/v2/${encodeURIComponent(String(id))}/`,
  );
}