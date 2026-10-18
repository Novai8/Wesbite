# Rapiflix

A standalone, responsive movie-discovery and public-collection streaming prototype. This site lives in `/rapiflix` on the `rapiflix/site` branch and does not modify the existing `arena/...` branch or the main site files.

## Run locally

No build step or API key is required for the curated starter catalogue.

```bash
cd rapiflix
python -m http.server 8000
```

Open `http://localhost:8000`. Search, genre filters, sort, saved films, details modal, and the video player work in a modern browser. The “Explore more classics” action queries the Internet Archive advanced-search API and discovers additional entries in its `feature_films` collection. For discovered titles, the player looks up the original item metadata and selects an MP4 file where one is available.

## Deploy

Deploy the **`rapiflix/` directory** as the root of a static site. This is intentionally isolated from the existing Next.js Rapigents site; deploying the repository root will not automatically deploy this subdirectory. A separate Cloudflare Pages project can use `rapiflix` as its build output/root directory, or the folder can be deployed to any static host.

## Upstream projects studied

- [FreeReel / free-stream](https://github.com/noknows08/free-stream): reference for a static catalogue, film details, search, and direct Internet Archive playback. Rapiflix has its own interface and implementation; the curated starter catalogue uses the same public item identifiers and filenames documented by its upstream catalogue. Check that repository's current license and individual film rights before reuse.
- [MovieTube](https://github.com/chriskwann/movietube): reference for the Internet Archive `feature_films` discovery workflow, metadata enrichment, and the distinction between free-library films and links to newer titles on legitimate streaming services. Rapiflix implements a lightweight browser-side discovery path rather than copying MovieTube's FastAPI/SQLite backend or harvester.

## Content, licensing and reliability

- Movie metadata, posters and playback files are fetched from the Internet Archive. The Archive does not guarantee that every uploader has cleared all rights. Public availability is not proof that a title is public domain or available for commercial redistribution in every country.
- The “FREE” badge means the prototype expects the item to be accessible without a site subscription; it is **not a legal rights certification**. Verify the rights, license, territorial restrictions and embedding/download terms for each film before operating a public service.
- Rapiflix does not bypass DRM, authentication, paywalls, or access controls and does not aggregate unofficial commercial streaming links.
- The optional discovery API is public and may rate-limit, change, or return metadata with missing/broken playback files. The interface falls back to the original archive item page when playback fails.
- The current app uses a browser-local saved list. No user accounts, analytics, advertising, or backend database are configured.
- Poster artwork is served by the Internet Archive. Fonts are loaded from Google Fonts.

## Current limitations

This is a front-end prototype, not a commercial streaming rights package. It does not provide every new release, guarantee uptime, or validate each item's legal status automatically. A commercial launch needs a documented rights review, a contact/takedown process, privacy and terms pages, and a backend or service strategy appropriate to the chosen catalogue.


## TMDB live discovery

The Discover page can load trending, now-playing, upcoming and popular movie metadata from TMDB. Click **Connect TMDB** and paste a TMDB v3 API key. The temporary test flow stores it in the current browser's local storage and does not put it in this repository. Clear it by clicking **Connect TMDB** and submitting an empty value. Revoke any key that has been exposed publicly.

TMDB data includes titles, release dates, synopses, posters and genres. It does not provide movie files or grant streaming rights. TMDB cards link to the official watch-options page; the built-in player remains reserved for titles that have an actual source URL, such as Internet Archive discoveries. TMDB requires attribution and its free developer API is not intended for a revenue-generating commercial product without the appropriate permission. See the [official authentication guide](https://developer.themoviedb.org/docs/authentication-application) and [TMDB FAQ](https://developer.themoviedb.org/docs/faq).


## Hybrid streaming features

- TMDB discovery is metadata-only. TMDB title cards are labelled **DISCOVER**, not free streams.
- The details panel requests regional movie availability from TMDB's watch-provider endpoint using the selected country (Pakistan by default). Listings are supplied through TMDB/JustWatch and require JustWatch attribution; provider listings are not a playback feed. The official availability link is shown when returned.
- For Internet Archive entries, the details panel checks the item metadata for compatible video files and any declared rights/licence fields. This is a screening aid, **not a legal determination**; review the original item and license before public distribution or monetization.
- The existing Rapiflix player remains in place and attempts a direct HTML video source where one is available, with a fallback link to the original host.
- For local testing, connect the temporary TMDB key in the browser. This remains a prototype: the key is visible to the browser and can be inspected by a visitor. Before public deployment, replace browser-key storage with a server-side proxy and a secret environment variable.

The regional provider feature uses TMDB's [movie watch-provider API](https://developer.themoviedb.org/reference/movie-watch-providers); provider availability is regional and can change. Attribution to JustWatch is required for this dataset.
