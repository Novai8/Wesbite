import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { Disclaimer } from "@/components/disclaimer";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact ${site.owner} at ${site.email} about an n8n workflow demo.`,
};

export default function ContactPage() {
  return (
    <main className="container-page py-14 sm:py-20">
      <p className="text-xs font-medium tracking-[0.18em] text-accent-ink uppercase">
        Contact
      </p>
      <h1 className="mt-3 max-w-3xl text-[clamp(2.4rem,5vw,4.4rem)] leading-[0.98] font-medium tracking-[-0.04em] text-balance">
        Request a workflow, or just write.
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
        {site.owner} reads {site.email}. Tell me the niche, the step that should
        stay manual, and what a person needs to see before anything is sent.
      </p>
      <div className="mt-10">
        <ContactForm />
      </div>
      <Disclaimer className="mt-8" />
    </main>
  );
}
