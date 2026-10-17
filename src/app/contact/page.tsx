import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { site } from "@/lib/site";
import { FloatingCardScene } from "@/components/floating-card-scene";

export const metadata: Metadata = { title: "Contact", description: "Questions, feedback, or ideas for Rapigents AI tools." };

export default function ContactPage() {
  return <main id="content"><section className="page-hero-clean contact-hero rg-contact-hero"><FloatingCardScene kind="contact" /><div className="container-page rg-contact-copy">
    <Link href="/" className="back-link"><ArrowLeft aria-hidden/> Back home</Link>
    <span className="section-kicker">LET’S TALK TOOLS</span>
    <h1>Have a question or an idea?</h1>
    <p>Send feedback, report an issue, or tell us which tool would make your day easier.</p>
    <a href={"mailto:" + site.email} className="contact-direct"><Mail aria-hidden/> {site.email}</a>
  </div></section><section className="section-block"><div className="container-page"><ContactForm/></div></section></main>;
}
