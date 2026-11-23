/**
 * Admitad API types.
 *
 * Field names mirror the official publisher API responses exactly (snake_case)
 * so nothing is lost in translation. Mapping to Fyndra camelCase happens in
 * `mapper.ts`, in one place, where it can be tested.
 */

export interface AdmitadConfig {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  websiteId?: string;
  campaignId?: string;
  feedUrl?: string;
  scope?: string;
}

export interface AdmitadConfigStatus {
  configured: boolean;
  canGenerateDeeplinks: boolean;
  usingStaticAccessToken: boolean;
  websiteIdPresent: boolean;
  campaignIdPresent: boolean;
  missing: string[];
}

export interface AdmitadTokenResponse {
  access_token: string;
  token_type: "bearer" | string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  username?: string;
  group?: string;
}

export interface AdmitadApiError {
  error?: string;
  error_code?: number;
  error_description?: string;
}

/** Codes documented at docs/research/admitad-api-notes.md. */
export const ADMITAD_ERROR_CODES = {
  0: "The token expired",
  1: "Incorrect or invalid token",
  2: "The key has no sufficient access rights for the operation",
  3: "Incorrect request",
  4: "The maximum number of requests for the period expired",
  5: "The refresh token is unavailable",
  6: "The maximum number of tokens has been exceeded",
} as const;

export interface AdmitadPagedResponse<T> {
  results: T[];
  _meta: { count: number; limit: number; offset: number };
}

export interface AdmitadRegion {
  region: string;
}

export interface AdmitadCategory {
  id: number;
  name: string;
  language?: string;
  parent?: AdmitadCategory | null;
}

export interface AdmitadAction {
  id: number;
  name: string;
  type: "sale" | "lead" | string;
  payment_size?: string;
}

export interface AdmitadFeedInfo {
  name?: string;
  xml_link?: string;
  csv_link?: string;
  admitad_last_update?: string;
  advertiser_last_update?: string;
}

/** Item from `GET /advcampaigns/`. */
export interface AdmitadCampaign {
  id: number;
  name: string;
  status: string;
  site_url?: string;
  description?: string;
  currency?: string;
  regions?: AdmitadRegion[];
  categories?: AdmitadCategory[];
  actions?: AdmitadAction[];
  image?: string;
  connected?: boolean;
  allow_deeplink?: boolean;
  show_products_links?: boolean;
  exclusive?: boolean;
  rating?: string;
}

/** Item from `GET /advcampaigns/website/{w_id}/` — the publisher view. */
export interface AdmitadCampaignForWebsite extends AdmitadCampaign {
  connection_status?: "active" | "pending" | "declined" | string;
  gotolink?: string;
  products_csv_link?: string;
  products_xml_link?: string;
  feeds_info?: AdmitadFeedInfo[];
  allowed_deeplink_domains?: string[];
  moderation?: boolean;
}

export interface AdmitadDeeplinkResult {
  link: string;
  /** AliExpress only: true = affiliate, false = non-affiliate, null = unknown. */
  is_affiliate_product?: boolean | null;
}

export interface AdmitadWebsite {
  id: number;
  name: string;
  site_url?: string;
  status?: string;
  validation_passed?: boolean;
}

export interface AdmitadCommissionRate {
  product_name: string | null;
  commission_rate: number | null;
  hot_commission_rate: number | null;
  is_hot: boolean;
  url: string;
}

export interface AdmitadStatisticsRow {
  currency?: string;
  clicks?: number;
  views?: number;
  leads_sum?: number;
  sales_sum?: number;
  payment_sum_open?: number;
  payment_sum_approved?: number;
  payment_sum_declined?: number;
  cr?: number;
  ctr?: number;
  ecpc?: number;
  ecpm?: number;
  [key: string]: unknown;
}

/** Normalised row produced by the feed parser, before mapping to a Product. */
export interface FeedRow {
  external_product_id: string;
  title: string;
  description?: string;
  image_url?: string;
  product_url: string;
  price?: number;
  original_price?: number;
  currency?: string;
  category?: string;
  availability?: string;
  brand?: string;
  raw?: Record<string, string>;
}

export type FeedFormat = "csv" | "xml" | "json" | "unknown";

export interface FeedParseResult {
  format: FeedFormat;
  rows: FeedRow[];
  /** Columns seen in the file but not mapped to a canonical field. */
  unmappedColumns: string[];
  /** Rows that were skipped, with the reason. */
  skipped: { index: number; reason: string }[];
  totalRows: number;
}