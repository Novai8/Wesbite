"use client";

import Link from "next/link";
import { useState } from "react";
import { site } from "@/lib/site";

const primaryLinks = [
  { href: "/discover", label: "Discover" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "/guides", label: "Shopping Guides" },
] as const;

function Mark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.75" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <line x1="15.8" y1="15.8" x2="21" y2="21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="10.5" cy="10.5" r="2.1" fill="currentColor" />
    </svg>
  );
}

export function HeroNavigation() {
  const [open, setOpen] = useState(false);

  return (
    <div className="hero-nav-wrap">
      <div className="container-page">
        <nav className="hero-nav" aria-label="Primary">
          <Link href="/" className="hero-nav-brand" aria-label={`${site.name} home`}>
            <Mark />
            <span>{site.name}</span>
          </Link>

          <ul className="hero-nav-links">
            {primaryLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hero-nav-link">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hero-nav-right">
            <Link href="/discover" className="btn btn-primary hero-nav-cta">
              Start shopping
            </Link>
            <button
              type="button"
              className="hero-nav-toggle"
              aria-expanded={open}
              aria-controls="hero-mobile-nav"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="sr-only">Toggle menu</span>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none">
                {open ? (
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </nav>
      </div>

      {open ? (
        <div id="hero-mobile-nav" className="hero-mobile">
          <div className="container-page">
            <ul className="hero-mobile-list">
              {primaryLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} onClick={() => setOpen(false)}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
