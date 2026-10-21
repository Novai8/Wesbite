# Rapigents

Portfolio site for **Hussnain Tariq** / **Rapigents**. Twelve niche-specific n8n workflow demos, with human review, audit notes, and fictional data. Purple and white, minimal, with page transitions and optional click sound.

This is an independent portfolio prototype. Time-saved figures are illustrative assumptions. Actual results vary.

## Install and run

```bash
npm install
npm run dev
```

Production check:

```bash
npm run lint
npm run build
npm run start
```

The dev server runs at [http://localhost:3000](http://localhost:3000).

Optional site URL, used for metadata, sitemap, and Open Graph:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

## Pages

- `/` home
- `/demos` searchable library
- `/demos/[slug]` workflow detail
- `/about`
- `/contact` — opens the visitor’s email app. Nothing is stored, and no mail API key is required.

Contact: [hussnain@rapigents.com](mailto:hussnain@rapigents.com)  
GitHub: [https://github.com/Novai8](https://github.com/Novai8)

## Add a video or thumbnail later

Demo content lives in one file: `src/data/demos.ts`.

Each demo has `videoUrl`, `thumbnailUrl`, and `youtubeUrl`. The twelve demos already point at their YouTube walkthroughs. `videoUrl` is an embed URL (`https://www.youtube.com/embed/VIDEO_ID`). Detail pages and the preview modal render that as a responsive iframe. Cards show a Watch demo poster and open the video. Leave `videoUrl` empty to keep the blank frame. A local file still works:

1. Put the file in `public/videos/` (for example `public/videos/lead-qualification.mp4`).
2. Optionally add a poster image in `public/videos/` or `public/thumbs/`.
3. Set the fields on that demo:

```ts
videoUrl: "/videos/lead-qualification.mp4",
thumbnailUrl: "/thumbs/lead-qualification.jpg",
```

Direct `https://` video files also work. YouTube links (`youtube.com/watch?v=` or `youtu.be/`) render as an embed. Do not autoplay. The detail page embeds `videoUrl`. Cards use the poster and open that same video.

## Sound

- **Sound: Off** by default. The navbar toggle turns on a quiet Web Audio click. The choice is stored in `localStorage` (`rapigents-sound`).
- The pointer is a CSS cursor, not an overlay, so links and buttons stay clickable.

## AI assistant: free provider fallback

The server-side route `src/app/api/assistant/route.ts` tries OpenRouter's `openrouter/free` router first, then Groq and Gemini if their API keys are configured. A configured paid OpenRouter model is attempted only as a last resort when `OPENROUTER_ALLOW_PAID=true`. Keys are read from server environment variables and must never be placed in client-side code.

Configure these in Cloudflare Pages **Settings → Variables and Secrets**:

- `OPENROUTER_API_KEY` — OpenRouter key. The free-model router is attempted first and selects an eligible free model.
- `OPENROUTER_CHAT_MODEL` — defaults to `openrouter/free`. You can set this to a specific model slug, but it is not used unless paid-model access is enabled.
- `OPENROUTER_ALLOW_PAID` — keep `false` for a zero-budget setup. Set to `true` only if you intentionally want the configured model attempted after free fallbacks.
- `GROQ_API_KEY` — optional independent fallback. Default model: `openai/gpt-oss-120b`.
- `GEMINI_API_KEY` — optional independent fallback. Default model: `gemini-3.8-flash`.
- `NEXT_PUBLIC_SITE_URL` — optional site URL sent as OpenRouter request metadata.

Get keys from the official provider consoles: [OpenRouter](https://openrouter.ai/settings/keys), [Groq](https://console.groq.com/keys), and [Google AI Studio](https://aistudio.google.com/apikey). The provider must enable the requested model for your account. Free tiers have usage caps, models can change, and the fallback chain cannot guarantee unlimited or uninterrupted access.

The open-source [free-llm-proxy-router](https://github.com/kaiser-data/free-llm-proxy-router) and [free-llm-api](https://github.com/nabinkhadka/free-llm-api) projects are useful references for provider rotation and failover. They do not grant free access to paid proprietary models; their provider integrations still require valid credentials.

Review each provider's data-use policy before sending visitor prompts. Free-tier policies may differ from paid services. Do not submit passwords, private keys, confidential business material, or other sensitive data to the public assistant.

## Deploy to Cloudflare Pages

The `arena/01a0d281-wesbite` branch uses the OpenNext Cloudflare adapter. In Cloudflare Pages, keep the production branch set to `arena/01a0d281-wesbite` and use this build command:

```bash
npm install --no-save --package-lock=false --legacy-peer-deps next@16.3.8 eslint-config-next@16.3.8 @opennextjs/cloudflare@1.20.11 wrangler && npx opennextjs-cloudflare build
```

Keep this adapter version aligned with the repository's `preview` and `deploy` scripts. A commit pushed to the configured production branch should trigger a new Pages deployment automatically.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com), import `Novai8/Wesbite`.
3. Framework preset: **Next.js**. Install command `npm install`. Build command `npm run build`. Output is handled by Next.js — do not set a static export directory.
4. Add `NEXT_PUBLIC_SITE_URL` with the production URL (for example `https://rapigents.com`) so Open Graph and the sitemap use the right host.
5. Deploy. No database or email provider is required. Configure the AI secrets above if you want the assistant enabled.

`public/brand/logo.png` is the favicon source (also copied to `src/app/icon.png`) and `public/brand/og.png` is the social preview.

## Brand files

- `public/brand/logo.svg` — crisp RA mark
- `public/brand/logo.png` — raster of the same mark
- `public/brand/og.png` — Open Graph image

No logo file was attached to the repository when this site was built, so the mark is an original RA monogram in the brand purple (`#7C3AED`). Replace those three files to swap the logo. The navbar uses the same paths, inlined in `src/components/logo.tsx` — update that path data if the SVG letterforms change.
