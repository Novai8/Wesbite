import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-slate-600", className)}>
      <span>{site.disclaimerTitle}</span>
      <span className="mx-1.5 text-slate-300" aria-hidden>
        ·
      </span>
      <span>{site.disclaimerBody}</span>
    </p>
  );
}
