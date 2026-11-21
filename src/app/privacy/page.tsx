import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Fyndra collects, what it doesn't, and how affiliate clicks are recorded.",
};

export default function PrivacyPage() {
  return (
    <div className="container-page max-w-3xl py-12 md:py-16">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">Privacy</h1>
      <p className="mt-2 text-sm text-faint">Last updated: 20 November 2026</p>

      <div className="mt-8 space-y-8 leading-relaxed text-muted">
        <section>
          <h2 className="text-xl text-ink">What we collect</h2>
          <p className="mt-2">
            When you use the assistant, setup builder or problem solver, we
            process what you type — your described goal, budget, and
            preferences — to generate recommendations. We record anonymised,
            aggregate statistics about which recommendations are shown and
            clicked so we can improve the engine.
          </p>
        </section>

        <section>
          <h2 className="text-xl text-ink">What we don&apos;t collect</h2>
          <p className="mt-2">
            We don&apos;t require accounts, don&apos;t set advertising cookies, and
            don&apos;t build profiles around you. Affiliate click events are
            deliberately non-identifying: they record the product and
            programme, not your IP address, user agent, or any session
            identifier.
          </p>
        </section>

        <section>
          <h2 className="text-xl text-ink">Affiliate redirects</h2>
          <p className="mt-2">
            Outbound affiliate clicks pass through our own redirect endpoint,
            which forwards you to the merchant with referrer information
            suppressed. The merchant you land on has its own privacy policy,
            which applies once you&apos;re there.
          </p>
        </section>

        <section>
          <h2 className="text-xl text-ink">Contacting us</h2>
          <p className="mt-2">
            If you email us, we keep your message only as long as needed to
            deal with it. Write to{" "}
            <a href={site.contactMailto} className="text-cobalt-deep hover:underline">{site.email}</a>{" "}
            for any privacy question.
          </p>
        </section>
      </div>
    </div>
  );
}
