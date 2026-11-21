import { cn } from "@/lib/utils";

export type BadgeTone = "verified" | "ai" | "neutral";

const tones: Record<BadgeTone, string> = {
  verified: "badge-verified",
  ai: "badge-ai",
  neutral: "badge-neutral",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span className={cn("badge", tones[tone], className)}>
      {children}
    </span>
  );
}
