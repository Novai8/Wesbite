"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import "./login.css";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup" | "magic">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeProvider, setActiveProvider] = useState<"google" | "azure" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [setupMissing, setSetupMissing] = useState(false);
  const next = safeNext(searchParams.get("next"));

  async function oauth(provider: "google" | "azure") {
    setBusy(true); setActiveProvider(provider); setError(""); setNotice("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setSetupMissing(true); setBusy(false); setActiveProvider(null); return; }
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin + "/auth/callback?next=" + encodeURIComponent(next),
          ...(provider === "google" ? { scopes: "openid email profile" } : { scopes: "openid email profile" }),
        },
      });
      if (authError) setError(authError.message);
    } catch {
      setError("We couldn't start secure sign-in. Check your connection and try again.");
    } finally {
      // On success the browser navigates to the provider; clear the pending state only if we remain here.
      if (window.location.pathname === "/login") {
        setBusy(false);
        setActiveProvider(null);
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setSetupMissing(true); setBusy(false); return; }
    if (mode === "magic") {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + "/auth/callback?next=" + encodeURIComponent(next) },
      });
      if (authError) setError(authError.message);
      else setNotice("Check your inbox for a secure sign-in link. You can close this page after opening it.");
      setBusy(false); return;
    }
    if (mode === "signup") {
      const { data, error: authError } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin + "/auth/callback?next=" + encodeURIComponent(next) },
      });
      if (authError) setError(authError.message);
      else if (data.session) router.replace(next);
      else setNotice("Check your email to confirm your account, then return here to sign in.");
      setBusy(false); return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(authError.message);
    else router.replace(next);
    setBusy(false);
  }

  return <main className="rg-login-page">
    <div className="rg-login-top"><Link href="/" className="rg-login-brand"><span>R.</span> RAPIGENTS</Link><span className="rg-login-secure"><ShieldCheck size={14}/> PRIVATE BY DESIGN</span></div>
    <div className="rg-login-layout">
      <section className="rg-login-story">
        <span className="rg-login-eyebrow"><Sparkles size={13}/> YOUR AI WORKSPACE</span>
        <h1>Bring your tools.<br/><em>Put AI to work.</em></h1>
        <p>One workspace for useful AI tools, connected apps and workflows you control.</p>
        <div className="rg-login-points"><span><CheckCircle2 size={16}/> Connect your own apps</span><span><CheckCircle2 size={16}/> Review actions before they run</span><span><CheckCircle2 size={16}/> Manage access on your terms</span></div>
        <div className="rg-login-orbit" aria-hidden="true"><div className="rg-orbit-ring ring-one"/><div className="rg-orbit-ring ring-two"/><div className="rg-orbit-core"><Sparkles size={25}/></div><i className="orbit-dot dot-one"/><i className="orbit-dot dot-two"/><i className="orbit-dot dot-three"/></div>
      </section>
      <section className="rg-login-card">
        <div className="rg-login-card-head"><span className="rg-login-card-icon"><ShieldCheck size={18}/></span><span className="rg-login-kicker">SECURE ACCESS</span></div>
        <h2>{mode === "signup" ? "Create your account" : mode === "magic" ? "Sign in by email" : "Welcome back"}</h2>
        <p className="rg-login-subtitle">{mode === "signup" ? "Start with your email, Google or Microsoft account." : "Sign in to continue to Rapigents."}</p>
        <div className="rg-oauth-buttons">
          <button type="button" onClick={() => void oauth("google")} disabled={busy} className="rg-oauth-button"><GoogleMark/> {busy && activeProvider === "google" ? "Connecting to Google…" : "Continue with Google"}</button>
          <button type="button" onClick={() => void oauth("azure")} disabled={busy} className="rg-oauth-button"><MicrosoftMark/> {busy && activeProvider === "azure" ? "Connecting to Microsoft…" : "Continue with Microsoft / Outlook"}</button>
        </div>
        <p className="rg-login-provider-note"><ShieldCheck size={13}/> Google sign-in requests only your basic profile and email. It does not grant Rapigents access to Gmail, Drive, or Calendar.</p>
        <div className="rg-login-divider"><span/> <small>OR USE EMAIL</small> <span/></div>
        <form className="rg-login-form" onSubmit={submit}>
          <label htmlFor="login-email">Email address</label>
          <div className="rg-login-input"><Mail size={16}/><input id="login-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></div>
          {mode !== "magic" && <><label htmlFor="login-password">Password</label><div className="rg-login-input"><input id="login-password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters"/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></>}
          {error && <p className="rg-login-error" role="alert">{error}</p>}
          {notice && <p className="rg-login-notice" role="status">{notice}</p>}
          {setupMissing && <div className="rg-login-setup"><strong>One-time setup required</strong><p>Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to the Cloudflare Pages environment, then enable Google, Azure and Email providers in Supabase Auth. These public client settings are not service-role secrets.</p></div>}
          <button type="submit" className="rg-login-submit" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "magic" ? "Email me a sign-in link" : "Sign in"} <ArrowRight size={16}/></button>
        </form>
        <div className="rg-login-mode">
          {mode === "signin" ? <><button type="button" onClick={() => {setMode("magic");setError("");setNotice("");}}>Use an email sign-in link</button><span>New here? <button type="button" onClick={() => {setMode("signup");setError("");setNotice("");}}>Create account</button></span></> : <button type="button" onClick={() => {setMode("signin");setError("");setNotice("");}}>Back to sign in</button>}
        </div>
        <p className="rg-login-terms">Signing in lets Rapigents remember your account session. Connected-app permissions are separate and must be granted by you.</p>
      </section>
    </div>
    <footer className="rg-login-footer"><span>Privacy &amp; security</span><span>© {new Date().getFullYear()} Rapigents</span><span>Access you control</span></footer>
  </main>;
}

export default function LoginPage() {
  return <Suspense fallback={<main className="rg-auth-gate-loading"><div className="rg-auth-mark">R.</div><p>Loading secure sign-in…</p></main>}><LoginContent /></Suspense>;
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" width="17" height="17"><path fill="#4285F4" d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.38a4.6 4.6 0 0 1-2 3.02v2.47h3.24c1.9-1.75 2.98-4.33 2.98-7.28Z"/><path fill="#34A853" d="M10 20c2.7 0 4.96-.9 6.62-2.49l-3.24-2.47c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.13H1.06v2.54A10 10 0 0 0 10 20Z"/><path fill="#FBBC05" d="M4.41 11.87A6 6 0 0 1 4.1 10c0-.65.11-1.28.31-1.87V5.59H1.06A10 10 0 0 0 0 10c0 1.6.38 3.12 1.06 4.41l3.35-2.54Z"/><path fill="#EA4335" d="M10 3.99c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 10 0a10 10 0 0 0-8.94 5.59l3.35 2.54C5.2 5.75 7.4 3.99 10 3.99Z"/></svg>;
}
function MicrosoftMark() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" width="17" height="17"><path fill="#F35325" d="M1 1h8.5v8.5H1z"/><path fill="#81BC06" d="M10.5 1H19v8.5h-8.5z"/><path fill="#05A6F0" d="M1 10.5h8.5V19H1z"/><path fill="#FFBA08" d="M10.5 10.5H19V19h-8.5z"/></svg>;
}
