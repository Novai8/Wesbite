import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { demos, getDemo, relatedDemos } from "@/data/demos";
import { toolLinks, workflowMailto } from "@/lib/site";

type Props={params:Promise<{slug:string}>};
export function generateStaticParams(){return demos.map(demo=>({slug:demo.slug}));}
export const dynamicParams=false;
export async function generateMetadata({params}:Props):Promise<Metadata>{const demo=getDemo((await params).slug);return demo?{title:demo.title,description:demo.shortProblem}:{title:"Pattern"};}

export default async function DemoDetailPage({params}:Props){
 const demo=getDemo((await params).slug); if(!demo)notFound(); const related=relatedDemos(demo.slug);
 return <main id="content"><section className="page-hero-clean detail-hero"><div className="container-page"><Link href="/demos" className="back-link"><ArrowLeft aria-hidden/> Pattern library</Link><span className="section-kicker">{demo.niche}</span><h1>{demo.title}</h1><p>{demo.shortProblem}</p><a className="magnetic-button magnetic-button-dark" href={workflowMailto(demo.title)}>Adapt this pattern <ArrowRight aria-hidden/></a></div></section>
 <section className="section-block"><div className="container-page detail-grid">
 <article className="detail-card"><span>01 / BEFORE</span><h2>The leak</h2><p>{demo.beforeSummary}</p></article>
 <article className="detail-card"><span>02 / AFTER</span><h2>The operation</h2><p>{demo.afterSummary}</p></article>
 <article className="detail-card"><span>03 / OUTPUT</span><h2>What the person receives</h2><ul>{demo.whatClientSees.map(item=><li key={item}><Check aria-hidden/>{item}</li>)}</ul></article>
 <article className="detail-card"><span>04 / CONTROL</span><h2>Where it can stop</h2><ul>{demo.reliability.map(item=><li key={item}><ShieldCheck aria-hidden/>{item}</li>)}</ul></article>
 <article className="detail-card detail-wide"><span>05 / BUILD NOTES</span><h2>Prototype stack</h2><div className="tool-pills">{demo.tools.map(tool=>toolLinks[tool]?<a key={tool} href={toolLinks[tool]} target="_blank" rel="noopener noreferrer">{tool}</a>:<span key={tool}>{tool}</span>)}</div><p className="assumption-note">Illustrative assumption: {demo.assumptions.weeklyVolume} {demo.assumptions.unit} / week. This is not measured client performance.</p></article>
 </div></section>
 {related.length?<section className="section-block related-section"><div className="container-page"><span className="section-kicker">MORE PATTERNS</span><div className="pattern-grid">{related.map(item=><Link key={item.slug} href={"/demos/"+item.slug} className="pattern-card"><span>→</span><h3>{item.title}</h3><p>{item.shortProblem}</p></Link>)}</div></div></section>:null}
 </main>;
}