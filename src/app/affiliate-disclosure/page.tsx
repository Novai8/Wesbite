import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Affiliate disclosure",
  description: "How affiliate links work on Fyndra and how they never affect recommendations.",
};

export default function AffiliateDisclosurePage() {
  return (
    <div className="container-page max-w-3xl py-12 md:py-16">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">Affiliate disclosure</h1>

      <div className="mt-8 space-y-8 leading-relaxed text-muted">
        <section className="panel-warm">
          <p className="text-base text-ink">
            Some links on {site.name} are affiliate links. If you click one and
            buy something, we may earn a commission from the merchant or their
            affiliate network. You never pay more because of it — the price is
            identical either way.
          </p>
        </section>

        <section>
          <h2 className="text-xl text-ink">How we mark links</h2>
          <p className="mt-2">
            Every outbound purchase link is labelled, typically with
            “Affiliate” next to or inside the button. Links are marked before
            you click, not after — you always know where a commission exists.
          </p>
        </section>

        <section>
          <h2 className="text-xl text-ink">What commissions don&apos;t do</h2>
          <p className="mt-2">
            Commissions never influence scores, rankings, or the wording of a
            recommendation. The scoring engine doesn&apos;t know commission rates
            and doesn&apos;t use them as an input. A product paying more isn&apos;t
            ranked higher — relevance, budget fit, features and data quality
            decide the order.
          </p>
        </section>

        <section>
          <h2 className="text-xl text-ink">How clicks are handled</h2>
          <p className="mt-2">
            Outbound links pass through a validation and redirect endpoint
            that checks the destination against the approved affiliate
            programme before forwarding you. Click events record only the
            product, programme and time — never your IP address, user agent,
            or any identifier that could single you out.
          </p>
        </section>

        <section>
          <h2 className="text-xl text-ink">Commission figures</h2>
          <p className="mt-2">
            We don&apos;t publish commission rates. Actual rates vary by programme
            and category and are visible only in the merchant&apos;s own reporting.
            Any figure we quoted here would go stale — so we don&apos;t quote any.
          </p>
        </section>

        <section>
          <h2 className="text-xl text-ink">Questions</h2>
          <p className="mt-2">
            Write to{" "}
            <a href={site.contactMailto} className="text-cobalt-deep hover:underline">{site.email}</a>{" "}
            with any question about how affiliate links work here.
          </p>
        </section>
      </div>
    </div>
  );
}
