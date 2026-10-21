import { NextResponse } from "next/server";

export type VerifiedUser = { id: string; email?: string };

export async function requireSupabaseUser(request: Request): Promise<VerifiedUser | NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Account authentication is not configured. Please contact the site administrator." }, { status: 503 });
  }
  if (!match) {
    return NextResponse.json({ error: "Sign in to use Rapigents Assistant and integrations." }, { status: 401 });
  }
  try {
    const response = await fetch(new URL("/auth/v1/user", url).toString(), {
      headers: { apikey: anonKey, Authorization: "Bearer " + match[1] },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return NextResponse.json({ error: "Your sign-in session is invalid or expired. Sign in again." }, { status: 401 });
    const user = await response.json() as { id?: unknown; email?: unknown };
    if (typeof user.id !== "string" || !user.id) return NextResponse.json({ error: "Your sign-in session could not be verified." }, { status: 401 });
    return { id: user.id, ...(typeof user.email === "string" ? { email: user.email } : {}) };
  } catch {
    return NextResponse.json({ error: "Could not verify your sign-in session. Try again." }, { status: 503 });
  }
}

export function isAuthError(value: VerifiedUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
