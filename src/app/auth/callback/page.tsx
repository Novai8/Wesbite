"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}

function AuthCallbackContent() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | undefined;

    async function finish() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setError("Authentication is not configured yet. Add the Supabase public URL and anon key to Cloudflare.");
        return;
      }

      const url = new URL(window.location.href);
      const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
      if (providerError) {
        setError(providerError);
        return;
      }

      // Read the actual browser URL rather than relying only on Next's search-param snapshot.
      const code = url.searchParams.get("code");
      if (code) {
        // Remove the one-time code from the visible URL synchronously. This also prevents a
        // Strict Mode effect replay from attempting to exchange the same PKCE code a second time.
        const nextUrl = url.searchParams.get("next");
        window.history.replaceState(null, "", url.pathname + (nextUrl ? "?next=" + encodeURIComponent(nextUrl) : "") + url.hash);
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError("We received the sign-in response but couldn't create your session. Please try again. (" + exchangeError.message + ")");
          return;
        }
      } else {
        // Support an existing session or an implicit-flow response, while preferring PKCE code exchange.
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");
        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
          if (sessionError) {
            setError("The identity provider returned tokens, but Rapigents couldn't establish your session. Please try again.");
            return;
          }
        }
      }

      const { data: initial, error: initialError } = await supabase.auth.getSession();
      if (initialError) {
        setError("We couldn't verify your Rapigents session. Please try signing in again.");
        return;
      }
      if (initial.session) {
        if (active) router.replace(safeNext(url.searchParams.get("next")));
        return;
      }

      // Auth state can finish initializing just after the callback page hydrates. Wait briefly for it
      // rather than incorrectly telling the user to sign in a second time.
      const session = await new Promise<boolean>((resolve) => {
        let settled = false;
        const finishWait = (value: boolean) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          subscription?.unsubscribe();
          resolve(value);
        };
        const timeout = window.setTimeout(() => finishWait(false), 3000);
        const auth = supabase.auth.onAuthStateChange((event, session) => {
          if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) finishWait(true);
          if (event === "SIGNED_OUT") finishWait(false);
        });
        subscription = auth.data.subscription;
        void supabase.auth.getSession().then(({ data }) => {
          if (data.session) finishWait(true);
        }).catch(() => finishWait(false));
      });

      if (active && session) {
        router.replace(safeNext(url.searchParams.get("next")));
        return;
      }
      if (active) {
        setError("Rapigents returned from the identity provider without a usable session. Please try again. If this repeats, the Supabase OAuth callback or provider configuration needs checking.");
      }
    }

    void finish().catch(() => {
      if (active) setError("Something interrupted secure sign-in. Please try again.");
    });
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [router]);

  return <main className="rg-auth-callback"><div className="rg-login-card"><span className="rg-login-card-icon">R.</span><h1>{error ? "Sign-in needs attention" : "Securing your session"}</h1><p>{error || "Completing your sign-in and returning you to Rapigents…"}</p>{error && <Link href="/login" className="rg-login-submit">Back to sign in</Link>}</div></main>;
}

export default function AuthCallbackPage() {
  return <Suspense fallback={<main className="rg-auth-callback"><p>Completing secure sign-in…</p></main>}><AuthCallbackContent /></Suspense>;
}
