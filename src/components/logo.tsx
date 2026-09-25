import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo-mark.svg"
      alt="Rapigents"
      width={128}
      height={77}
      className={cn("h-8 w-auto shrink-0 object-contain", className)}
      priority
    />
  );
}
