"use client";

import { useEffect, useRef } from "react";

type Ripple = { x: number; y: number; born: number };

export function OceanEnvironment() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, host = canvas?.parentElement;
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const step = coarse ? 6 : 3;
    const ripples: Ripple[] = [];
    let w=0,h=0,horizon=0,raf=0,running=false,inView=true,tick=0,sunX=.68,sunTarget=.68;
    let last={x:-999,y:-999};
    const rgba=(r:number,g:number,b:number,a:number)=>"rgba("+r+","+g+","+b+","+a.toFixed(3)+")";
    function draw(t:number){
      if(!w)return;
      const deep=document.documentElement.dataset.theme==="dark";
      const sky=ctx.createLinearGradient(0,0,0,horizon);
      if(deep){sky.addColorStop(0,"#071417");sky.addColorStop(.7,"#0B2527");sky.addColorStop(1,"#16484A")}
      else{sky.addColorStop(0,"#E9E3D2");sky.addColorStop(.65,"#DCE2D3");sky.addColorStop(1,"#C9D8CF")}
      ctx.fillStyle=sky;ctx.fillRect(0,0,w,horizon);
      const water=ctx.createLinearGradient(0,horizon,0,h);
      water.addColorStop(0,"#16484A");water.addColorStop(.35,"#0B2527");water.addColorStop(1,"#071417");
      ctx.fillStyle=water;ctx.fillRect(0,horizon,w,h-horizon);
      const sx=sunX*w,glow=ctx.createRadialGradient(sx,horizon,0,sx,horizon,Math.max(w,h)*.55);
      glow.addColorStop(0,deep?"rgba(243,217,154,.4)":"rgba(243,217,154,.6)");glow.addColorStop(.35,"rgba(231,185,94,.12)");glow.addColorStop(1,"rgba(231,185,94,0)");
      ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
      ctx.lineWidth=1;
      for(let i=1;i<=5;i++){const y0=horizon+Math.pow(i,1.7)*9;if(y0>h)break;ctx.beginPath();for(let x=0;x<=w;x+=24){const y=y0+Math.sin(x*.008+t*(.12+i*.03)+i)*(1+i*.9);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.strokeStyle="rgba(201,216,207,"+(.05+i*.008)+")";ctx.stroke()}
      const depth=Math.max(1,h-horizon);
      for(let y=horizon+2;y<h;y+=step){const d=(y-horizon)/depth,spread=14+d*Math.min(w*.18,220);for(let k=0;k<3;k++){const off=Math.sin(y*.045+t*(.5+k*.17)+k*2.1)*spread*.5+Math.sin(y*.013+t*.21+k)*spread*.35;const len=spread*(.25+.5*Math.abs(Math.sin(y*.09+t*.8+k*1.7)));const a=(1-d*.75)*(.16+.22*Math.abs(Math.sin(y*.21-t*.6+k)));ctx.fillStyle=rgba(243,217,154,a);ctx.fillRect(sx+off-len/2,y,len,step>3?2:1.5)}}
      for(let i=ripples.length-1;i>=0;i--){const r=ripples[i],age=t-r.born;if(age>2.2){ripples.splice(i,1);continue}const rad=age*58;ctx.beginPath();ctx.ellipse(r.x,r.y,rad,rad*.28,0,0,Math.PI*2);ctx.strokeStyle=rgba(243,217,154,(1-age/2.2)*.32);ctx.stroke()}
      const haze=ctx.createLinearGradient(0,horizon-70,0,horizon);haze.addColorStop(0,"rgba(247,245,237,0)");haze.addColorStop(1,deep?"rgba(247,245,237,.06)":"rgba(247,245,237,.22)");ctx.fillStyle=haze;ctx.fillRect(0,horizon-70,w,70);
      const line=ctx.createLinearGradient(0,0,w,0);line.addColorStop(0,"rgba(243,217,154,0)");line.addColorStop(Math.min(.98,Math.max(.02,sunX)),"rgba(243,217,154,.95)");line.addColorStop(1,"rgba(243,217,154,0)");ctx.fillStyle=line;ctx.fillRect(0,horizon-.5,w,1.5);
    }
    function measure(){const r=host.getBoundingClientRect();w=r.width;h=r.height;const dpr=Math.min(window.devicePixelRatio||1,coarse?1.5:2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);const hz=host.querySelector<HTMLElement>("[data-horizon]");horizon=hz?hz.getBoundingClientRect().top-r.top:h*.58;if(!running)draw(performance.now()/1000)}
    function frame(now:number){if(!inView||document.hidden){running=false;return}tick++;if(!coarse||tick%2===0){sunX+=(sunTarget-sunX)*.05;draw(now/1000)}raf=requestAnimationFrame(frame)}
    function start(){if(reduce||running||!inView||document.hidden)return;running=true;raf=requestAnimationFrame(frame)}
    function onMove(e:PointerEvent){if(reduce||e.pointerType==="touch")return;const r=host.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(y<0||y>h||x<0||x>w)return;sunTarget=.68+(x/w-.5)*.14;if(y>horizon&&Math.hypot(x-last.x,y-last.y)>70){last={x,y};ripples.push({x,y,born:performance.now()/1000});if(ripples.length>8)ripples.shift()}}
    const ro=new ResizeObserver(measure),io=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;if(inView)start()}),mo=new MutationObserver(()=>{if(!running)draw(performance.now()/1000)});
    ro.observe(host);io.observe(host);mo.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
    const onVisibility=()=>{if(!document.hidden)start()};window.addEventListener("pointermove",onMove,{passive:true});document.addEventListener("visibilitychange",onVisibility);measure();start();
    return()=>{cancelAnimationFrame(raf);ro.disconnect();io.disconnect();mo.disconnect();window.removeEventListener("pointermove",onMove);document.removeEventListener("visibilitychange",onVisibility)};
  },[]);
  return <canvas ref={ref} className="sea-canvas" aria-hidden="true"/>;
}
