import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://api.opus.pro/api";
const supportedHosts = [
  "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com",
  "vimeo.com", "www.vimeo.com", "player.vimeo.com", "drive.google.com", "docs.google.com",
  "dropbox.com", "www.dropbox.com", "dl.dropboxusercontent.com", "loom.com", "www.loom.com",
  "twitch.tv", "www.twitch.tv", "clips.twitch.tv", "facebook.com", "www.facebook.com",
  "fb.watch", "linkedin.com", "www.linkedin.com", "x.com", "www.x.com", "twitter.com",
  "www.twitter.com", "rumble.com", "www.rumble.com", "riverside.fm", "www.riverside.fm",
  "streamyard.com", "www.streamyard.com", "frame.io", "www.frame.io",
];

function getKey() { return process.env.OPUSCLIP_API_KEY; }
function hostAllowed(url: URL) {
  const host = url.hostname.toLowerCase();
  const directVideoPath = /\.(mp4|m4v|mov|webm|m3u8)$/i.test(url.pathname);
  return supportedHosts.includes(host) || directVideoPath;
}
function extractProjectId(payload: any): string {
  const candidates = [payload?.projectId, payload?.data?.projectId, payload?.data?.id, payload?.id, payload?.data?.clipProjectId];
  const found = candidates.find(value => typeof value === "string" || typeof value === "number");
  return found === undefined ? "" : String(found);
}
async function providerFetch(path: string, init?: RequestInit) {
  const key = getKey();
  if (!key) throw new Error("Link clipping is not configured yet. Add OPUSCLIP_API_KEY to your Cloudflare Pages/Workers environment variables.");
  return fetch(API_BASE + path, {
    ...init,
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
}

export async function POST(request: Request) {
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Paste a valid video URL." }, { status: 400 }); }
  const raw = typeof body?.url === "string" ? body.url.trim() : "";
  if (!raw || raw.length > 2048) return NextResponse.json({ error: "Paste a valid video URL (maximum 2,048 characters)." }, { status: 400 });
  let url: URL;
  try { url = new URL(raw); } catch { return NextResponse.json({ error: "That URL is not valid. Include https://." }, { status: 400 }); }
  if (url.protocol !== "https:" && url.protocol !== "http:") return NextResponse.json({ error: "Only http and https video links are supported." }, { status: 400 });
  if (url.username || url.password || !hostAllowed(url)) return NextResponse.json({ error: "This provider is not currently supported. Try YouTube, Vimeo, Drive, Dropbox, Loom, Twitch, or a direct video-file URL." }, { status: 400 });
  if (!getKey()) return NextResponse.json({ error: "Link clipping is almost ready, but the provider key is not configured. Add OPUSCLIP_API_KEY to your Cloudflare environment variables, then redeploy." }, { status: 503 });

  try {
    const response = await providerFetch("/clip-projects", {
      method: "POST",
      body: JSON.stringify({
        videoUrl: url.toString(),
        curationPref: { model: "ClipAnything", clipDurations: [[8, 20], [20, 40], [40, 60]], customPrompt: "Find the most engaging, self-contained moments with a strong hook and payoff. Prefer clear context, useful insights, emotional moments, or memorable statements." },
        renderPref: { layoutAspectRatio: "portrait" },
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof payload?.message === "string" ? payload.message : typeof payload?.error?.message === "string" ? payload.error.message : "";
      return NextResponse.json({ error: response.status === 401 || response.status === 403 ? "The clipping provider rejected its API key or account permissions. Check OPUSCLIP_API_KEY and API access." : response.status === 429 ? "The clipping provider has reached a rate or credit limit. Check the provider account." : message || "The provider could not import this link. Check that it is public or supported, then try again." }, { status: response.status === 429 ? 429 : 502 });
    }
    const projectId = extractProjectId(payload);
    if (!projectId) return NextResponse.json({ error: "The provider accepted the request but returned no project ID. Check your provider API account or contact provider support." }, { status: 502 });
    return NextResponse.json({ projectId, provider: "OpusClip", message: "Video accepted. AI is finding highlights and rendering clips. This can take a few minutes." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.name === "TimeoutError" ? "The provider took too long to respond. Your project may still be processing; retry in a moment." : "Could not reach the clipping provider. Try again shortly." }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim();
  if (!projectId || projectId.length > 200 || !/^[a-zA-Z0-9._:-]+$/.test(projectId)) return NextResponse.json({ error: "A valid project ID is required." }, { status: 400 });
  if (!getKey()) return NextResponse.json({ error: "Link clipping is not configured. Add OPUSCLIP_API_KEY to your server environment." }, { status: 503 });
  try {
    const response = await providerFetch("/exportable-clips?q=findByProjectId&projectId=" + encodeURIComponent(projectId), { method: "GET" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ error: response.status === 429 ? "The provider is rate-limiting status checks. Wait a little." : "Could not retrieve clips from the provider yet." }, { status: response.status === 429 ? 429 : 502 });
    const possible = [payload?.data?.list, payload?.data?.clips, payload?.clips, payload?.data, payload?.list];
    const list = possible.find(Array.isArray) || [];
    const clips = list.map((item: any, index: number) => ({
      id: String(item?.clipId || item?.id || item?.contentId || index),
      title: String(item?.title || item?.name || item?.caption || "Generated clip " + (index + 1)),
      url: String(item?.uriForExport || item?.exportUri || item?.downloadUrl || item?.url || item?.videoUrl || ""),
      thumbnail: typeof item?.thumbnailUrl === "string" ? item.thumbnailUrl : typeof item?.thumbnail === "string" ? item.thumbnail : undefined,
    })).filter((item: { url: string }) => /^https?:\/\//i.test(item.url));
    return NextResponse.json({ clips, message: clips.length ? "Clips are ready." : "The project is still processing, or the provider has not published exportable clips yet." });
  } catch {
    return NextResponse.json({ error: "Could not reach the clipping provider to check results." }, { status: 502 });
  }
}
