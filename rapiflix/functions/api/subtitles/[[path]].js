const API_BASE = "https://api.opensubtitles.com/api/v1";
const APP_AGENT = "RapiflixSubtitles v1.0";

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extra
  }
});

function canonicalTitle(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function subtitleMatch(item) {
  const attributes = item && item.attributes || {};
  const feature = attributes.feature_details || {};
  const file = Array.isArray(attributes.files) ? attributes.files[0] : null;
  if (String(attributes.language || "").toLowerCase() !== "en" || !file || !/^\d+$/.test(String(file.file_id || ""))) return null;
  return {
    fileId: String(file.file_id),
    title: String(feature.title || attributes.release || "English subtitle").slice(0, 180),
    release: String(attributes.release || "").slice(0, 180),
    year: Number(feature.year) || null,
    downloadCount: Number(attributes.download_count) || 0,
    moviehashMatch: attributes.moviehash_match === true,
    machineTranslated: attributes.machine_translated === true,
    hearingImpaired: attributes.hearing_impaired === true
  };
}

function srtToVtt(input) {
  let text = String(input || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (/^WEBVTT(?:\s|$)/i.test(text)) return text + "\n";
  text = text.replace(/(^|\n)\d+\s*\n(?=\d{2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->)/g, "$1");
  text = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{1,3})/g, (_, timestamp, fraction) => timestamp + "." + fraction.padEnd(3, "0"));
  return "WEBVTT\n\n" + text + "\n";
}

async function readJson(response) {
  try { return await response.json(); } catch (_) { return {}; }
}

let cachedAccountToken = "";
let accountTokenExpiresAt = 0;
let accountLoginInFlight = null;

async function getAccountToken(context) {
  const { env, request } = context;
  if (!env.OPENSUBTITLES_USERNAME || !env.OPENSUBTITLES_PASSWORD) return "";
  if (cachedAccountToken && Date.now() < accountTokenExpiresAt) return cachedAccountToken;
  if (accountLoginInFlight) return accountLoginInFlight;
  accountLoginInFlight = (async () => {
    try {
      const response = await fetch(API_BASE + "/login", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Api-Key": env.OPENSUBTITLES_API_KEY,
          "User-Agent": env.OPENSUBTITLES_USER_AGENT || APP_AGENT
        },
        body: JSON.stringify({ username: env.OPENSUBTITLES_USERNAME, password: env.OPENSUBTITLES_PASSWORD }),
        signal: request.signal
      });
      const data = await readJson(response);
      if (!response.ok || typeof data.token !== "string") return "";
      cachedAccountToken = data.token;
      accountTokenExpiresAt = Date.now() + 12 * 60 * 60 * 1000;
      return cachedAccountToken;
    } catch (_) {
      return "";
    } finally {
      accountLoginInFlight = null;
    }
  })();
  return accountLoginInFlight;
}

async function upstream(context, path, init = {}) {
  const { env, request } = context;
  if (!env.OPENSUBTITLES_API_KEY) {
    return { error: json({ error: "English subtitle search is not configured. Add OPENSUBTITLES_API_KEY as a Cloudflare Pages secret." }, 503) };
  }
  const headers = {
    "Accept": "application/json",
    "Api-Key": env.OPENSUBTITLES_API_KEY,
    "User-Agent": env.OPENSUBTITLES_USER_AGENT || APP_AGENT,
    ...(init.headers || {})
  };
  if (path !== "/login") {
    const token = await getAccountToken(context);
    if (token) headers.Authorization = "Bearer " + token;
  }
  const result = await fetch(API_BASE + path, { ...init, headers, signal: request.signal });
  return { response: result };
}

