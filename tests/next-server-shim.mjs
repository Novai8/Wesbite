/**
 * Minimal `next/server` stand-in for `node --test`.
 *
 * The real module pulls in Next's bundler-specific internals (extensionless
 * subpath resolution that bare Node ESM cannot load). Route tests only need
 * `NextResponse.json`, which is a thin JSON `Response` wrapper.
 */
export class NextResponse extends Response {
  static json(body, init = {}) {
    const headers = new Headers(init.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return new NextResponse(JSON.stringify(body), { ...init, headers });
  }

  static redirect(url, init = {}) {
    return new NextResponse(null, {
      ...init,
      status: init.status ?? 307,
      headers: { ...init.headers, location: String(url) },
    });
  }
}

export class NextRequest extends Request {}

/**
 * `next/cache` is pulled in by route modules that call `revalidatePath`.
 * Outside a Next runtime there is nothing to revalidate, so these are no-ops.
 */
export function revalidatePath() {}

export function revalidateTag() {}
