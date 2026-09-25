import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none tracking-wide",
        tone === "accent"
          ? "border-accent-line bg-accent-soft text-accent-ink"
          : "border-line bg-white text-slate-600",
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