export async function onRequest(context) {
  const { request, params } = context;
  const parts = Array.isArray(params.path) ? params.path : [params.path || ""];
  const path = parts.join("/");

  if (!context.env.OPENSUBTITLES_API_KEY) {
    return json({ error: "English subtitle lookup is not configured. Add OPENSUBTITLES_API_KEY as a Cloudflare Pages secret." }, 503);
  }

  if (path === "search") {
    if (request.method !== "GET") return json({ error: "Only GET requests are supported for subtitle search." }, 405);
    const incoming = new URL(request.url);
    const title = (incoming.searchParams.get("query") || "").trim().slice(0, 100);
    const yearValue = incoming.searchParams.get("year") || "";
    const year = /^\d{4}$/.test(yearValue) ? Number(yearValue) : 0;
    const type = incoming.searchParams.get("type") === "episode" ? "episode" : "movie";
    if (!title) return json({ error: "A movie title is required." }, 400);

    const parameters = { languages: "en", query: year ? title + " " + year : title, type };
    if (year) parameters.year = String(year);
    const sorted = new URLSearchParams();
    Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, value]) => sorted.set(key, value));

    try {
      const result = await upstream(context, "/subtitles?" + sorted.toString());
      if (result.error) return result.error;
      const response = result.response;
      const data = await readJson(response);
      if (!response.ok) {
        const status = response.status === 429 ? 429 : response.status === 401 || response.status === 403 ? 502 : 502;
        return json({ error: "OpenSubtitles subtitle search failed.", detail: String(data.message || data.error || response.statusText).slice(0, 200) }, status);
      }
      const wantedTitle = canonicalTitle(title);
      const items = (Array.isArray(data.data) ? data.data : [])
        .map(subtitleMatch)
        .filter(Boolean)
        .map(item => {
          const itemTitle = canonicalTitle(item.title);
          const titleMatch = itemTitle === wantedTitle || itemTitle.includes(wantedTitle) || wantedTitle.includes(itemTitle);
          const yearMatch = !year || item.year === year;
          return { ...item, titleMatch, yearMatch, score: (item.moviehashMatch ? 1000000 : 0) + (titleMatch ? 10000 : 0) + (yearMatch ? 5000 : 0) + Math.min(item.downloadCount, 4000) };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(({ score, ...item }) => item);
      return json({ results: items }, 200, { "Cache-Control": "public, max-age=300, s-maxage=900" });
    } catch (_) {
      return json({ error: "OpenSubtitles could not be reached. Try again in a moment." }, 502);
    }
  }

  const fileMatch = path.match(/^file\/(\d{1,20})$/);
  if (fileMatch) {
    if (request.method !== "GET") return json({ error: "Only GET requests are supported for subtitle files." }, 405);
    const cache = typeof caches !== "undefined" ? caches.default : null;
    const cacheKey = new Request(new URL(request.url).origin + "/api/subtitles/file/" + fileMatch[1], { method: "GET" });
    if (cache) {
      try {
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
      } catch (_) {}
    }
    try {
      const downloadResponse = await upstream(context, "/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileMatch[1], sub_format: "srt" })
      });
      if (downloadResponse.error) return downloadResponse.error;
      const downloadData = await readJson(downloadResponse.response);
      if (!downloadResponse.response.ok || typeof downloadData.link !== "string") {
        return json({ error: "OpenSubtitles could not prepare this subtitle file." }, downloadResponse.response.status === 429 ? 429 : 502);
      }
      let target;
      try {
        target = new URL(downloadData.link);
        if (target.protocol !== "https:" || target.username || target.password) throw new Error("Invalid download URL");
      } catch (_) {
        return json({ error: "OpenSubtitles returned an invalid subtitle URL." }, 502);
      }
      const fileResponse = await fetch(target.toString(), { headers: { "User-Agent": APP_AGENT }, signal: request.signal });
      if (!fileResponse.ok) return json({ error: "The subtitle file could not be downloaded." }, 502);
      const buffer = await fileResponse.arrayBuffer();
      if (!buffer.byteLength || buffer.byteLength > 10 * 1024 * 1024) return json({ error: "The subtitle file is empty or too large." }, 502);
      const raw = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
      const vtt = srtToVtt(raw);
      const response = new Response(vtt, {
        headers: {
          "Content-Type": "text/vtt; charset=utf-8",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": 'inline; filename="english-subtitles.vtt"'
        }
      });
      if (cache) {
        try { context.waitUntil(cache.put(cacheKey, response.clone())); } catch (_) {}
      }
      return response;
    } catch (_) {
      return json({ error: "The subtitle service could not be reached. Try again in a moment." }, 502);
    }
  }

  return json({ error: "Unknown subtitle endpoint." }, 404);
}
