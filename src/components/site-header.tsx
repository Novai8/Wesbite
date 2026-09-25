"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Volume2, VolumeX } from "lucide-react";
import { Logo } from "@/components/logo";
import { usePrefs } from "@/components/providers";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

const links = [
  { href: "/demos", label: "Demos" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const { sound, toggleSound } = usePrefs();
  const headerRef = useRef<HTMLElement>(null);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const open = menuPath === pathname;

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => {
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header ref={headerRef} className={cn("site-header", scrolled && "is-scrolled")}>
      <div className="container-page flex h-16 items-center gap-3">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-md"
          aria-label="Rapigents home"
        >
          <Logo />
          <span className="hidden truncate text-[15px] font-medium tracking-tight min-[380px]:inline">
            Rapigents
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-6 md:flex" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-active={isActive(pathname, link.href)}
              className="nav-link"
              aria-current={isActive(pathname, link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            className="toggle-chip"
            aria-pressed={sound}
            aria-label={`Sound: ${sound ? "On" : "Off"}`}
            onClick={toggleSound}
          >
            {sound ? (
              <Volume2 className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <VolumeX className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className="hidden md:inline">Sound: {sound ? "On" : "Off"}</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost h-10 w-10 px-0 md:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setMenuPath(pathname)}
          >
            <Menu className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="trust-strip">
        <div className="container-page flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium tracking-wide text-slate-700 uppercase">
            <li>Independent portfolio prototype</li>
            <li className="text-slate-300" aria-hidden>
              ·
            </li>
            <li>Fictional data</li>
            <li className="text-slate-300" aria-hidden>
              ·
            </li>
            <li>Illustrative estimates</li>
          </ul>
          <p className="max-w-xl text-[11px] leading-snug text-slate-600">
            {site.disclaimerTitle}
            <span className="mx-1 text-slate-300" aria-hidden>
              ·
            </span>
            {site.disclaimerBody}
          </p>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(next) => setMenuPath(next ? pathname : null)}>
        <DialogContent variant="drawer">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-medium tracking-tight">
                Menu
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted">
                {site.owner} · {site.name}
              </DialogDescription>
            </div>
            <DialogCloseButton />
          </div>
          <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile">
            <Link href="/" className="drawer-link" onClick={() => setMenuPath(null)}>
              Home
            </Link>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="drawer-link"
                aria-current={isActive(pathname, link.href) ? "page" : undefined}
                onClick={() => setMenuPath(null)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 flex flex-col gap-2">
            <button
              type="button"
              className="toggle-chip w-full justify-between"
              aria-pressed={sound}
              onClick={toggleSound}
            >
              <span>Sound: {sound ? "On" : "Off"}</span>
              {sound ? (
                <Volume2 className="h-4 w-4" aria-hidden />
              ) : (
                <VolumeX className="h-4 w-4" aria-hidden />
              )}
            </button>
            <p className="px-1 text-xs leading-relaxed text-slate-500">
              Sound stays off until you turn it on.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
