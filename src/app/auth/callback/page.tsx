"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function finish() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setError("Authentication is not configured yet. Add the Supabase public URL and anon key to Cloudflare."); return; }
      const code = params.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) { setError(exchangeError.message); return; }
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) { setError(sessionError?.message || "No active session was returned by the identity provider."); return; }
      if (active) router.replace(safeNext(params.get("next")));
    }
    void finish();
    return () => { active = false; };
  }, [params, router]);
  return <main className="rg-auth-callback"><div className="rg-login-card"><span className="rg-login-card-icon">R.</span><h1>{error ? "Sign-in needs attention" : "Securing your session"}</h1><p>{error || "Completing your sign-in and returning you to Rapigents…"}</p>{error && <Link href="/login" className="rg-login-submit">Back to sign in</Link>}</div></main>;
}

export default function AuthCallbackPage() {
  return <Suspense fallback={<main className="rg-auth-callback"><p>Completing secure sign-in…</p></main>}><AuthCallbackContent /></Suspense>;
}

