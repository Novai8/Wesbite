/**
 * Minimal in-memory rate limiter for API routes.
 *
 * Suitable for a single Cloudflare Worker instance / dev. For multi-instance
 * deployments, move the bucket store to a shared KV (Durable Objects on
 * Cloudflare, Supabase, or Upstash) — the interface stays the same.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSec: number;
}

export function rateLimit(key: string, limit = 10, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetInSec: Math.ceil(windowMs / 1000) };
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetInSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    resetInSec: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "local";
  const ip = fwd.split(",")[0].trim();
  return `${scope}:${ip}`;
}
