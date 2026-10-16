"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clipboard, FileText, Paperclip, Sparkles, X } from "lucide-react";
import { browserToolIds, type ToolItem } from "@/data/tool-catalog";
import { localTransform } from "@/lib/local-tool-transform";
import { ToolLaunchVisual } from "@/components/tool-motion-visual";

function acceptsFor(tool: ToolItem) {
  const name = tool.name.toLowerCase();
  if (/image|photo|visual|thumbnail|handwritten|logo|poster|background removal|upscal|restoration/.test(name)) return "image/*";
  if (/audio|podcast|speech|voice|pronunciation|filler-word|transcri|sound-effect/.test(name)) return "audio/*,.mp3,.wav";
  if (/video|subtitle|shorts|scene|shot|clip|chapter/.test(name)) return "video/*";
  if (/pdf|document|invoice|receipt|resume|spreadsheet|file|contract|report|proposal|citation/.test(name)) return "application/pdf,image/*,.csv,.txt";
  return "image/*,audio/*,video/*,application/pdf,.mp3,.wav,.csv,.txt";
}
function needsAttachment(tool: ToolItem) {
  return /image|photo|visual|thumbnail|video|audio|podcast|speech|voice|pronunciation|transcri|pdf|document|invoice|receipt|handwritten|logo|poster|subtitle|resume|spreadsheet|file|contract|report|proposal|clip|shorts/i.test(tool.name);
}
function readFile(file: File) {
  return new Promise<string>((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read this file."));
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsDataURL(file);
  });
}

export function ToolDetailWorkbench({ tool }: { tool: ToolItem }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (!input.trim() && !file) { setError("Add a little context or attach a file to get started."); inputRef.current?.focus(); return; }
    if (file && file.size > 8 * 1024 * 1024) { setError("Keep each file under 8 MB for this version."); return; }
    setBusy(true); setError(""); setResult(""); setCopied(false);
    try {
      if (browserToolIds.has(tool.id)) {
        const local = localTransform(tool, input);
        if (local !== null) { setResult(local); return; }
      }
      const attachments = file ? [{ name: file.name, type: file.type || "application/octet-stream", data: await readFile(file) }] : [];
      const response = await fetch("/api/tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toolId: tool.id, input, attachments }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "This tool could not finish the request. Try again.");
      setResult(payload.result || "No result returned.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!result) return;
    try { await navigator.clipboard.writeText(result); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { setError("Clipboard access was blocked. Select the output and copy it manually."); }
  };

  return <main className="tool-detail-page" id="content">
    <div className="tool-detail-ambient" aria-hidden="true"/>
    <div className="tool-detail-shell">
      <nav className="tool-detail-nav"><Link href="/tools"><ArrowLeft size={15}/> ALL TOOLS</Link><span>RAPIGENTS LABS <i/> {tool.category.toUpperCase()}</span></nav>
      <section className="tool-detail-hero">
        <motion.div className="tool-detail-copy" initial={{opacity:0,y:18,filter:"blur(8px)"}} animate={{opacity:1,y:0,filter:"blur(0px)"}} transition={{duration:.7}}>
          <span className="tool-detail-kicker"><span/> {tool.kind === "browser" ? "BROWSER TOOL / PRIVATE BY DESIGN" : "AI WORKSPACE / TASK-SPECIFIC"}</span>
          <h1>{tool.name}</h1>
          <p>{tool.description} Give it the context it needs, then review the result before using it.</p>
          <div className="tool-detail-tags"><span>{tool.category}</span><span>{tool.kind === "browser" ? "Runs locally" : "AI-assisted"}</span><span>One focused task</span></div>
        </motion.div>
        <motion.div className="tool-detail-visual" initial={{opacity:0,scale:.94}} animate={{opacity:1,scale:1}} transition={{duration:.8,delay:.1}}><ToolLaunchVisual tool={tool}/><div className="tool-detail-visual-label"><span>WORKFLOW PREVIEW</span><span>READY TO PERSONALIZE</span></div></motion.div>
      </section>
      <section className="tool-detail-workspace">
        <div className="tool-detail-workspace-head"><div><span>01 / INPUT</span><h2>Give the task some context.</h2></div><span className="tool-detail-status"><i/> READY</span></div>
        <label className="tool-detail-input-label" htmlFor="tool-detail-input">YOUR INPUT</label>
        <textarea id="tool-detail-input" ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} placeholder={tool.kind === "browser" ? "Paste text or data here…" : "Describe what you need, add relevant details, or paste the source text…"} rows={7}/>
        {needsAttachment(tool) && <div className="tool-detail-attach-row"><input ref={fileRef} type="file" accept={acceptsFor(tool)} onChange={e=>{setFile(e.target.files?.[0] || null);setError("");}} hidden/><button type="button" className="tool-detail-attach" onClick={()=>fileRef.current?.click()}><Paperclip size={15}/> {file ? "Replace attachment" : "Attach a file"}</button><span>Up to 8 MB · match the file type to your task</span>{file && <span className="tool-detail-file"><FileText size={13}/>{file.name}<button type="button" aria-label="Remove attachment" onClick={()=>{setFile(null);if(fileRef.current)fileRef.current.value="";}}><X size={13}/></button></span>}</div>}
        {error && <p className="tool-detail-error" role="alert">{error}</p>}
        <div className="tool-detail-actions"><button type="button" onClick={run} disabled={busy}>{busy ? "Working through the task…" : <>Run {tool.name} <ArrowRight size={15}/></>}</button><button type="button" className="tool-detail-clear" onClick={()=>{setInput("");setFile(null);setResult("");setError("");if(fileRef.current)fileRef.current.value="";}}>Clear</button><span><Sparkles size={13}/> Review AI output before relying on it.</span></div>
        <AnimatePresence>
          {busy && <motion.div className="tool-detail-processing" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} role="status" aria-live="polite"><div><ToolLaunchVisual tool={tool}/><strong>{tool.name}</strong><span>Working through your input…</span><div className="tool-detail-progress"><motion.i animate={{x:["-100%","250%"]}} transition={{duration:1.35,repeat:Infinity,ease:"easeInOut"}}/></div></div></motion.div>}
        </AnimatePresence>
        {result && <motion.section className="tool-detail-result" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}><div className="tool-detail-result-head"><div><span>02 / OUTPUT</span><h2>Ready for review.</h2></div><button type="button" onClick={copy}>{copied?<Check size={14}/>:<Clipboard size={14}/>} {copied?"Copied":"Copy result"}</button></div><pre>{result}</pre><div className="tool-detail-result-foot"><span><Check size={13}/> Result generated</span><button type="button" onClick={()=>{setInput(result);setResult("");inputRef.current?.focus();}}>Use as new input ↗</button></div></motion.section>}
      </section>
      <footer className="tool-detail-foot"><span>RAPIGENTS / {tool.category.toUpperCase()}</span><Link href="/tools">Explore another tool <ArrowRight size={14}/></Link></footer>
    </div>
  </main>;
}
