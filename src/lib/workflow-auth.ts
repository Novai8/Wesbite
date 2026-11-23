/**
 * Auth for workflow-facing API routes.
 *
 * Fail-closed: when `N8N_WEBHOOK_SECRET` is unset, every workflow endpoint
 * refuses all traffic. When set, callers must present
 * `Authorization: Bearer <secret>`. Comparison is constant-time-ish via length
 * check + timing-safe compare over a fixed-size digest of the supplied token.
 */

import { createHash, timingSafeEqual } from "node:crypto";

export const WORKFLOW_SECRET_ENV = "N8N_WEBHOOK_SECRET";

export interface AuthResult {
  ok: boolean;
  status: number;
  error?: string;
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function requireWorkflowAuth(req: Request): AuthResult {
  const secret = process.env[WORKFLOW_SECRET_ENV]?.trim();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error:
        "Workflow endpoints are disabled: N8N_WEBHOOK_SECRET is not set. Set it to enable authenticated automation.",
    };
  }

  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return { ok: false, status: 401, error: "Missing Authorization: Bearer <token> header." };
  }

  const supplied = sha256(match[1].trim());
  const expected = sha256(secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return { ok: false, status: 401, error: "Invalid workflow token." };
  }

  return { ok: true, status: 200 };
}