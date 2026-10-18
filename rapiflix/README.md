# Rapiflix

Rapiflix is a standalone movie-discovery and playback project in `/rapiflix` on branch `rapiflix/site`. It is separate from the existing Rapigents site branch.

## What works in this build

- **In-page playback:** the player looks up the Internet Archive item's live metadata instead of trusting hard-coded file names. It tries compatible MP4/M4V/WebM/OGV files, retries alternate files if playback fails, and remembers local watch progress.
- **Separate catalogues:** current/commercial TMDB titles are shown in a discovery section with regional external watch options; the free-film section contains only source items that pass the app's compatible-file and rights-statement screening. TMDB discovery cards are not represented as playable streams.
- **Unified playback controls:** rights-cleared items use one in-page player with source/file selection, quality selection when resolution metadata is available, WebVTT subtitle selection when tracks are present, and audio-track selection when the browser or authorized source exposes tracks. Failed sources fall through to the next available candidate.
- **Archive search:** when running locally without a TMDB key, search looks up Archive titles directly. Dynamically discovered Archive uploads are played in Rapiflix only if the item metadata declares public-domain or Creative Commons status.
- **New-release discovery:** trending, now-playing, upcoming and popular movie metadata can load from TMDB. A release-period filter supports latest (last two release years), 2020s, 2010s, 2000s, and pre-2000 titles. TMDB is a catalogue, not a source of video streams.
- **Regional watch options:** TMDB reports streaming, rental and purchase availability by country using JustWatch data. Rapiflix opens these official options for commercial releases instead of pretending they can be streamed in the built-in player. Original-language metadata is displayed when available.
- **Subtitle discovery:** film details include a search link to OpenSubtitles. This opens their listing/search site; it does not guarantee subtitles exist, download them automatically, or add dubbed audio to the player. In-player subtitle and audio choices still depend on tracks supplied by the authorized video source.
- **No Rapiflix-inserted ad breaks:** the built-in player plays the source file directly. Rapiflix does not insert ads or require an account for the local library. That does not make every third-party upload lawful, nor can it control ads or restrictions on external commercial services.
- **Saved titles and playback resume:** the saved list and progress are stored in the visitor's browser.

## Run locally

The archive-based library and player do not need a TMDB key.

```bash
cd rapiflix
python -m http.server 8000
```

Open `http://localhost:8000`. To load TMDB data while using the simple local HTTP server, click **Connect TMDB** and enter a temporary v3 API key in your own browser. The key is used only by localhost development mode and is not committed to GitHub. If the key was shared in chat, screenshots, or source control, revoke it and make a new one first.

The simple Python server cannot run Cloudflare Pages Functions. For production-like local proxy testing, install Wrangler and run Pages locally with the new key as a binding, for example:

```bash
npx wrangler pages dev . --binding=TMDB_API_KEY=YOUR_NEW_V3_API_KEY
```

Do not paste a real key into a source file or commit it to the repository.

## Deploy on Cloudflare Pages

Use a Git-integrated Cloudflare Pages project configured as follows:

1. Select branch `rapiflix/site`.
2. Set **Root directory** to `rapiflix`.
3. Use no build command and serve the current directory as the static output.
4. In **Settings → Variables and Secrets**, add a **Secret** named `TMDB_API_KEY` with a new, unexposed TMDB v3 key.
5. Trigger a new deployment.

The Pages Function at `functions/api/tmdb/[[path]].js` proxies only the approved, read-only catalogue and watch-provider endpoints. It keeps the API key on the server and limits which API paths can be requested. `_routes.json` restricts Function handling to `/api/tmdb/*`. If the secret is missing, the site's Archive search/player still work, but TMDB catalogue and watch-provider calls show an error.

## Content rights and reliability

Internet Archive explicitly warns that it does **not** guarantee that an uploaded item's claimed copyright status or license is accurate. The app checks all curated and dynamically discovered Archive titles for a compatible video file plus an explicit, non-conflicting public-domain or Creative Commons signal in the item metadata. Curated titles that fail are hidden from the playable catalogue; discovered titles that fail are not added, and playback checks rights again before starting. This is a conservative technical screen, not a legal determination; metadata can be incomplete or incorrect and license conditions can vary by country.

The current 17-item starter list is only the initial candidate set, not a certified rights catalogue. Check each title's rights in your target countries before operating Rapiflix publicly. Uploader statements can be wrong, and a metadata label does not transfer copyright or guarantee the uploaded copy is authorized. Keep a rights/takedown contact and process before inviting public submissions or operating the site at scale.

Rapiflix does not bypass DRM, authentication, paywalls, or access controls, and it does not scrape unofficial links to copyrighted commercial releases. New-release cards provide discovery data and official watch options, not the movie file. There is no legitimate universal API that grants a new commercial release for free, ad-free streaming without the rightsholder's permission. For that catalogue you need a licensing agreement or a service that authorizes embedding.

## Research references

- [FreeReel / free-stream](https://github.com/noknows08/free-stream): an open-source reference for a static interface and Internet Archive playback of public-domain/Creative Commons classics.
- [Movie-App public-domain streaming example](https://github.com/AlaaAl-Gohary/Movie-App): separates titles confirmed for public-domain playback from titles without a confirmed stream.
- [Internet Archive rights guidance](https://archivesupport.zendesk.com/hc/en-us/articles/360014759692-Rights): Archive uploads are not guaranteed to be correctly labeled from a rights perspective.
- [Internet Archive metadata API](https://archive.org/developers/metadata.html): metadata and files used to resolve candidate video files.
- [TMDB movie watch-provider endpoint](https://developer.themoviedb.org/reference/movie-watch-providers): provides regional service availability, not video files; JustWatch attribution is required.
- [TMDB authentication](https://developer.themoviedb.org/docs/authentication-application): v3 API key and application-level auth details.
- [TMDB attribution and commercial-use FAQ](https://developer.themoviedb.org/docs/faq): requires the approved logo and attribution notice, and says commercial use requires a separate license.

## TMDB attribution

The About section includes the approved TMDB logo and required notice: “This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.” Provider availability is attributed to JustWatch via TMDB.

TMDB's developer API is for non-commercial use under its standard terms. If the project's primary purpose becomes revenue generation, obtain the appropriate commercial permission from TMDB before operating it that way.
