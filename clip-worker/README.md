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

## YouTube links: local-first, no-credit path

The worker now tries local `yt-dlp` first for YouTube and uses word-level timestamps plus sentence-aware selection for captions/clips. On datacenter IPs, YouTube may still refuse requests. The optional open-source BgUtils PO-token provider can help, but does not guarantee access.

On the AWS worker (Ubuntu), install the matching provider script and plugin:

```bash
cd /home/ubuntu
git clone --single-branch --branch 2.0.2 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git
cd /home/ubuntu/bgutil-ytdlp-pot-provider/server
deno install --allow-scripts=npm:canvas --frozen
/home/ubuntu/Wesbite/clip-worker/.venv/bin/python -m pip install bgutil-ytdlp-pot-provider==2.0.2
```

Keep the provider checkout at `/home/ubuntu/bgutil-ytdlp-pot-provider/server`; the plugin's script mode discovers this default path. Do not expose the provider service publicly if you later switch to its HTTP-server mode.

## Optional resolver fallback

Set these server-side variables:
- `CLIP_WORKER_URL`: worker base URL, no trailing slash.
- `CLIP_WORKER_TOKEN`: same long random secret configured on the worker.
- `CLIP_WORKER_PUBLIC_URL`: a URL reachable by browsers; output MP4 links point to its `/media/` endpoint.
- `TUNELIO_API_KEY`: optional private source-resolver key.
- `TUNELIO_FALLBACK_ENABLED=true`: opt in to Tunelio only after the local YouTube downloader fails. It may consume account credits; by default this fallback is off.

Never put the token in a `NEXT_PUBLIC_*` variable. Provider behavior and quotas can change, so check its dashboard before enabling fallback.

Set `CLIP_WORKER_PUBLIC_URL` on the worker to a URL reachable by browsers; output MP4 links point to its `/media/` endpoint. Never put the token in a `NEXT_PUBLIC_*` variable.

## Cost, safety, and limits

The local downloader, BgUtils plugin, faster-whisper, and FFmpeg can run without a paid model API. YouTube may still block downloads from cloud IP addresses even with a PO-token provider. Tunelio is an optional fallback, not a guaranteed permanently free service. Your AWS worker performs transcription and editing. Use only videos you own or are authorized to process; verify third-party provider terms and quota before public rollout.

The code/model are free to run; compute, bandwidth, and persistent hosting may still cost money. Free hosts often sleep or restrict CPU, so local Docker is the dependable zero-cost test. Public supported links only; private/login-only sources fail rather than bypassing access controls. Only process videos you are authorized to use. Default limit is 30 minutes and 750 MB. One worker process handles jobs serially; job status is not durable across restarts.

API: `GET /health`, `POST /jobs` with bearer token and `{"url":"https://..." }`, then `GET /jobs/{jobId}` with the same token.
