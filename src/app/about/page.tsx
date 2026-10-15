import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Blocks, MousePointer2, Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "How it works", description: "How to use Rapigents AI tools and browser utilities." };

const steps = [
  { icon: MousePointer2, title: "Choose a tool", text: "Find a utility for the task you need to finish, from writing and research to data cleanup." },
  { icon: Blocks, title: "Add your context", text: "Give the tool the text, details, or data it needs. Browser-based utilities run locally in your browser." },
  { icon: Sparkles, title: "Use the result", text: "Review the output, refine it, then copy what you need. You stay in control of what gets shared or sent." },
];

export default function AboutPage() {
  return <main id="content"><section className="page-hero-clean"><div className="container-page"><span className="section-kicker">A TOOLKIT BUILT AROUND TASKS</span><h1>Less hunting. More doing.</h1><p>Rapigents brings practical AI helpers and simple browser utilities into one clear workspace, so small tasks take fewer steps.</p></div></section><section className="section-block"><div className="container-page"><div className="method-grid">{steps.map(({ icon: Icon, title, text }, index) => <article className="method-card rg-how-card" key={title}><span>{String(index + 1).padStart(2, "0")}</span><Icon aria-hidden/><h2>{title}</h2><p>{text}</p></article>)}</div></div></section><section className="section-dark"><div className="container-page"><div className="method-statement"><span className="section-kicker">READY WHEN YOU ARE</span><h2>Your next useful tool is a click away.</h2><p>Search the library, open a tool, and get straight to the task.</p><Link href="/tools" className="magnetic-button magnetic-button-light">Explore AI tools <ArrowRight aria-hidden/></Link></div></div></section></main>;
}
