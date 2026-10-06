"use client";
import { useEffect, useState } from "react";

export function CursorField(){
 const [p,setP]=useState({x:-100,y:-100}); const [hover,setHover]=useState(false);
 useEffect(()=>{const move=(e:MouseEvent)=>setP({x:e.clientX,y:e.clientY});const over=(e:MouseEvent)=>setHover(!!(e.target as HTMLElement)?.closest("a,button,.scenario-button,.pattern-card,.principle-tile"));window.addEventListener("mousemove",move);document.addEventListener("mouseover",over);return()=>{window.removeEventListener("mousemove",move);document.removeEventListener("mouseover",over)}},[]);
 return <div className={"cursor-field"+(hover?" is-hover":"")} style={{transform:`translate3d(${p.x}px,${p.y}px,0)`}} aria-hidden><span/><b/></div>;
}