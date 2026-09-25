# Rapigents

Portfolio site for **Hussnain Tariq** / **Rapigents**. Twelve niche-specific n8n workflow demos, with human review, audit notes, and fictional data. Purple and white, minimal, with page transitions, a custom cursor, and optional click sound.

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

Contact: [hussnain@rapigents.online](mailto:hussnain@rapigents.online)  
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

## Sound and cursor

- **Sound: Off** by default. The navbar toggle turns on a quiet Web Audio click. The choice is stored in `localStorage` (`rapigents-sound`).
- **Cursor effects: On** by default on a fine pointer, off when `prefers-reduced-motion` is set and the visitor has not chosen. Stored as `rapigents-cursor`.
- Touch devices keep the system cursor. On a fine pointer, a smooth hand cursor follows the mouse. The header toggle can turn it off.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com), import `Novai8/Wesbite`.
3. Framework preset: **Next.js**. Install command `npm install`. Build command `npm run build`. Output is handled by Next.js — do not set a static export directory.
4. Add `NEXT_PUBLIC_SITE_URL` with the production URL (for example `https://rapigents.online`) so Open Graph and the sitemap use the right host.
5. Deploy. No database, no email provider, and no secret keys are required.

`public/brand/logo.png` is the favicon source (also copied to `src/app/icon.png`) and `public/brand/og.png` is the social preview.

## Brand files

- `public/brand/logo.svg` — crisp RA mark
- `public/brand/logo.png` — raster of the same mark
- `public/brand/og.png` — Open Graph image

No logo file was attached to the repository when this site was built, so the mark is an original RA monogram in the brand purple (`#7C3AED`). Replace those three files to swap the logo. The navbar uses the same paths, inlined in `src/components/logo.tsx` — update that path data if the SVG letterforms change.
