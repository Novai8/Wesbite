import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { site } from "@/lib/site";
export const metadata:Metadata={title:"Describe the leak",description:"Tell Rapigents about a repetitive business process that keeps slipping through the cracks."};
export default function ContactPage(){return <main id="content"><section className="page-hero-clean contact-hero"><div className="container-page"><Link href="/" className="back-link"><ArrowLeft aria-hidden/> Back home</Link><span className="section-kicker">START WITH THE PROBLEM</span><h1>Where does the work disappear?</h1><p>Give us one repetitive process. The form builds a ready-to-send email in Gmail. Nothing is stored by this portfolio site.</p><a href={"mailto:"+site.email} className="contact-direct"><Mail aria-hidden/> {site.email}</a></div></section><section className="section-block"><div className="container-page"><ContactForm/></div></section></main>;}