/**
 * Statistics and AliExpress commission lookups.
 *
 * Reports are read-only and used for the admin summary / n8n execution
 * summary. Dates use Admitad's documented `dd.mm.yyyy` format.
 */

import { admitadRequest } from "./client";
import type {
  AdmitadCommissionRate,
  AdmitadPagedResponse,
  AdmitadStatisticsRow,
} from "./types";

export type StatisticsScope = "websites" | "campaigns" | "dates" | "actions" | "sources" | "sub_ids";

export interface StatisticsQuery {
  dateStart?: Date;
  dateEnd?: Date;
  website?: string;
  campaign?: string;
  limit?: number;
  offset?: number;
  total?: boolean;
  orderBy?: string;
}

/** `dd.mm.yyyy`, the only format the reports accept. */
export function formatAdmitadDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

export async function getStatistics(
  scope: StatisticsScope,
  query: StatisticsQuery = {},
): Promise<AdmitadStatisticsRow[]> {
  const data = await admitadRequest<AdmitadPagedResponse<AdmitadStatisticsRow> | AdmitadStatisticsRow[]>(
    `/statistics/${scope}/`,
    {
      query: {
        date_start: query.dateStart ? formatAdmitadDate(query.dateStart) : undefined,
        date_end: query.dateEnd ? formatAdmitadDate(query.dateEnd) : undefined,
        website: query.website,
        campaign: query.campaign,
        limit: query.limit ?? 100,
        offset: query.offset ?? 0,
        total: query.total ? 1 : undefined,
        order_by: query.orderBy,
      },
    },
  );
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
}

/**
 * AliExpress commission rates for up to 20 product URLs per call.
 * Returns nulls for URLs the API could not match — never invent a rate.
 */
export async function getAliExpressCommissionRates(
  urls: string[],
): Promise<AdmitadCommissionRate[]> {
  if (urls.length === 0) return [];
  const data = await admitadRequest<{ commission_rates?: AdmitadCommissionRate[] }>(
    "/aliexpress/commission_rates/",
    { method: "POST", body: { urls: urls.slice(0, 20) } },
  );
  return data?.commission_rates ?? [];
}