"use client";

import Link from "next/link";
import { Menu, Moon, Volume2, VolumeX, Sun, X } from "lucide-react";
import { useState } from "react";
import { usePrefs } from "@/components/providers";
import { site } from "@/lib/site";

const links = [{href:"/demos",label:"Patterns"},{href:"/about",label:"Method"},{href:"/reviews",label:"Reviews"}];

export function SiteHeader(){
  const {sound,toggleSound,theme,toggleTheme}=usePrefs();
  const [open,setOpen]=useState(false);
  return <header className="site-header"><div className="container-page header-inner">
    <Link href="/" className="brand" aria-label="Rapigents home"><span className="brand-mark">R/</span><span>{site.name}</span></Link>
    <nav className="desktop-nav" aria-label="Primary">{links.map(link=><Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
    <div className="header-actions">
      <button type="button" className="icon-button" onClick={toggleTheme} aria-label={theme==="dark"?"Switch to light theme":"Switch to dark theme"}>{theme==="dark"?<Moon aria-hidden/>:<Sun aria-hidden/>}</button>
      <button type="button" className={"sound-button"+(sound?" is-on":"")} onClick={toggleSound} aria-pressed={sound} aria-label={sound?"Turn soft sound effects off":"Turn soft sound effects on"}><span>{sound?"SFX ON":"SFX OFF"}</span>{sound?<Volume2 aria-hidden/>:<VolumeX aria-hidden/>}</button>
      <Link href="/contact" className="header-cta">Start with a problem</Link>
      <button type="button" className="mobile-menu-button" onClick={()=>setOpen(!open)} aria-label={open?"Close menu":"Open menu"} aria-expanded={open}>{open?<X aria-hidden/>:<Menu aria-hidden/>}</button>
    </div>
  </div>{open?<div className="mobile-menu"><nav aria-label="Mobile navigation">{links.map(link=><Link key={link.href} href={link.href} onClick={()=>setOpen(false)}>{link.label}</Link>)}<Link href="/contact" onClick={()=>setOpen(false)} className="mobile-menu-cta">Describe the leak</Link></nav></div>:null}</header>;
}