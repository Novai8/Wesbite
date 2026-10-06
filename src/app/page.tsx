import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck, MousePointer2, ScanLine, Workflow } from "lucide-react";
import { HorizonSignals } from "@/components/horizon-signals";
import { OceanEnvironment } from "@/components/ocean-environment";
import { OperationLab } from "@/components/operation-lab";

export const metadata: Metadata = {
  title: "Business problems, turned into operations",
  description: "Rapigents turns messy repetitive business work into clear, reviewable operations.",
};

const signals = [["MISSED","ENQUIRIES"],["COLD","QUOTES"],["LOST","LEADS"],["BOOKING","FRICTION"],["REPEATED","QUESTIONS"],["ADMIN","DRAG"]];
const principles = [
  { icon: ScanLine, title: "See the hidden sequence", text: "Turn a vague complaint into triggers, decisions, handoffs and stopping points." },
  { icon: Workflow, title: "Make the machine legible", text: "Every meaningful step has a visible reason. No mystery button pretending to be a strategy." },
  { icon: CircleCheck, title: "Keep the human in charge", text: "High-impact actions can pause for approval. Automation is useful. Unsupervised chaos is just faster chaos." },
];

export default function HomePage() {
  return <main id="content">
    <section className="sea-hero">
      <OceanEnvironment/>
      <div className="container-page sea-copy">
        <div className="micro-label"><span className="sun-dot" aria-hidden/> RAPIGENTS / WORK, MADE VISIBLE</div>
        <h1>Make the work<br/><em>stop disappearing.</em></h1>
        <p className="hero-lede">Every business has work that gets buried between the message, the decision and the next action. Rapigents turns that invisible work into a clear operation.</p>
        <div className="sea-actions"><Link href="/contact" className="sea-btn sea-btn-primary"><span>Describe the leak</span></Link><Link href="/demos" className="sea-btn"><span>Explore the patterns</span></Link></div>
      </div>
      <div data-horizon className="sea-horizon" aria-hidden/>
      <HorizonSignals/>
    </section>
    <section className="signal-strip"><div className="signal-track">{[...signals,...signals].map(([a,b],i)=><span key={i}><b>{a}</b> {b} <i>✦</i></span>)}</div></section>
    <section className="lab-section"><div className="container-page"><div className="section-intro"><div><span className="section-kicker">01 / TRY THE IDEA</span><h2>Bring the messy sentence.</h2></div><p>You do not need an automation diagram. You need to explain what keeps going wrong. The prototype does the diagramming part.</p></div><OperationLab/></div></section>
    <section className="section-dark"><div className="container-page"><div className="section-intro light"><div><span className="section-kicker">02 / THE DIFFERENCE</span><h2>Not an agent builder. A work decoder.</h2></div><p>The interesting part is not generating another chat window. It is discovering the operational shape underneath a real business problem.</p></div><div className="principle-grid">{principles.map(({icon:Icon,title,text},i)=><article className="principle-tile" key={title}><div className="principle-top"><span>0{i+1}</span><Icon aria-hidden/></div><h3>{title}</h3><p>{text}</p></article>)}</div><div className="dark-quote"><span>THE PROMISE</span><p>“Bring the problem. Leave with a clearer operation.”</p></div></div></section>
    <section className="section-block pattern-section"><div className="container-page"><div className="pattern-head"><div><span className="section-kicker">03 / REAL PATTERNS</span><h2>Small leaks. Repeatable fixes.</h2></div><Link href="/demos" className="text-button">See the library <ArrowRight aria-hidden/></Link></div><div className="pattern-grid">{[["01","Missed enquiry","Capture → qualify → draft → review"],["02","Quote follow-up","Detect → wait → nudge → escalate"],["03","Lead admin","Extract → validate → record → flag"],["04","Appointment request","Parse → propose → check → confirm"]].map(([n,t,f])=><Link href="/demos" key={n} className="pattern-card"><span>{n}</span><h3>{t}</h3><p>{f}</p><ArrowRight aria-hidden/></Link>)}</div></div></section>
    <section className="closing-section"><div className="container-page closing-inner"><MousePointer2 aria-hidden/><div><span className="section-kicker">04 / NEXT MOVE</span><h2>Stop explaining the software.</h2><p>Tell us where the work leaks. We will start there.</p></div><Link href="/contact" className="magnetic-button magnetic-button-light">Describe the leak <ArrowRight aria-hidden/></Link></div></section>
  </main>;
}
