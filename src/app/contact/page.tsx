import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, Sparkles } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { site } from "@/lib/site";
import { FloatingCardScene } from "@/components/floating-card-scene";

export const metadata: Metadata = { title: "Contact", description: "Questions, feedback, or ideas for Rapigents AI tools." };

export default function ContactPage() {
  return <main id="content"><section className="page-hero-clean contact-hero rg-contact-hero"><FloatingCardScene kind="contact" /><div className="rg-contact-motion" aria-hidden="true"><div className="rg-contact-ring ring-a"/><div className="rg-contact-ring ring-b"/><div className="rg-contact-ring ring-c"/><div className="rg-contact-core"><Mail size={24}/><Sparkles size={13}/></div><i className="rg-contact-signal signal-a"/><i className="rg-contact-signal signal-b"/><i className="rg-contact-signal signal-c"/></div><div className="container-page rg-contact-copy">
    <Link href="/" className="back-link"><ArrowLeft aria-hidden/> Back home</Link>
    <span className="section-kicker">LET’S TALK TOOLS</span>
    <h1>Have a question or an idea?</h1>
    <p>Send feedback, report an issue, or tell us which tool would make your day easier.</p>
    <a href={"mailto:" + site.email} className="contact-direct"><Mail aria-hidden/> {site.email}</a>
  </div></section><section className="section-block"><div className="container-page"><div className="rg-contact-intro"><Sparkles size={18}/><span>Feedback helps us make the toolkit more useful.</span></div><ContactForm/></div></section></main>;
}
