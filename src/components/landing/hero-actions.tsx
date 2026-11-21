import Link from "next/link";

export function HeroActions() {
  return (
    <div className="hero-actions">
      <Link href="/discover" className="btn btn-primary hero-cta">
        Start Exploring
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none">
          <path d="M3 8h9.4M8.7 3.9 12.9 8l-4.2 4.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <Link href="/setup-builder" className="btn btn-secondary hero-cta">
        Build My Perfect Setup
      </Link>
    </div>
  );
}
