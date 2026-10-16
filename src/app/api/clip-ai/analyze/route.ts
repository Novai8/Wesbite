import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_VIDEO_DATA = 14 * 1024 * 1024;
const RATE_WINDOW = 60_000;
const RATE_MAX = 3;
const requests = new Map<string, { count: number; resetAt: number }>();

function allowed(request: Request) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  let entry = requests.get(ip);
  if (!entry || entry.resetAt < now) { entry = { count: 0, resetAt: now + RATE_WINDOW }; requests.set(ip, entry); }
  if (entry.count >= RATE_MAX) return false;
  entry.count += 1;
  return true;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Clip analysis is temporarily unavailable. Please try again later." }, { status: 503 });
  if (!allowed(request)) return NextResponse.json({ error: "Too many analysis requests. Wait a minute before trying again." }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Upload a valid video file and try again." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "This video could not be processed." }, { status: 400 });
  const data = body as { video?: unknown; mimeType?: unknown; duration?: unknown };
  if (typeof data.video !== "string" || !data.video.startsWith("data:video/") || data.video.length > MAX_VIDEO_DATA) {
    return NextResponse.json({ error: "Choose a supported video under 10 MB." }, { status: 413 });
  }
  const duration = Number(data.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600) return NextResponse.json({ error: "This version supports uploaded videos up to 10 minutes long." }, { status: 400 });

  const prompt = [
    "Analyze the supplied video and propose 2 to 5 distinct, compelling short-form clips suitable for vertical social video. Adapt clip length to the source duration instead of forcing every clip to the same length.",
    "Return ONLY valid JSON, no markdown, with this exact shape:",
    '{"clips":[{"start":0,"end":25,"title":"Short editorial title","hook":"Why this moment works in one sentence","captions":[{"start":0,"end":3,"text":"spoken words or a concise faithful caption"}]}]}',
    "Length policy: for source videos up to 60 seconds, target 8–20 second clips; for 61–180 seconds, target 12–40 second clips; for 181–360 seconds, target 15–50 second clips; for 361–600 seconds, target 20–60 second clips. These are targets, not rigid rules: preserve a complete thought and payoff, and never extend beyond the source. Rules: all timestamps are seconds on the ORIGINAL video timeline; clips must remain within the supplied duration and not overlap; captions must have plausible timings within each clip; use concise phrases, ideally 2–7 words per caption; do not invent speech or claim exact transcription when audio is unclear; prioritize a clear hook, complete thought, and payoff; if the video is too short, propose the best possible non-overlapping segments. Return 2 to 5 clips depending on how many distinct strong moments the source contains.",
    "Source duration in seconds: " + Math.floor(duration),
  ].join("\n");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json", "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://rapigents.com", "X-Title": "Rapigents Clip AI" },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "video_url", video_url: { url: data.video } }] }],
        temperature: 0.2,
        max_tokens: 1800,
      }),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const providerMessage = typeof payload?.error?.message === "string" ? payload.error.message : "";
      const modelUnsupported = /video|modality|support|format/i.test(providerMessage);
      return NextResponse.json({ error: modelUnsupported ? "The free model selected for this request could not analyze this video format. Try a smaller MP4 or retry shortly." : response.status === 429 ? "Free AI models are busy right now. Wait a little and try again." : "Clip AI could not analyze this video. Try a smaller MP4 or retry shortly." }, { status: response.status === 429 ? 429 : 502 });
    }
    const content = payload?.choices?.[0]?.message?.content;
    const raw = typeof content === "string" ? content : Array.isArray(content) ? content.map((part: { text?: string }) => part.text || "").join("\n") : "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return NextResponse.json({ error: "The AI response was not structured correctly. Try again." }, { status: 502 });
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const clips = Array.isArray(parsed.clips) ? parsed.clips.map((clip: Record<string, unknown>) => ({
      start: Math.max(0, Number(clip.start)),
      end: Math.min(duration, Number(clip.end)),
      title: String(clip.title || "Suggested highlight").slice(0, 100),
      hook: String(clip.hook || "A potentially useful moment from your video.").slice(0, 240),
      captions: Array.isArray(clip.captions) ? clip.captions.map((caption: Record<string, unknown>) => ({
        start: Math.max(0, Number(caption.start)),
        end: Math.min(duration, Number(caption.end)),
        text: String(caption.text || "").slice(0, 160),
      })).filter((caption: { start: number; end: number; text: string }) => Number.isFinite(caption.start) && Number.isFinite(caption.end) && caption.end > caption.start && caption.text) : [],
    })).filter((clip: ClipCandidate) => Number.isFinite(clip.start) && Number.isFinite(clip.end) && clip.end > clip.start && clip.end - clip.start >= 5 && clip.start < duration) : [];
    if (!clips.length) return NextResponse.json({ error: "No usable clips were identified. Try a different video." }, { status: 422 });
    return NextResponse.json({ clips });
  } catch {
    return NextResponse.json({ error: "Clip AI could not reach a compatible free video model. Retry, or try a shorter MP4." }, { status: 502 });
  }
}

type ClipCandidate = { start: number; end: number };
