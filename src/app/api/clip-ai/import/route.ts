import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null;
const errorMessage = (value: unknown, fallback: string) => {
  const data = isRecord(value) ? value : {};
  return typeof data.detail === "string" ? data.detail : typeof data.message === "string" ? data.message : fallback;
};
function config() {
  const base = process.env.CLIP_WORKER_URL?.trim().replace(/\/+$/, "");
  const token = process.env.CLIP_WORKER_TOKEN?.trim();
  return base && token ? { base, token } : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Paste a valid video URL." }, { status: 400 }); }
  const raw = isRecord(body) && typeof body.url === "string" ? body.url.trim() : "";
  if (!raw || raw.length > 2048) return NextResponse.json({ error: "Paste a valid video URL (maximum 2,048 characters)." }, { status: 400 });
  let url: URL;
  try { url = new URL(raw); } catch { return NextResponse.json({ error: "That URL is not valid. Include https://." }, { status: 400 }); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return NextResponse.json({ error: "Use a public http:// or https:// video link without embedded credentials." }, { status: 400 });
  const worker = config();
  if (!worker) return NextResponse.json({ error: "The free Clip AI engine is implemented, but its worker is not connected yet. Deploy the open-source service in clip-worker, then set CLIP_WORKER_URL and CLIP_WORKER_TOKEN as server-side environment variables.", setupRequired: true }, { status: 503 });
  try {
    const response = await fetch(worker.base + "/jobs", { method: "POST", headers: { Authorization: "Bearer " + worker.token, "Content-Type": "application/json" }, body: JSON.stringify({ url: url.toString() }), cache: "no-store", signal: AbortSignal.timeout(15000) });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: errorMessage(payload, "The free worker rejected this video link.") }, { status: response.status });
    const data = isRecord(payload) ? payload : {};
    return NextResponse.json({ projectId: String(data.jobId || ""), provider: "Open-source worker", message: typeof data.message === "string" ? data.message : "Video queued for local transcription and rendering." }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.name === "TimeoutError" ? "The worker took too long to accept the job. Check that it is online, then retry." : "Could not reach the free Clip AI worker. Check CLIP_WORKER_URL and worker logs." }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("projectId")?.trim();
  if (!id || !/^[a-f0-9]{32}$/.test(id)) return NextResponse.json({ error: "A valid job ID is required." }, { status: 400 });
  const worker = config();
  if (!worker) return NextResponse.json({ error: "The free Clip AI worker is not connected. Configure CLIP_WORKER_URL and CLIP_WORKER_TOKEN." }, { status: 503 });
  try {
    const response = await fetch(worker.base + "/jobs/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + worker.token }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: errorMessage(payload, "Could not retrieve this job.") }, { status: response.status });
    const data = isRecord(payload) ? payload : {};
    const clips = Array.isArray(data.clips) ? data.clips.filter(isRecord).map((clip) => ({
      id: String(clip.id || ""), title: String(clip.title || "Generated clip"), hook: String(clip.hook || ""),
      start: Number(clip.start || 0), end: Number(clip.end || 0),
      potentialScore: Number.isFinite(Number(clip.potentialScore)) ? Number(clip.potentialScore) : undefined,
      reachOutlook: typeof clip.reachOutlook === "string" ? clip.reachOutlook : undefined,
      effects: Array.isArray(clip.effects) ? clip.effects.filter((effect): effect is string => typeof effect === "string") : [],
      url: typeof clip.url === "string" && clip.url.startsWith("/") ? worker.base + clip.url : String(clip.url || ""),
    })).filter((clip: { url: string }) => /^https?:\/\//i.test(clip.url)) : [];
    return NextResponse.json({ status: data.status, clips, message: typeof data.message === "string" ? data.message : "Worker status updated.", error: data.status === "failed" ? data.message : undefined });
  } catch {
    return NextResponse.json({ error: "Could not reach the free Clip AI worker to check job status." }, { status: 502 });
  }
}
