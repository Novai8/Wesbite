import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { Disclaimer } from "@/components/disclaimer";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Describe a problem", description: "Tell Rapigents about the business process that keeps falling through the cracks." };

export default function ContactPage() {
  return <main id="content">
    <section className="page-hero"><div className="container-page page-hero-grid"><div><Link href="/#analyze" className="back-link"><ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to the prototype</Link><h1>What keeps falling through the cracks?</h1><p>Describe the repetitive work, missed follow-up, scheduling mess or customer handoff that your team keeps dealing with. The current form opens Gmail. Nothing is stored here.</p><div className="contact-side-note"><span>Direct</span><a href={"mailto:" + site.email}>{site.email}</a><Link href="/demos">See existing patterns <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link></div></div><div className="page-hero-aside problem-aside"><span className="page-stat-number">START SMALL</span><p>One repetitive process is enough to begin.</p><span className="page-stat-number">SHOW THE LEAK</span><p>Tell us where time, leads or attention disappear.</p></div></div></section>
    <section className="container-page pb-20"><ContactForm /><Disclaimer className="mt-8" /></section>
  </main>;
}
