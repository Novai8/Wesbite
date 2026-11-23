/**
 * Admitad OAuth2 token management.
 *
 * Documented flow (client credentials):
 *   POST https://api.admitad.com/token/
 *   Authorization: Basic base64(client_id:client_secret)
 *   Content-Type: application/x-www-form-urlencoded
 *   grant_type=client_credentials&client_id=…&scope=scope1 scope2
 *
 * The response carries `access_token`, `expires_in` (~604800s / 7 days) and a
 * `refresh_token`. Tokens are cached per runtime isolate and refreshed with a
 * safety margin. `ADMITAD_ACCESS_TOKEN`, when present, is used as-is.
 *
 * Server-only: never import this from a `"use client"` module.
 */

import { ADMITAD_API_BASE, ADMITAD_SCOPES, getAdmitadConfig } from "./config";
import type { AdmitadApiError, AdmitadTokenResponse } from "./types";

interface CachedToken {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

/** Refresh a little early so a token can never expire mid-request. */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;
/** If the API omits `expires_in`, assume the documented 7 days. */
const DEFAULT_TTL_SECONDS = 604_800;

let cached: CachedToken | null = null;
let inFlight: Promise<CachedToken> | null = null;

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
}

function tokenRequestBody(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

async function readToken(res: Response, context: string): Promise<AdmitadTokenResponse> {
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Admitad ${context} returned non-JSON (${res.status}).`);
  }
  if (!res.ok) {
    const err = parsed as AdmitadApiError;
    const detail = err.error_description ?? err.error ?? text.slice(0, 200);
    throw new Error(`Admitad ${context} failed (${res.status}): ${detail}`);
  }
  const token = parsed as AdmitadTokenResponse;
  if (!token.access_token) {
    throw new Error(`Admitad ${context} succeeded but returned no access_token.`);
  }
  return token;
}

async function fetchToken(): Promise<CachedToken> {
  const config = getAdmitadConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      "Admitad client credentials are missing. Set ADMITAD_CLIENT_ID and ADMITAD_CLIENT_SECRET.",
    );
  }

  const scope = config.scope?.trim() || ADMITAD_SCOPES.join(" ");

  const res = await fetch(`${ADMITAD_API_BASE}/token/`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(config.clientId, config.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: tokenRequestBody({
      grant_type: "client_credentials",
      client_id: config.clientId,
      scope,
    }),
    cache: "no-store",
  });

  const token = await readToken(res, "token request");
  const ttlSeconds = Number.isFinite(token.expires_in) ? token.expires_in : DEFAULT_TTL_SECONDS;
  return {
    accessToken: token.access_token,
    expiresAt: Date.now() + Math.max(ttlSeconds * 1000 - EXPIRY_MARGIN_MS, 30_000),
    refreshToken: token.refresh_token,
  };
}

async function refreshToken(refresh: string): Promise<CachedToken> {
  const config = getAdmitadConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Cannot refresh an Admitad token without client credentials.");
  }
  const res = await fetch(`${ADMITAD_API_BASE}/token/`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(config.clientId, config.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: tokenRequestBody({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refresh,
    }),
    cache: "no-store",
  });
  const token = await readToken(res, "token refresh");
  const ttlSeconds = Number.isFinite(token.expires_in) ? token.expires_in : DEFAULT_TTL_SECONDS;
  return {
    accessToken: token.access_token,
    expiresAt: Date.now() + Math.max(ttlSeconds * 1000 - EXPIRY_MARGIN_MS, 30_000),
    refreshToken: token.refresh_token ?? refresh,
  };
}

/**
 * Returns a usable bearer token, minting one if required.
 * Concurrent callers share one in-flight request.
 */
export async function getAccessToken(): Promise<string> {
  const config = getAdmitadConfig();

  // A statically supplied token wins: it may belong to a flow we cannot refresh.
  if (config.accessToken) return config.accessToken;

  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

  if (!inFlight) {
    inFlight = (async () => {
      try {
        if (cached?.refreshToken) {
          return await refreshToken(cached.refreshToken);
        }
        return await fetchToken();
      } catch (err) {
        // A stale refresh token should not strand us — fall back to a fresh grant.
        if (cached?.refreshToken && config.clientId && config.clientSecret) {
          cached = null;
          return await fetchToken();
        }
        throw err;
      } finally {
        inFlight = null;
      }
    })();
  }

  cached = await inFlight;
  return cached.accessToken;
}

/**
 * Called after a 401: discards the cached token so the next call mints a
 * new one. Uses the refresh token when available.
 */
export async function invalidateAccessToken(): Promise<void> {
  if (cached?.refreshToken) {
    try {
      cached = await refreshToken(cached.refreshToken);
      return;
    } catch {
      // fall through to a full grant
    }
  }
  cached = null;
}

/** Test/dev helper — never called from application code. */
export function resetTokenCache(): void {
  cached = null;
  inFlight = null;
}