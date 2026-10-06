"use client";
import { useEffect, useState } from "react";

export function IntroLoader(){
 const [visible,setVisible]=useState(true);
 const [progress,setProgress]=useState(0);
 useEffect(()=>{let start=performance.now();let raf=0;const tick=(now:number)=>{const p=Math.min(100,Math.round(((now-start)/1400)*100));setProgress(p);if(p<100)raf=requestAnimationFrame(tick);else setTimeout(()=>setVisible(false),220)};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[]);
 if(!visible)return null;
 return <div className="intro-loader" aria-label="Loading Rapigents" role="status"><div className="loader-orbit loader-orbit-a"/><div className="loader-orbit loader-orbit-b"/><div className="loader-center"><span className="loader-r">R</span><span className="loader-name">RAPIGENTS</span></div><div className="loader-bottom"><span>INITIALIZING / WORK MAP</span><strong>{progress}%</strong></div></div>;
}