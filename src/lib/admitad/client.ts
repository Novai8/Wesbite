/**
 * Thin authenticated fetch wrapper for the Admitad publisher API.
 *
 * Responsibilities, in one place:
 *  - attach the bearer token,
 *  - retry once on 401 (token expired / invalidated),
 *  - retry with exponential backoff on 429 and the documented 503 rate-limit
 *    response (error_code 4),
 *  - surface API errors as typed exceptions instead of silently returning
 *    empty arrays (a failed call must never look like "no products").
 *
 * The API allows up to 600 requests/minute per application. We do not fan out
 * requests here; callers paginate sequentially and can rely on the retry.
 */

import { ADMITAD_API_BASE } from "./config";
import { getAccessToken, invalidateAccessToken } from "./auth";
import { ADMITAD_ERROR_CODES } from "./types";

interface ApiErrorBody {
  error?: string;
  error_code?: number;
  error_description?: string;
}

export class AdmitadApiError extends Error {
  readonly status: number;
  readonly code?: number;
  readonly retryable: boolean;
  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = "AdmitadApiError";
    this.status = status;
    this.code = code;
    this.retryable = status === 429 || status === 503 || (code ?? -1) === 4;
  }
}

const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describe(code: number | undefined, fallback: string): string {
  if (code != null && code in ADMITAD_ERROR_CODES) {
    return ADMITAD_ERROR_CODES[code as keyof typeof ADMITAD_ERROR_CODES];
  }
  return fallback;
}

export interface AdmitadRequestOptions {
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | undefined | null | Array<string | number>>;
  body?: unknown;
  /** Absolute URL; used for feed downloads which live outside the API base. */
  absoluteUrl?: string;
  /** Skip JSON parsing and return the raw response (feeds). */
  raw?: boolean;
  timeoutMs?: number;
}

function buildUrl(path: string, query?: AdmitadRequestOptions["query"]): string {
  const url = new URL(path.startsWith("http") ? path : `${ADMITAD_API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function admitadRequest<T>(path: string, options: AdmitadRequestOptions = {}): Promise<T> {
  const url = buildUrl(options.absoluteUrl ?? path, options.query);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let token: string | undefined;
    // Feed files and other static downloads do not require a bearer token.
    if (!options.absoluteUrl) token = await getAccessToken();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);

    try {
      const res = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);

      if (res.status === 401 && attempt < MAX_ATTEMPTS && !options.absoluteUrl) {
        // Token may have expired or been revoked server-side. Mint a new one.
        await invalidateAccessToken();
        lastError = new AdmitadApiError("Admitad token rejected (401); retrying with a new token.", 401, 1);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        let parsed: ApiErrorBody = {};
        try {
          parsed = text ? (JSON.parse(text) as ApiErrorBody) : {};
        } catch {
          // non-JSON error body
        }
        const err = new AdmitadApiError(
          `Admitad ${options.method ?? "GET"} ${new URL(url).pathname} failed (${res.status}): ` +
            describe(parsed.error_code, parsed.error_description ?? parsed.error ?? text.slice(0, 200)),
          res.status,
          parsed.error_code,
        );
        if (err.retryable && attempt < MAX_ATTEMPTS) {
          lastError = err;
          const retryAfter = Number(res.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : BASE_BACKOFF_MS * 2 ** (attempt - 1);
          await sleep(delay);
          continue;
        }
        throw err;
      }

      if (options.raw) return (await res.text()) as unknown as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : null) as T;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof AdmitadApiError) {
        if (err.retryable && attempt < MAX_ATTEMPTS) {
          lastError = err;
          await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
          continue;
        }
        throw err;
      }
      if (err instanceof Error && err.name === "AbortError") {
        lastError = new Error("Admitad request timed out.");
        if (attempt < MAX_ATTEMPTS) continue;
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_ATTEMPTS) continue;
      }
    }
  }

  throw lastError ?? new Error("Admitad request failed for an unknown reason.");
}
