import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms that apply when you use Fyndra.",
};

export default function TermsPage() {
  return (
    <div className="container-page max-w-3xl py-12 md:py-16">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">Terms of use</h1>
      <p className="mt-2 text-sm text-faint">Last updated: 20 November 2026</p>

      <div className="mt-8 space-y-8 leading-relaxed text-muted">
        <section>
          <h2 className="text-xl text-ink">What Fyndra is</h2>
          <p className="mt-2">
            {site.name} is a shopping discovery service. We recommend products
            from a curated catalogue and explain why. We are not the seller:
            purchases happen on the merchant&apos;s site under the merchant&apos;s terms,
            prices and availability.
          </p>
        </section>

        <section>
          <h2 className="text-xl text-ink">Accuracy and availability</h2>
          <p className="mt-2">
            We work hard to keep prices and specs current — every record
            carries a verification date, shown alongside the price. Merchants
            change prices without notice, so the price on the merchant&apos;s page
            at the time of purchase is the one that counts.
          </p>
        </section>

        <section>
          <h2 className="text-xl text-ink">Recommendations are not advice</h2>
          <p className="mt-2">
            Our scores and explanations are decision support, not professional
            or purchasing advice. You remain responsible for checking that a
            product suits your needs before buying.
          </p>
        </section>

        <section>
          <h2 className="text-xl text-ink">Acceptable use</h2>
          <p className="mt-2">
            Don&apos;t abuse the service: no automated bulk requests, no attempts to
            manipulate the engine or the click-tracking endpoints, no
            scraping the catalogue for reuse in competing services. We rate
            limit to keep the service available for everyone.
          </p>
        </section>

        <section>
          <h2 className="text-xl text-ink">Liability</h2>
          <p className="mt-2">
            The service is provided as-is. To the extent permitted by law, we
            aren&apos;t liable for losses arising from purchases made with merchants
            or from reliance on recommendations. Questions?{" "}
            <a href={site.contactMailto} className="text-cobalt-deep hover:underline">{site.email}</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
