"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import {
  AudioLines, ChartNoAxesCombined, CheckCircle2, Clapperboard, Code2,
  FileSearch, FileText, GraduationCap, Image, MessageCircle, ScanText,
  Search, Sparkles, WandSparkles, Workflow,
} from "lucide-react";
import type { ToolItem } from "@/data/tool-catalog";

function visualKind(tool: ToolItem) {
  const text = (tool.name + " " + tool.category).toLowerCase();
  if (/clip|video|shorts|subtitle|caption|storyboard|shot|thumbnail/.test(text)) return "timeline";
  if (/audio|podcast|voice|speech|pronunciation|transcri|sound|filler/.test(text)) return "wave";
  if (/image|photo|visual|logo|poster|background|upscal|restor|color palette/.test(text)) return "image";
  if (/pdf|document|invoice|receipt|resume|contract|handwritten|extract|redact|paper|citation|bibliography|report|proposal/.test(text)) return "document";
  if (/spreadsheet|csv|json|table|data|calculator|margin|percentage|inventory|analytics|survey|metric|chart/.test(text)) return "data";
  if (/code|api|sql|regex|webhook|database|workflow|automation|debug|test-case|developer|schema|html|css/.test(text)) return "nodes";
  if (/study|education|quiz|flashcard|tutor|exam|vocabulary|lecture|science|math|learning|scholarship/.test(text)) return "cards";
  if (/email|message|reply|chat|customer|support|social|post|writer|writing|essay|blog|copy|translation|paraphras|grammar|tone/.test(text)) return "writing";
  if (/search|research|competitor|seo|fact-check|audit|compare|review|analysis|analyzer/.test(text)) return "scan";
  return "flow";
}

const palettes: Record<string, string> = {
  "Business": "#d8ff63", "Writing & Research": "#c6b5ff", "Study & Education": "#72d7c0",
  "Creators & Social": "#ff9c82", "Image, Audio & Video": "#ff9c82", "Developer & Automation": "#8db4ff",
  "Ecommerce & Marketing": "#f4c76e", "Career & Freelancing": "#c6b5ff", "Personal Productivity": "#72d7c0",
  "Browser Utilities": "#d8ff63",
};

