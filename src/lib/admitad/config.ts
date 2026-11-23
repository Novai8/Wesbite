/**
 * Admitad configuration.
 *
 * Server-only. Reads `process.env` lazily so importing this module never
 * throws during a static build and never leaks a value into a client bundle.
 * Nothing here is ever returned to the browser except `describeConfig()`,
 * which reports *presence*, never values.
 */

import type { AdmitadConfig, AdmitadConfigStatus } from "./types";

export const ADMITAD_API_BASE = "https://api.admitad.com";

/**
 * Documented scopes for the publisher endpoints this integration calls.
 * `v_campaigns` style aliases are deliberately absent — the API rejects
 * unknown scopes with a 400 on the token request.
 */
export const ADMITAD_SCOPES = [
  "advcampaigns",
  "advcampaigns_for_website",
  "websites",
  "deeplink_generator",
  "validate_links",
  "statistics",
  "aliexpress_commission",
  "private_data",
  "public_data",
] as const;

function env(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getAdmitadConfig(): AdmitadConfig {
  return {
    clientId: env("ADMITAD_CLIENT_ID"),
    clientSecret: env("ADMITAD_CLIENT_SECRET"),
    accessToken: env("ADMITAD_ACCESS_TOKEN"),
    websiteId: env("ADMITAD_WEBSITE_ID"),
    campaignId: env("ADMITAD_CAMPAIGN_ID"),
    feedUrl: env("ADMITAD_FEED_URL"),
    scope: env("ADMITAD_SCOPE")?.replace(/,/g, " "),
  };
}

/**
 * True when we have enough to attempt the OAuth client-credentials flow.
 * A manually supplied access token also counts — it is the documented
 * bearer token, just obtained out of band.
 */
export function isAdmitadConfigured(config: AdmitadConfig = getAdmitadConfig()): boolean {
  if (config.accessToken) return true;
  return Boolean(config.clientId && config.clientSecret);
}

/** Everything needed to build tracked links and read feed data. */
export function isAdmitadFullyConfigured(config: AdmitadConfig = getAdmitadConfig()): boolean {
  return Boolean(isAdmitadConfigured(config) && config.websiteId);
}

export function describeConfig(config: AdmitadConfig = getAdmitadConfig()): AdmitadConfigStatus {
  const missing: string[] = [];
  if (!config.clientId) missing.push("ADMITAD_CLIENT_ID");
  if (!config.clientSecret) missing.push("ADMITAD_CLIENT_SECRET");
  if (!config.websiteId) missing.push("ADMITAD_WEBSITE_ID");
  return {
    configured: isAdmitadConfigured(config),
    canGenerateDeeplinks: Boolean(isAdmitadFullyConfigured(config) && config.campaignId),
    usingStaticAccessToken: Boolean(config.accessToken) && !(config.clientId && config.clientSecret),
    websiteIdPresent: Boolean(config.websiteId),
    campaignIdPresent: Boolean(config.campaignId),
    missing,
  };
}

/** Thrown when a caller needs credentials that are not present. */
export class AdmitadNotConfiguredError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(
      `Admitad is not configured. Missing: ${missing.join(", ") || "credentials"}. ` +
        "Add them to the server environment — see docs/ENVIRONMENT-VARIABLES.md.",
    );
    this.name = "AdmitadNotConfiguredError";
    this.missing = missing;
  }
}

export function requireAdmitadConfig(): AdmitadConfig {
  const config = getAdmitadConfig();
  if (!isAdmitadConfigured(config)) {
    throw new AdmitadNotConfiguredError(describeConfig(config).missing);
  }
  return config;
}

export function requireWebsiteId(config: AdmitadConfig = getAdmitadConfig()): string {
  if (!config.websiteId) {
    throw new AdmitadNotConfiguredError(["ADMITAD_WEBSITE_ID"]);
  }
  return config.websiteId;
}