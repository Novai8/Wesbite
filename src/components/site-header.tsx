"use client";

import { useEffect, useState } from "react";
import { Menu, Moon, Sun, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { usePrefs } from "@/components/providers";

const links = [
  { href: "/demos", label: "Patterns" },
  { href: "/about", label: "Method" },
  { href: "/reviews", label: "Reviews" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const { sound, toggleSound, theme, toggleTheme } = usePrefs();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const mode = theme === "dark" ? "DEEP" : "DAY";
  return (
    <header className="site-header" data-scrolled={scrolled}>
      <div className="container-page header-inner">
        <Link href="/" className="wordmark" aria-label="Rapigents home">
          <span className="wordmark-sun" aria-hidden="true" />
          RAPIGENTS
        </Link>
        <nav className="desktop-nav" aria-label="Primary">
          {links.map((l) => (
            <Link key={l.href} href={l.href}>{l.label}</Link>
          ))}
        </nav>
        <div className="header-actions">
          <button type="button" className="sound-button" onClick={toggleTheme} aria-label={`Switch environment mode. Currently ${mode === "DEEP" ? "deep" : "day"}.`}>
            {theme === "dark" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
            <span>{mode}</span>
          </button>
          <button type="button" className={"sound-button" + (sound ? " is-on" : "")} onClick={toggleSound} aria-pressed={sound} aria-label="Interface sound effects">
            {sound ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
            <span>{sound ? "SFX ON" : "SFX OFF"}</span>
          </button>
          <Link href="/contact" className="header-cta">Describe the leak</Link>
          <button type="button" className="mobile-menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="mobile-menu">
          <nav aria-label="Mobile">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>
            ))}
            <button type="button" className="mobile-menu-row" onClick={toggleTheme}>Environment: {mode}</button>
            <button type="button" className="mobile-menu-row" onClick={toggleSound}>Sound effects: {sound ? "ON" : "OFF"}</button>
            <Link href="/contact" onClick={() => setOpen(false)} className="mobile-menu-cta">Describe the leak</Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
