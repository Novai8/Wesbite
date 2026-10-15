import Link from "next/link";
import { Sparkles } from "lucide-react";
import { site } from "@/lib/site";

export function SiteFooter() {
  return <footer className="site-footer rg-new-footer"><div className="container-page footer-grid">
    <div><Link href="/" className="wordmark"><span className="wordmark-sun" aria-hidden="true"/>RAPIGENTS</Link><p className="footer-big">Useful tools.<br/><em>Less friction.</em></p><p className="rg-footer-note"><Sparkles size={14}/> A little more flow in your day.</p></div>
    <div><span className="footer-label">Explore</span><div className="footer-links"><Link href="/tools">AI Tools</Link><Link href="/about">How it works</Link><Link href="/contact">Contact</Link></div></div>
    <div><span className="footer-label">Say hello</span><div className="footer-links"><a href={"mailto:" + site.email}>Email us</a><a href={site.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a></div></div>
  </div><div className="container-page footer-bottom"><span>© {new Date().getFullYear()} {site.name}</span><span>MADE FOR THE LITTLE TASKS THAT ADD UP.</span></div></footer>;
}
