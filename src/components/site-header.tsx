"use client";
import { useState } from "react";
import { Menu, Moon, Volume2, VolumeX, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePrefs } from "@/components/providers";
import { site } from "@/lib/site";

const links=[{href:"/demos",label:"Patterns"},{href:"/about",label:"Method"},{href:"/reviews",label:"Reviews"}];
export function SiteHeader(){const{sound,toggleSound,theme,toggleTheme}=usePrefs();const[open,setOpen]=useState(false);return <header className="site-header"><div className="container-page header-inner">
<Link href="/" className="brand" aria-label="Rapigents home"><span className="brand-mark" aria-hidden><i>R</i><b>↗</b></span><span>RAPIGENTS</span></Link>
<nav className="desktop-nav">{links.map(l=><Link key={l.href} href={l.href}>{l.label}</Link>)}</nav>
<div className="header-actions"><button className="icon-button" onClick={toggleTheme} aria-label="Change visual mode">{theme==="dark"?<Moon/>:<Sun/>}</button><button className={"sound-button"+(sound?" is-on":"")} onClick={toggleSound} aria-pressed={sound}>{sound?<Volume2/>:<VolumeX/>}<span>{sound?"SFX":"SILENT"}</span></button><Link href="/contact" className="header-cta">Start a process</Link><button className="mobile-menu-button" onClick={()=>setOpen(!open)} aria-expanded={open} aria-label={open?"Close menu":"Open menu"}>{open?<X/>:<Menu/>}</button></div></div>
{open&&<div className="mobile-menu"><nav>{links.map(l=><Link key={l.href} href={l.href} onClick={()=>setOpen(false)}>{l.label}</Link>)}<Link href="/contact" onClick={()=>setOpen(false)} className="mobile-menu-cta">Start a process</Link></nav></div>}</header>}