"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navLinks, site } from "@/lib/site";

// Close the mobile menu when a link inside it is clicked.
function MobileNav({ onNavigate, children }: { onNavigate: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onNavigate}>
      {children}
    </div>
  );
}

function FyndraMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" className={className} aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.75" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <line x1="15.8" y1="15.8" x2="21" y2="21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="10.5" cy="10.5" r="2.1" fill="currentColor" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-bold tracking-tight no-underline"
          aria-label={`${site.name} home`}
        >
          <FyndraMark className="text-cobalt" />
          <span>{site.name}</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link no-underline"
              data-active={pathname === link.href || pathname.startsWith(`${link.href}/`)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/assistant" className="btn btn-primary hidden md:inline-flex">
            Ask Fyndra
          </Link>
          <button
            type="button"
            className="btn btn-secondary px-3 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="sr-only">Toggle menu</span>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="mobile-nav" className="panel-reveal border-t border-line bg-paper md:hidden" aria-label="Mobile">
          <MobileNav onNavigate={() => setMenuOpen(false)}>
            <div className="container-page flex flex-col py-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-2 py-3 text-base font-medium text-muted no-underline hover:bg-surface-warm hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/assistant" className="btn btn-primary mt-2">
                Ask Fyndra
              </Link>
            </div>
          </MobileNav>
        </nav>
      )}
    </header>
  );
}
