import { Play } from "lucide-react";

function youtubeId(url: string) {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/,
  );
  return match?.[1] ?? null;
}

export function MediaFrame({
  title,
  videoUrl,
  thumbnailUrl,
  embed = true,
}: {
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  embed?: boolean;
}) {
  const yt = videoUrl ? youtubeId(videoUrl) : null;
  const embedSrc =
    yt && videoUrl.includes("/embed/")
      ? videoUrl
      : yt
        ? `https://www.youtube.com/embed/${yt}`
        : "";

  if (yt && embed) {
    return (
      <div className="media-frame aspect-video overflow-hidden rounded-[1.1rem] bg-ink">
        <iframe
          className="h-full w-full border-0"
          src={embedSrc}
          title={`${title} walkthrough`}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  if (yt) {
    const poster = thumbnailUrl || `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
    return (
      <div
        className="media-frame relative aspect-video overflow-hidden rounded-[1.1rem] bg-ink"
        role="img"
        aria-label={`Watch demo: ${title}`}
      >
        {/* External YouTube poster. Not optimized through next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-ink/35" aria-hidden />
        <div className="relative flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-ink">
            <Play className="h-4 w-4 translate-x-px" aria-hidden />
          </span>
          <p className="text-sm font-medium">Watch demo</p>
        </div>
      </div>
    );
  }

  if (videoUrl) {
    return (
      <video
        className="media-frame aspect-video w-full rounded-[1.1rem] bg-ink"
        controls
        playsInline
        preload="metadata"
        poster={thumbnailUrl || undefined}
      >
        <source src={videoUrl} />
      </video>
    );
  }

  if (thumbnailUrl) {
    return (
      <div className="media-frame relative aspect-video overflow-hidden rounded-[1.1rem] bg-accent-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className="media-frame relative aspect-video overflow-hidden rounded-[1.1rem] bg-accent-soft"
      role="img"
      aria-label={`${title} video placeholder`}
    >
      <div className="media-dots" aria-hidden />
      <div className="relative flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-slate-200 bg-white">
          <Play className="h-4 w-4 translate-x-px text-ink" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-medium text-ink">Video placeholder</p>
          <p className="mt-1 text-xs text-slate-500">Walkthrough frame left blank</p>
        </div>
      </div>
    </div>
  );
}
