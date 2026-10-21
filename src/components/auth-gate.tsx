"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "signed-in" | "signed-out" | "setup-needed">("checking");

  useEffect(() => {
    if (pathname === "/login" || pathname === "/auth/callback") {
      setStatus("signed-out");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("setup-needed");
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) setStatus("signed-in");
      else {
        setStatus("signed-out");
        const currentSearch = typeof window !== "undefined" ? window.location.search : "";
        const next = pathname + currentSearch;
        router.replace("/login?next=" + encodeURIComponent(next));
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (session) setStatus("signed-in");
      else {
        setStatus("signed-out");
        if (pathname !== "/login" && pathname !== "/auth/callback") router.replace("/login?next=" + encodeURIComponent(pathname || "/"));
      }
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [pathname, router]);

  if (pathname === "/login" || pathname === "/auth/callback") return <>{children}</>;
  if (status === "signed-in") return <>{children}</>;
  return <main className="rg-auth-gate-loading" aria-live="polite">
    <div className="rg-auth-mark">R.</div>
    <p>{status === "setup-needed" ? "Authentication needs configuration" : "Checking your Rapigents session…"}</p>
    {status === "setup-needed" && <a href="/login">Open sign in setup</a>}
  </main>;
}
