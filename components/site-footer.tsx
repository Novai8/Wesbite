import Link from "next/link";
import { Logo } from "@/components/logo";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container-page footer-main">
        <div>
          <span className="footer-kicker">Rapigents</span>
          <h2 className="footer-title">Turn the work nobody owns into an operation somebody can trust.</h2>
          <p className="footer-copy">
            A problem-first AI operations prototype by {site.owner}. The current site
            is designed to prove the experience before live integrations are connected.
          </p>
        </div>
        <div>
          <span className="footer-col-title">Explore</span>
          <nav className="footer-links" aria-label="Footer">
            <Link href="/">Home</Link>
            <Link href="/demos">Demos</Link>
            <Link href="/about">How it works</Link>
            <Link href="/contact">Contact</Link>
          </nav>
        </div>
        <div>
          <span className="footer-col-title">Direct</span>
          <div className="footer-links">
            <a href={"mailto:" + site.email}>Email Hussnain</a>
            <a href={site.github} target="_blank" rel="noopener noreferrer">GitHub</a>
            <span>Human review by default.</span>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container-page footer-bottom-inner">
          <span>© {new Date().getFullYear()} {site.name}. Independent portfolio prototype.</span>
          <span>Demo data is fictional. Results are illustrative.</span>
        </div>
      </div>
    </footer>
  );
}
