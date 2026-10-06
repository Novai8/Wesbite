import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/lib/site";
import "./globals.css";

const instrument=localFont({src:[{path:"../fonts/InstrumentSerif-Regular.ttf",weight:"400"},{path:"../fonts/InstrumentSerif-Italic.ttf",weight:"400",style:"italic"}],variable:"--font-instrument",display:"swap"});

export const metadata:Metadata={metadataBase:new URL(site.url),title:{default:site.title,template:"%s | Rapigents"},description:site.description,applicationName:site.name,keywords:["business operations","workflow design","business process automation","missed enquiries","quote follow-up","lead operations","AI operations","Rapigents"],authors:[{name:site.owner,url:site.github}],creator:site.owner,alternates:{canonical:site.url},icons:{icon:"/brand/rapigents-title-logo.svg"}};
export const viewport:Viewport={themeColor:"#f3f0e8",colorScheme:"light dark",width:"device-width",initialScale:1};

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${instrument.variable} h-full antialiased`}><body><Providers><a href="#content" className="skip-link">Skip to content</a><SiteHeader/>{children}<SiteFooter/></Providers></body></html>;}
