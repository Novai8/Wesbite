import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { InteractionLayer } from "@/components/interaction-layer";
import { site } from "@/lib/site";
import "./globals.css";
import "./experience.css";

const instrument=localFont({src:[{path:"../fonts/InstrumentSerif-Regular.ttf",weight:"400"},{path:"../fonts/InstrumentSerif-Italic.ttf",weight:"400",style:"italic"}],variable:"--font-instrument",display:"swap"});

export const metadata:Metadata={metadataBase:new URL(site.url),title:{default:site.title,template:"%s | Rapigents"},description:site.description,applicationName:site.name,keywords:["free AI tools","online AI tools","AI productivity tools","AI image analyzer","image checker AI","AI video summarizer","audio transcription AI","AI writing assistant","AI research tools","video clipper","YouTube Shorts maker","Reels captions","AI content tools","browser utilities","Rapigents"],authors:[{name:site.owner,url:site.github}],creator:site.owner,alternates:{canonical:site.url},openGraph:{type:"website",siteName:site.name,title:site.title,description:site.description,url:site.url,images:[{url:"/brand/og.png",width:1200,height:630,alt:"Rapigents AI Tools"}]},twitter:{card:"summary_large_image",title:site.title,description:site.description,images:["/brand/og.png"]}};
export const viewport:Viewport={themeColor:"#080a0b",colorScheme:"light dark",width:"device-width",initialScale:1};

const themeBoot='try{const t=localStorage.getItem("rapigents-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}';
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${instrument.variable} h-full antialiased`}><head><script dangerouslySetInnerHTML={{__html:themeBoot}}/></head><body><Providers><InteractionLayer/><div className="sunline-progress" aria-hidden="true"/><a href="#content" className="skip-link">Skip to content</a><SiteHeader/>{children}<SiteFooter/></Providers></body></html>;}
