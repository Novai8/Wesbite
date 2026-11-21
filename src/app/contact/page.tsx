import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contact the ${site.name} team at ${site.email}.`,
};

export default function ContactPage() {
  return (
    <div className="container-page py-12 md:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Contact</p>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">Get in touch</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Questions about a recommendation, a correction to product data, a
          partnership or a press enquiry — email us and we&apos;ll get back to you.
        </p>
      </div>

      <div className="panel mt-10 max-w-xl">
        <p className="field-label">Email</p>
        <a
          href={site.contactMailto}
          className="font-display text-2xl font-semibold text-cobalt-deep break-anywhere hover:underline"
        >
          {site.email}
        </a>

        <hr className="rule my-6" />

        <p className="text-sm leading-relaxed text-muted">
          Found a price or spec that doesn&apos;t match the merchant page? Send us
          the product link and a screenshot if you have one — data corrections
          get priority.
        </p>
      </div>
    </div>
  );
}