export function ToolLaunchVisual({ tool }: { tool: ToolItem }) {
  const kind = visualKind(tool);
  const accent = palettes[tool.category] || "#d8ff63";
  const Icon = kind === "timeline" ? Clapperboard : kind === "wave" ? AudioLines : kind === "image" ? Image : kind === "document" ? FileText : kind === "data" ? ChartNoAxesCombined : kind === "nodes" ? Workflow : kind === "cards" ? GraduationCap : kind === "writing" ? MessageCircle : kind === "scan" ? FileSearch : WandSparkles;
  const bars = Array.from({ length: kind === "wave" ? 27 : 13 }, (_, index) => index);
  return (
    <div className={"tool-motion-visual visual-" + kind} style={{ "--tool-accent": accent } as CSSProperties} aria-hidden="true">
      <div className="tool-motion-orbit orbit-one" /><div className="tool-motion-orbit orbit-two" />
      <div className="tool-motion-core"><Icon size={25} strokeWidth={1.5}/></div>
      {kind === "timeline" ? <>
        <div className="motion-preview-frame"><div className="motion-preview-sun"/><div className="motion-preview-horizon"/><span>00:{tool.id.length.toString().padStart(2,"0")}</span></div>
        <div className="motion-timeline"><div className="motion-track"><i/><i/><i/><i/></div><div className="motion-track secondary"><i/><i/><i/></div><motion.div className="motion-playhead" animate={{ x: [0, 150, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}/></div>
        <motion.div className="motion-caption-chip" animate={{ y: [0,-4,0], opacity: [.7,1,.7] }} transition={{ duration: 1.5, repeat: Infinity }}>CAPTIONS IN SYNC</motion.div>
      </> : kind === "wave" ? <>
        <div className="motion-waveform">{bars.map((bar) => <motion.i key={bar} animate={{ scaleY: [0.24, 0.45 + ((bar * 7) % 9) / 12, 0.24] }} transition={{ duration: .65 + (bar % 4) * .13, repeat: Infinity, delay: bar * .025, ease: "easeInOut" }}/>)}</div>
        <div className="motion-transcript"><motion.i animate={{ width: ["22%", "76%", "49%", "88%"] }} transition={{ duration: 3.4, repeat: Infinity }}/><motion.i animate={{ width: ["60%", "37%", "83%", "55%"] }} transition={{ duration: 3.1, repeat: Infinity }}/></div>
      </> : kind === "image" ? <>
        <div className="motion-image-frame"><motion.div className="motion-image-scan" animate={{ y: [-60, 60, -60] }} transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}/><div className="motion-image-mountain"/><div className="motion-image-dot"/></div>
        <motion.div className="motion-scan-corner" animate={{ scale: [1,.92,1] }} transition={{ duration: 1.8, repeat: Infinity }}/>
      </> : kind === "document" ? <>
        <div className="motion-doc-sheet"><i/><i/><i/><i/><i/><motion.div className="motion-doc-highlight" animate={{ y: [0,46,0] }} transition={{ duration: 2.3, repeat: Infinity }}/></div>
        <div className="motion-extract-chip"><ScanText size={12}/> EXTRACT <span><CheckCircle2 size={12}/></span></div>
      </> : kind === "data" ? <>
        <div className="motion-table">{Array.from({length:12},(_,i)=><motion.i key={i} animate={{ opacity: [.25, .9, .25] }} transition={{ duration: 1.7, repeat: Infinity, delay: i*.06 }}/>)}</div>
        <div className="motion-chart-bars">{bars.slice(0,8).map((bar)=><motion.i key={bar} animate={{ height: [16 + (bar%3)*7, 24 + ((bar*5)%7)*7, 16 + (bar%3)*7] }} transition={{ duration: 1.7, repeat: Infinity, delay: bar*.08 }}/>)}</div>
      </> : kind === "nodes" || kind === "flow" ? <>
        <svg className="motion-connectors" viewBox="0 0 300 150"><path d="M35 76 C80 76 68 32 112 32 S165 76 195 76 S235 112 265 112" fill="none" stroke="currentColor" strokeOpacity=".42" strokeDasharray="5 5"/></svg>
        <motion.div className="motion-node node-a" animate={{ y:[0,-5,0] }} transition={{ duration:2, repeat:Infinity }}><Code2 size={14}/></motion.div>
        <motion.div className="motion-node node-b" animate={{ y:[0,5,0] }} transition={{ duration:2.2, repeat:Infinity }}><Workflow size={14}/></motion.div>
        <motion.div className="motion-node node-c" animate={{ y:[0,-4,0] }} transition={{ duration:1.8, repeat:Infinity }}><CheckCircle2 size={14}/></motion.div>
        <motion.div className="motion-data-pulse" animate={{ offsetDistance:["0%","100%"] }} transition={{ duration:2.4, repeat:Infinity, ease:"linear" }}/>
      </> : kind === "cards" ? <>
        <motion.div className="motion-study-card card-a" animate={{ rotate: [-8,-4,-8], y:[0,-5,0] }} transition={{ duration:2.5, repeat:Infinity }}><span>Q</span><i/><i/></motion.div>
        <motion.div className="motion-study-card card-b" animate={{ rotate: [7,3,7], y:[0,4,0] }} transition={{ duration:2.1, repeat:Infinity }}><span>A</span><i/><i/><i/></motion.div>
      </> : kind === "writing" ? <>
        <div className="motion-writing-lines"><motion.i animate={{ width:["25%","92%","68%"] }} transition={{ duration:2.7, repeat:Infinity }}/><motion.i animate={{ width:["70%","42%","86%"] }} transition={{ duration:2.4, repeat:Infinity }}/><motion.i animate={{ width:["49%","78%","31%"] }} transition={{ duration:2.9, repeat:Infinity }}/><motion.i animate={{ width:["82%","58%","91%"] }} transition={{ duration:2.5, repeat:Infinity }}/></div>
        <motion.div className="motion-spark" animate={{ scale:[.7,1.15,.7], rotate:[0,45,0] }} transition={{ duration:2, repeat:Infinity }}><Sparkles size={17}/></motion.div>
      </> : <>
        <div className="motion-scan-ring"/><motion.div className="motion-scan-line" animate={{ y:[-42,42,-42] }} transition={{ duration:2.2, repeat:Infinity, ease:"easeInOut" }}/><div className="motion-scan-result"><Search size={13}/> MATCH FOUND</div>
      </>}
    </div>
  );
}
