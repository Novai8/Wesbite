"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { InteractionLayer } from "@/components/interaction-layer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { RapigentsAssistant } from "@/components/rapigents-assistant";

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login" || pathname === "/auth/callback";

  if (isAuthRoute) return <>{children}</>;

  return (
    <>
      <InteractionLayer />
      <div className="sunline-progress" aria-hidden="true" />
      <a href="#content" className="skip-link">Skip to content</a>
      <SiteHeader />
      {children}
      <SiteFooter />
      <RapigentsAssistant />
    </>
  );
}
