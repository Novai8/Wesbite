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
    let authStateResolved = false;

    const redirectToLogin = () => {
      if (!alive) return;
      setStatus("signed-out");
      const currentSearch = typeof window !== "undefined" ? window.location.search : "";
      const next = pathname + currentSearch;
      router.replace("/login?next=" + encodeURIComponent(next));
    };

    // Subscribe before checking storage, so a SIGNED_IN event cannot be overwritten by a stale
    // getSession() result from the same render.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (session) {
        authStateResolved = true;
        setStatus("signed-in");
      } else if (event === "SIGNED_OUT") {
        authStateResolved = true;
        redirectToLogin();
      }
      // An empty INITIAL_SESSION is not enough to redirect immediately. The explicit session
      // check below is the single authority for an initially signed-out page.
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive || authStateResolved) return;
      if (!error && data.session) {
        authStateResolved = true;
        setStatus("signed-in");
      } else {
        authStateResolved = true;
        redirectToLogin();
      }
    }).catch(() => {
      if (!alive || authStateResolved) return;
      authStateResolved = true;
      redirectToLogin();
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (pathname === "/login" || pathname === "/auth/callback") return <>{children}</>;
  if (status === "signed-in") return <>{children}</>;
  return <main className="rg-auth-gate-loading" aria-live="polite">
    <div className="rg-auth-mark">R.</div>
    <p>{status === "setup-needed" ? "Authentication needs configuration" : "Checking your Rapigents session…"}</p>
    {status === "setup-needed" && <a href="/login">Open sign in setup</a>}
  </main>;
}
