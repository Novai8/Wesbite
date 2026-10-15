"use client";

import { useEffect, useState } from "react";
import { Menu, Moon, Sun, X, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePrefs } from "@/components/providers";

const links = [{ href: "/tools", label: "AI Tools" }, { href: "/about", label: "How it works" }, { href: "/contact", label: "Contact" }];

export function SiteHeader() {
  const { theme, toggleTheme } = usePrefs();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
      <Link href="/" className="wordmark" aria-label="Rapigents home" onClick={() => setOpen(false)}><span className="wordmark-sun" aria-hidden="true"/>RAPIGENTS<span className="rg-brand-spark"><Sparkles size={12}/></span></Link>
      <nav className="desktop-nav" aria-label="Primary">{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
      <div className="header-actions">
        <button type="button" className="sound-button" onClick={toggleTheme} aria-label="Switch color theme">{theme === "dark" ? <Moon aria-hidden/> : <Sun aria-hidden/>}<span>{theme === "dark" ? "DARK" : "LIGHT"}</span></button>
        <Link href="/tools" className="header-cta">Explore tools <span aria-hidden="true">↗</span></Link>
        <button type="button" className="mobile-menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X aria-hidden/> : <Menu aria-hidden/>}</button>
      </div>
    </div>
    {open && <div className="mobile-menu"><nav aria-label="Mobile">{links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}<button type="button" className="mobile-menu-row" onClick={toggleTheme}>Switch theme: {theme === "dark" ? "Dark" : "Light"}</button><Link href="/tools" onClick={() => setOpen(false)} className="mobile-menu-cta">Explore AI tools ↗</Link></nav></div>}
  </header>;
}
