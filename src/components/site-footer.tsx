import Link from "next/link";
import { affiliateDisclosure, site } from "@/lib/site";

const exploreLinks = [
  { href: "/assistant", label: "Assistant" },
  { href: "/setup-builder", label: "Setup builder" },
  { href: "/problem-solver", label: "Problem solver" },
  { href: "/discover", label: "Discover" },
  { href: "/compare", label: "Compare" },
  { href: "/guides", label: "Guides" },
];

const companyLinks = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const legalLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/affiliate-disclosure", label: "Affiliate disclosure" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="container-page grid gap-12 py-14 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="min-w-0">
          <p className="font-display text-xl font-bold tracking-tight">{site.name}</p>
          <p className="mt-2 text-sm font-medium text-cobalt-deep">{site.tagline}</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            {site.name} searches a curated catalogue of real products and shows
            you the reasoning behind every recommendation.
          </p>
        </div>

        <nav aria-label="Explore">
          <p className="eyebrow">Explore</p>
          <ul className="mt-3 list-none space-y-2 p-0">
            {exploreLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-muted no-underline hover:text-ink">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <p className="eyebrow">Company</p>
          <ul className="mt-3 list-none space-y-2 p-0">
            {companyLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-muted no-underline hover:text-ink">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Legal">
          <p className="eyebrow">Legal</p>
          <ul className="mt-3 list-none space-y-2 p-0">
            {legalLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-muted no-underline hover:text-ink">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-xs leading-relaxed text-faint">{affiliateDisclosure.short}</p>
          <p className="text-xs text-faint">
            © {new Date().getFullYear()} {site.owner}
          </p>
        </div>
      </div>
    </footer>
  );
}
