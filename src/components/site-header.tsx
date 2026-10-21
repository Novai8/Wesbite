"use client";

import { useEffect, useState } from "react";
import { Menu, Moon, Sun, X, Sparkles, LogOut } from "lucide-react";
import Link from "next/link";
import { usePrefs } from "@/components/providers";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

const links = [{ href: "/tools", label: "AI Tools" }, { href: "/integrations", label: "Integrations" }, { href: "/clip-ai", label: "Clip AI" }, { href: "/about", label: "How it works" }, { href: "/contact", label: "Contact" }];

export function SiteHeader() {
  const { theme, toggleTheme } = usePrefs();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setAccountEmail(data.user?.email || ""));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setAccountEmail(session?.user.email || ""));
    return () => subscription.unsubscribe();
  }, []);
  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/login";
  }
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return <header className="site-header" data-scrolled={scrolled}>
    <div className="container-page header-inner">
      <Link href="/" className="wordmark" aria-label="Rapigents home" onClick={() => setOpen(false)}><span className="rg-logo-emblem" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M8 30V10h11.5c6.3 0 9.8 3.2 9.8 8.1 0 4-2.4 6.5-6.4 7.3L30 30h-7.4l-6-4.4h-2V30H8Z" fill="currentColor"/><path d="M14.6 15.6v5h4.8c2 0 3.1-.8 3.1-2.5 0-1.6-1.1-2.5-3.1-2.5h-4.8Z" fill="#0A0B10"/><path d="M26.5 9.5 31 5l1.5 4.5L37 11l-4.5 1.5L31 17l-1.5-4.5L25 11l1.5-1.5Z" fill="#D8FF63"/></svg></span>RAPIGENTS<span className="rg-brand-spark"><Sparkles size={12}/></span></Link>
      <nav className="desktop-nav" aria-label="Primary">{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
      <div className="header-actions">
        <button type="button" className="sound-button" onClick={toggleTheme} aria-label="Switch color theme">{theme === "dark" ? <Moon aria-hidden/> : <Sun aria-hidden/>}<span>{theme === "dark" ? "DARK" : "LIGHT"}</span></button>
        <button type="button" className="header-cta rg-header-ask" onClick={() => window.dispatchEvent(new Event("rapigents:open-assistant"))}><Sparkles size={14}/> Ask AI</button><Link href="/tools" className="header-cta">Explore tools <span aria-hidden="true">↗</span></Link>{accountEmail && <button type="button" className="rg-account-signout" title={"Signed in as " + accountEmail} aria-label="Sign out" onClick={() => void signOut()}><LogOut size={14}/><span>Sign out</span></button>}
        <button type="button" className="mobile-menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X aria-hidden/> : <Menu aria-hidden/>}</button>
      </div>
    </div>
    {open && <div className="mobile-menu"><nav aria-label="Mobile">{links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}<button type="button" className="mobile-menu-row" onClick={toggleTheme}>Switch theme: {theme === "dark" ? "Dark" : "Light"}</button>{accountEmail && <button type="button" className="mobile-menu-row" onClick={() => void signOut()}><LogOut size={14}/> Sign out</button>}<button type="button" className="mobile-menu-cta rg-mobile-ask" onClick={() => { setOpen(false); window.dispatchEvent(new Event("rapigents:open-assistant")); }}><Sparkles size={15}/> Ask the AI assistant</button><Link href="/tools" onClick={() => setOpen(false)} className="mobile-menu-cta">Explore AI tools ↗</Link></nav></div>}
  </header>;
}
