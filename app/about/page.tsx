import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Eye, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How Rapigents turns a business problem into a visible, reviewable AI operation.",
};

const principles = [
  {
    icon: Eye,
    title: "Start with the real process",
    body: "The input is a sentence from the business owner, a screen recording, or an existing workflow. The goal is to understand what actually happens today.",
  },
  {
    icon: ShieldCheck,
    title: "Make decisions visible",
    body: "The operation should show what it reads, what it decides, what it can do, and where a person has to approve or take over.",
  },
  {
    icon: Check,
    title: "Prove before connecting",
    body: "This site uses simulations and fictional data first. Live integrations come later, once the flow and boundaries are worth connecting.",
  },
];

export default function AboutPage() {
  return (
    <main id="content">
      <section className="page-hero">
        <div className="container-page">
          <div className="eyebrow-pill">How it works</div>
          <h1>We are not trying to build a smarter chatbot.</h1>
          <p>
            Rapigents is being developed around a simpler question: can messy business
            work become a clear operation that people can inspect, approve and improve?
          </p>
        </div>
      </section>

      <section className="section-block">
        <div className="container-page">
          <Reveal>
            <div className="section-heading">
              <div>
                <span className="section-number">01 / THE IDEA</span>
                <h2>The business problem is the interface.</h2>
              </div>
              <p>
                Customers should not need to know what an LLM, workflow engine or
                agent graph is doing behind the scenes.
              </p>
            </div>
          </Reveal>

          <div className="about-principles">
            {principles.map((item, index) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.title} delay={index * 0.05}>
                  <article className="about-principle">
                    <div className="principle-icon"><Icon className="h-5 w-5" aria-hidden /></div>
                    <span className="principle-index">{String(index + 1).padStart(2, "0")}</span>
                    <h2>{item.title}</h2>
                    <p>{item.body}</p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-block operation-section">
        <div className="container-page">
          <Reveal>
            <div className="section-heading compact">
              <div>
                <span className="section-number">02 / BOUNDARIES</span>
                <h2>Useful automation still needs boundaries.</h2>
              </div>
            </div>
          </Reveal>
          <div className="boundary-list">
            {[
              "A model suggestion is not automatically permission to send.",
              "A failed integration is shown as failed instead of silently skipped.",
              "Sensitive or high-impact actions can stop for human review.",
              "Prototype metrics are labelled as assumptions, not production results.",
              "Demo data is fictional and is never presented as a client case study.",
            ].map((item) => (
              <div key={item} className="boundary-item">
                <Check className="h-4 w-4" aria-hidden />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="container-page">
          <Reveal>
            <div className="cta-panel">
              <div>
                <span className="section-number">03 / NEXT</span>
                <h2>Bring the problem, not the buzzwords.</h2>
                <p>
                  {site.owner} is building the prototype around real operational pain,
                  then connecting systems once the operation makes sense.
                </p>
              </div>
              <Button asChild className="hero-primary">
                <Link href="/contact">
                  Describe the problem
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
