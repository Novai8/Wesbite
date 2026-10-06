import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Circle, ShieldCheck, Sparkles } from "lucide-react";
import { CursorField } from "@/components/cursor-field";
import { DemoCard } from "@/components/demo-card";
import { ProblemConsole } from "@/components/problem-console";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { demos } from "@/data/demos";
import { site } from "@/lib/site";

const problems = [
  ["01", "Missed calls", "A caller reaches the business when nobody is available. The next step should not depend on memory."],
  ["02", "Quotes go cold", "A quote is sent, then follow-up sits in someone's head or disappears into an inbox."],
  ["03", "Leads get lost", "An enquiry is copied between email, a sheet and a CRM until one field gets missed."],
  ["04", "Booking friction", "Scheduling becomes a chain of messages instead of a clear, reviewable process."],
  ["05", "Repeated questions", "The team keeps answering the same customer question while unusual cases wait."],
  ["06", "Admin overload", "The work is not hard. It is repetitive, scattered and too dependent on someone remembering it."],
];

const principles = [
  [ShieldCheck, "Controlled execution", "Sensitive steps can stop for a person. The prototype never pretends that confidence equals permission."],
  [Circle, "Visible evidence", "Inputs, decisions, failures and approvals stay visible instead of becoming silent background magic."],
  [Sparkles, "Outcome first", "The product starts with the business problem. AI is an implementation detail, not the headline."],
];

const featured = demos.slice(0, 4);

export default function HomePage() {
  return (
    <main id="content">
      <section className="hero-section">
        <CursorField />
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="hero-orbit hero-orbit-a" aria-hidden />
        <div className="hero-orbit hero-orbit-b" aria-hidden />
        <div className="container-page hero-layout">
          <div className="hero-copy">
            <div className="eyebrow-pill"><span className="status-dot" aria-hidden /> Problem-first AI operations</div>
            <h1>What keeps<br /><span className="serif-accent">falling through</span><br />the cracks?</h1>
            <p className="hero-lede">
              Describe the repetitive work your team keeps fighting. Rapigents maps the problem into an executable operation, shows the flow, and keeps high-impact actions behind human review.
            </p>
            <div className="hero-actions">
              <Button asChild className="hero-primary"><Link href="#analyze">Describe the problem <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
              <Button asChild variant="secondary" className="hero-secondary"><Link href="/demos">See workflow demos</Link></Button>
            </div>
            <div className="hero-trust"><span>Prototype-first</span><span>Human review</span><span>Audit-friendly</span><span>Fictional demo data</span></div>
          </div>
          <div id="analyze" className="hero-console-wrap"><ProblemConsole /></div>
        </div>
      </section>

      <section className="section-block problem-section">
        <div className="container-page">
          <Reveal>
            <div className="section-heading">
              <div><span className="section-number">01 / BUSINESS PROBLEMS</span><h2>Start with the leak, not the AI.</h2></div>
              <p>The owner usually knows the pain already. The useful part is turning that sentence into a process that can be inspected.</p>
            </div>
          </Reveal>
          <div className="problem-grid">
            {problems.map(([number, title, body], index) => (
              <Reveal key={number} delay={index * .03}>
                <article className="problem-card"><span className="problem-number">{number}</span><h3>{title}</h3><p>{body}</p><span className="card-arrow" aria-hidden>↗</span></article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block operation-section">
        <div className="container-page">
          <Reveal>
            <div className="split-heading">
              <div><span className="section-number">02 / HOW IT WORKS</span><h2>Describe work. See the operation.</h2></div>
              <p>No agent-builder setup maze. The first version is a clear map of what should happen and where a person stays responsible.</p>
            </div>
          </Reveal>
          <div className="operation-story">
            <div className="story-card story-card-dark">
              <div className="story-label">01 · Explain</div>
              <div className="story-big-quote">“Every new enquiry gets copied into a spreadsheet and some never get followed up.”</div>
              <div className="story-meta"><span>Business owner input</span><span>Unstructured</span></div>
            </div>
            <div className="story-card story-card-light">
              <div className="story-label">02 · Map</div>
              <div className="mini-flow"><div>Enquiry arrives</div><ChevronRight aria-hidden /><div>Extract</div><ChevronRight aria-hidden /><div>Validate</div><ChevronRight aria-hidden /><div>Route</div></div>
              <div className="story-divider" />
              <div className="approval-row"><span className="approval-badge">HUMAN CHECK</span><span>Approval before external action</span></div>
            </div>
            <div className="story-card story-card-accent">
              <div className="story-label">03 · Execute</div>
              <div className="execute-list"><div><Check aria-hidden /> Lead record created</div><div><Check aria-hidden /> Next step drafted</div><div><Check aria-hidden /> Escalation visible</div><div><Check aria-hidden /> Run logged</div></div>
              <div className="story-meta"><span>Connected systems later</span><span>Prototype now</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-block principles-section">
        <div className="container-page">
          <Reveal>
            <div className="section-heading compact">
              <div><span className="section-number">03 / PRODUCT PRINCIPLES</span><h2>Not another AI wrapper.</h2></div>
              <p>The model is replaceable. Reliable execution, clear boundaries and a useful customer experience are not.</p>
            </div>
          </Reveal>
          <div className="principle-grid">
            {principles.map(([Icon, title, body], index) => {
              const Comp = Icon as typeof ShieldCheck;
              return <Reveal key={title as string} delay={index * .05}><article className="principle-card"><div className="principle-icon"><Comp className="h-5 w-5" aria-hidden /></div><span className="principle-index">{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></article></Reveal>;
            })}
          </div>
        </div>
      </section>

      <section className="section-block demos-section">
        <div className="container-page">
          <Reveal>
            <div className="section-heading">
              <div><span className="section-number">04 / PROOF</span><h2>Working patterns, not promises.</h2></div>
              <Button asChild variant="secondary" size="sm"><Link href="/demos">Browse all demos <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
            </div>
          </Reveal>
          <div className="card-grid mt-8 grid gap-4 sm:grid-cols-2">
            {featured.map((demo, index) => <Reveal key={demo.slug} delay={index * .04}><DemoCard demo={demo} href={"/demos/" + demo.slug} /></Reveal>)}
          </div>
          <p className="demo-disclaimer">Demonstrations use fictional data and illustrative assumptions. They are portfolio prototypes, not client case studies.</p>
        </div>
      </section>

      <section className="final-cta">
        <div className="container-page">
          <Reveal>
            <div className="cta-panel">
              <div><span className="section-number">05 / NEXT</span><h2>Bring us the messy part.</h2><p>The task you keep postponing, the lead you keep losing, the inbox nobody owns. Start there.</p></div>
              <div className="cta-actions"><Button asChild className="hero-primary"><Link href="/contact">Describe the problem</Link></Button><a href={"mailto:" + site.email} className="cta-email">{site.email}</a></div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
