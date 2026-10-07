import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, GitBranch, ShieldCheck } from "lucide-react";
import { HorizonSignals } from "@/components/horizon-signals";
import { OceanEnvironment } from "@/components/ocean-environment";
import { OperationLab } from "@/components/operation-lab";

export const metadata:Metadata={title:"Work, made visible",description:"Rapigents turns messy repetitive business work into clear, reviewable operations."};
const principles=[
{icon:Eye,title:"Find the leak",text:"Start with the part of the operation that keeps getting missed, delayed or repeated."},
{icon:GitBranch,title:"Expose the sequence",text:"Turn the complaint into triggers, decisions, handoffs, exceptions and outputs."},
{icon:ShieldCheck,title:"Automate with boundaries",text:"Let systems handle repeatable work while meaningful decisions remain visible and reviewable."}
];

export default function HomePage(){return <main id="content">
<section className="sea-hero"><OceanEnvironment/><div className="sea-vignette" aria-hidden="true"/><div className="container-page sea-copy">
<div className="micro-label"><span className="sun-dot" aria-hidden/> RAPIGENTS / WORK, MADE VISIBLE</div>
<h1>Make the work<br/><em>stop disappearing.</em></h1>
<p className="hero-lede">Every business has work that gets buried between the message, the decision and the next action. Rapigents turns that invisible work into a clear operation.</p>
<div className="sea-actions"><Link href="/contact" className="sea-btn sea-btn-primary">Describe the leak <ArrowRight aria-hidden/></Link><Link href="/demos" className="sea-btn">Explore the patterns <ArrowRight aria-hidden/></Link></div>
<div className="sea-proof"><span>PROBLEM → MAP</span><span>MAP → SIMULATION</span><span>SIMULATION → BUILD</span></div><div data-horizon className="sea-horizon" aria-hidden="true"/></div><HorizonSignals/></section>

<section className="section-block sea-transition"><div className="container-page"><div className="section-intro"><div><span className="section-kicker">01 / THE LEAK</span><h2>The problem is rarely “we need AI.”</h2></div><p>Usually, something is being missed, delayed, repeated or handed over badly. The useful question is what happens between the message and the result.</p></div><div className="sequence-river">{["MESSAGE","DECISION","HANDOFF","ACTION","RESULT"].map((name,i)=><article key={name} className="sequence-stage"><span>0{i+1}</span><strong>{name}</strong><p>{["An enquiry arrives.","Someone decides what it means.","Context moves between people.","The next step depends on memory.","The opportunity either moves or quietly expires."][i]}</p></article>)}</div></div></section>

<section className="lab-section" id="lab"><div className="container-page"><div className="section-intro"><div><span className="section-kicker">02 / OPERATION DECODER</span><h2>Bring the messy sentence.</h2></div><p>You do not need an automation diagram. Explain what keeps going wrong. The prototype does the mapping part.</p></div><OperationLab/></div></section>

<section className="section-dark ocean-dark-section"><div className="container-page"><div className="section-intro light"><div><span className="section-kicker">03 / THE DIFFERENCE</span><h2>Not an agent builder. A work decoder.</h2></div><p>The interesting part is discovering the operational shape underneath a real business problem, then building only what is justified.</p></div><div className="principle-grid">{principles.map(({icon:Icon,title,text},i)=><article className="principle-tile" key={title}><div className="principle-top"><span>0{i+1}</span><Icon aria-hidden/></div><h3>{title}</h3><p>{text}</p></article>)}</div><div className="dark-quote"><span>THE PROMISE</span><p>“Bring the problem. Leave with a clearer operation.”</p></div></div></section>

<section className="section-block pattern-section"><div className="container-page"><div className="pattern-head"><div><span className="section-kicker">04 / REAL PATTERNS</span><h2>Small leaks. Repeatable fixes.</h2></div><Link href="/demos" className="text-button">See the library <ArrowRight aria-hidden/></Link></div><div className="pattern-grid">{[["01","Missed enquiry","Capture → qualify → draft → review"],["02","Quote follow-up","Detect → wait → nudge → escalate"],["03","Lead admin","Extract → validate → record → flag"],["04","Appointment request","Parse → propose → check → confirm"]].map(([n,t,f])=><Link href="/demos" key={n} className="pattern-card"><span>{n}</span><h3>{t}</h3><p>{f}</p><ArrowRight aria-hidden/></Link>)}</div></div></section>

<section className="closing-section sea-closing"><div className="container-page closing-inner"><div><span className="section-kicker">05 / NEXT MOVE</span><h2>Stop explaining the software.</h2><p>Tell us where the work leaks. We will start there.</p></div><Link href="/contact" className="magnetic-button magnetic-button-light">Describe the leak <ArrowRight aria-hidden/></Link></div></section>
</main>;}
