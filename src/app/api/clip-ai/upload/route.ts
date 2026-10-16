import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "webm", "m4v", "mkv"]);

function workerConfig() {
  const base = process.env.CLIP_WORKER_URL?.trim().replace(/\/+$/, "");
  const token = process.env.CLIP_WORKER_TOKEN?.trim();
  return base && token ? { base, token } : null;
}

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null;

export async function POST(request: Request) {
  const worker = workerConfig();
  if (!worker) {
    return NextResponse.json(
      { error: "The Clip AI worker is not connected. Configure CLIP_WORKER_URL and CLIP_WORKER_TOKEN." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose a video file to upload." }, { status: 400 });
  }

  const entry = form.get("file");
  if (!entry || typeof entry === "string" || typeof entry.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Choose a video file to upload." }, { status: 400 });
  }
  const file = entry as File;
  if (!file.size) return NextResponse.json({ error: "The selected video is empty." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Uploads are currently limited to 10 MiB. Choose a shorter or smaller video." }, { status: 413 });
  }

  const safeName = file.name.replace(/[\/\\\r\n"]/g, "_").slice(0, 160) || "upload.mp4";
  const extension = safeName.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: "Use an MP4, MOV, WebM, M4V, or MKV video." }, { status: 415 });
  }
  if (file.type && !file.type.startsWith("video/") && file.type !== "application/octet-stream") {
    return NextResponse.json({ error: "The selected file does not appear to be a video." }, { status: 415 });
  }

  try {
    const response = await fetch(worker.base + "/jobs/upload", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + worker.token,
        "Content-Type": file.type || "application/octet-stream",
        "X-Upload-Filename": encodeURIComponent(safeName),
      },
      body: new Uint8Array(await file.arrayBuffer()),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    const payload: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const data = isRecord(payload) ? payload : {};
      const message = typeof data.detail === "string" ? data.detail : typeof data.message === "string" ? data.message : "The worker rejected this upload.";
      return NextResponse.json({ error: message }, { status: response.status });
    }
    const data = isRecord(payload) ? payload : {};
    const projectId = typeof data.jobId === "string" ? data.jobId : "";
    if (!projectId) return NextResponse.json({ error: "The worker accepted the request but returned no job ID." }, { status: 502 });
    return NextResponse.json({
      projectId,
      status: typeof data.status === "string" ? data.status : "queued",
      message: typeof data.message === "string" ? data.message : "Upload received. Your video is queued for clipping.",
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Uploading took too long. Try a smaller video or a more stable connection."
      : "Could not reach the Clip AI worker. Check the worker health endpoint and try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
