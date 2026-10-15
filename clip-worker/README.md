# Rapigents free Clip AI worker

Open-source, self-hostable link processor replacing the paid OpusClip API. It uses **yt-dlp** for supported public sources, **faster-whisper** for local speech transcription, and **FFmpeg** to render vertical MP4 clips with burned-in subtitles. A local transcript-ranking heuristic scores hooks, questions, contrast, numbers, speech density, and sentence endings. No AI API key is needed.

## Run locally with Docker

```bash
cd clip-worker
docker build -t rapigents-clip-worker .
docker run --rm -p 8000:8000 \
  -e CLIP_WORKER_TOKEN='replace-with-a-long-random-secret' \
  -e CLIP_WORKER_PUBLIC_URL='http://localhost:8000' \
  -v rapigents-clip-data:/data rapigents-clip-worker
```

First use downloads the Whisper model. CPU inference can be slow on small/free machines. Persistent storage is recommended. Job records are in memory, so restarting the worker clears active job state.

## Connect the website

Set these server-side deployment variables and redeploy:
- `CLIP_WORKER_URL`: worker base URL, no trailing slash.
- `CLIP_WORKER_TOKEN`: same long random secret configured on the worker.

Set `CLIP_WORKER_PUBLIC_URL` on the worker to a URL reachable by browsers; output MP4 links point to its `/media/` endpoint. Never put the token in a `NEXT_PUBLIC_*` variable.

## Cost, safety, and limits

The code/model are free to run; compute, bandwidth, and persistent hosting may still cost money. Free hosts often sleep or restrict CPU, so local Docker is the dependable zero-cost test. Public supported links only; private/login-only sources fail rather than bypassing access controls. Only process videos you are authorized to use. Default limit is 30 minutes and 750 MB. One worker process handles jobs serially; job status is not durable across restarts.

API: `GET /health`, `POST /jobs` with bearer token and `{"url":"https://..." }`, then `GET /jobs/{jobId}` with the same token.
