"use client";

import { usePathname } from "next/navigation";

// The homepage carries its own editorial navigation, so the global
// header would be a second masthead stacked above it.
const SELF_CHROMED_ROUTES = new Set(["/"]);

export function ChromeGate({ slot, children }: { slot: "header"; children: React.ReactNode }) {
  const pathname = usePathname();
  if (slot === "header" && SELF_CHROMED_ROUTES.has(pathname)) return null;
  return <>{children}</>;
}
