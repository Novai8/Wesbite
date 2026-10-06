"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu } from "lucide-react";
import { Logo } from "@/components/logo";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const links = [
  { href: "/demos", label: "Demos" },
  { href: "/about", label: "How it works" },
  { href: "/contact", label: "Contact" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function SiteHeader() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const open = menuPath === pathname;

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () => {
      document.documentElement.style.setProperty("--header-h", el.offsetHeight + "px");
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header ref={headerRef} className={cn("site-header", scrolled && "is-scrolled")}>
      <div className="container-page flex h-16 items-center gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-md" aria-label="Rapigents home">
          <Logo />
          <span className="truncate text-[15px] font-semibold tracking-tight">Rapigents</span>
        </Link>

        <nav className="ml-8 hidden items-center gap-7 md:flex" aria-label="Primary">
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

        <div className="ml-auto flex items-center gap-2">
          <Link href="/#analyze" className="hidden h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-white no-underline transition-transform hover:-translate-y-0.5 sm:inline-flex">
            Describe a problem
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <button
            type="button"
            className="btn btn-ghost h-10 w-10 px-0 md:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setMenuPath(pathname)}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="header-status">
        <div className="container-page header-status-inner">
          <span>Problem-first AI operations</span>
          <span className="hidden sm:inline">Prototype mode · Human review by default · Fictional data</span>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(next) => setMenuPath(next ? pathname : null)}>
        <DialogContent variant="drawer">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-medium tracking-tight">Rapigents</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted">
                Describe the work. See the operation.
              </DialogDescription>
            </div>
            <DialogCloseButton />
          </div>
          <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile">
            <Link href="/" className="drawer-link" onClick={() => setMenuPath(null)}>Home</Link>
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
          <Link href="/#analyze" className="btn btn-primary mt-8 h-12 w-full" onClick={() => setMenuPath(null)}>
            Describe a problem
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </DialogContent>
      </Dialog>
    </header>
  );
}
