import Link from "next/link";
import { GithubIcon } from "@/components/github-icon";
import { Logo } from "@/components/logo";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-line bg-white">
      <div className="container-page grid gap-10 py-14 sm:py-16 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Rapigents home">
            <Logo />
            <span className="font-medium tracking-tight">Rapigents</span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            AI workflow automation demos for agencies, search firms, and small
            service businesses. Built to be reviewed, not to run unsupervised.
          </p>
          <a
            href={`mailto:${site.email}`}
            className="mt-6 block max-w-full text-[clamp(1.35rem,3.4vw,2.4rem)] leading-tight font-medium tracking-tight break-anywhere"
          >
            {site.email}
          </a>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase">
              Pages
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <Link href="/demos">Demos</Link>
              </li>
              <li>
                <Link href="/about">About</Link>
              </li>
              <li>
                <Link href="/contact">Contact</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase">
              Elsewhere
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <a
                  href={site.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5"
                >
                  <GithubIcon className="h-4 w-4" />
                  GitHub
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${site.email}`}>Email Hussnain</a>
              </li>
              <li>
                <a href="https://n8n.io" target="_blank" rel="noopener noreferrer">
                  n8n
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Practical AI automation for growing teams.
          </p>
          <p className="text-xs text-slate-500">
            {site.owner} · {site.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
