import Link from "next/link";
import { Sparkles } from "lucide-react";
import { site } from "@/lib/site";

export function SiteFooter() {
  return <footer className="site-footer rg-new-footer"><div className="container-page footer-grid">
    <div><Link href="/" className="wordmark"><span className="rg-logo-emblem" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M8 30V10h11.5c6.3 0 9.8 3.2 9.8 8.1 0 4-2.4 6.5-6.4 7.3L30 30h-7.4l-6-4.4h-2V30H8Z" fill="currentColor"/><path d="M14.6 15.6v5h4.8c2 0 3.1-.8 3.1-2.5 0-1.6-1.1-2.5-3.1-2.5h-4.8Z" fill="#0A0B10"/><path d="M26.5 9.5 31 5l1.5 4.5L37 11l-4.5 1.5L31 17l-1.5-4.5L25 11l1.5-1.5Z" fill="#D8FF63"/></svg></span>RAPIGENTS</Link><p className="footer-big">Useful tools.<br/><em>Less friction.</em></p><p className="rg-footer-note"><Sparkles size={14}/> A little more flow in your day.</p></div>
    <div><span className="footer-label">Explore</span><div className="footer-links"><Link href="/tools">AI Tools</Link><Link href="/clip-ai">Clip AI</Link><Link href="/about">How it works</Link><Link href="/contact">Contact</Link></div></div>
    <div><span className="footer-label">Say hello</span><div className="footer-links"><a href={"mailto:" + site.email}>Email us</a><a href={site.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a></div></div>
  </div><div className="container-page footer-bottom"><span>© {new Date().getFullYear()} {site.name}</span><span>MADE FOR THE LITTLE TASKS THAT ADD UP.</span></div></footer>;
}
