const errorResponse = (message, status) => new Response(JSON.stringify({ error: { message } }), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method !== "GET") {
    return errorResponse("Only GET requests are supported.", 405);
  }

  if (!env.CINEPRO_BASE_URL) {
    return errorResponse("CinePro is not configured. Add CINEPRO_BASE_URL as a Cloudflare Pages secret or environment variable.", 503);
  }

  let base;
  try {
    base = new URL(env.CINEPRO_BASE_URL);
    if (base.protocol !== "https:" || base.username || base.password) {
      return errorResponse("CINEPRO_BASE_URL must be an HTTPS URL without embedded credentials.", 500);
    }
  } catch (_) {
    return errorResponse("CINEPRO_BASE_URL is not a valid URL.", 500);
  }

  const parts = Array.isArray(params.path) ? params.path : [params.path || ""];
  const path = parts.join("/");
  const movieMatch = path.match(/^v1\/movies\/(\d{1,20})$/);
  const episodeMatch = path.match(/^v1\/tv\/(\d{1,20})\/seasons\/(\d{1,2})\/episodes\/(\d{1,4})$/);

  if (!movieMatch && !episodeMatch) {
    return errorResponse("This CinePro endpoint is not available through Rapiflix.", 404);
  }
  if (episodeMatch && (Number(episodeMatch[2]) > 99 || Number(episodeMatch[3]) < 1 || Number(episodeMatch[3]) > 9999)) {
    return errorResponse("The requested season or episode is outside the supported range.", 400);
  }

  const upstream = new URL(path, base.origin + "/");
  try {
    const upstreamResponse = await fetch(upstream.toString(), {
      headers: { "Accept": "application/json" },
      signal: request.signal
    });
    const text = await upstreamResponse.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      return errorResponse("CinePro returned a non-JSON response.", 502);
    }

    if (upstreamResponse.ok) {
      const absolute = (value) => {
        if (typeof value !== "string" || !value) return value;
        try {
          const resolved = new URL(value, base.origin);
          return resolved.origin === base.origin ? resolved.toString() : value;
        } catch (_) {
          return value;
        }
      };
      if (Array.isArray(data.sources)) {
        data.sources = data.sources.map((source) => ({ ...source, url: absolute(source.url) }));
      }
      if (Array.isArray(data.subtitles)) {
        data.subtitles = data.subtitles.map((track) => ({ ...track, url: absolute(track.url) }));
      }
    }

    return new Response(JSON.stringify(data), {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": upstreamResponse.ok ? "no-store" : "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (_) {
    return errorResponse("CinePro could not be reached. Check the backend URL and deployment status.", 502);
  }
}
