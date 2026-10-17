"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, AudioLines, Check, ChevronDown,
  CircleHelp, Clock3, Code2, Copy, FileText, LoaderCircle,
  Search, Sparkles, WandSparkles, X, Zap, Paperclip, FileAudio, FileImage, FileVideo,
} from "lucide-react";
import { browserToolIds, toolCatalog, type ToolItem } from "@/data/tool-catalog";
import { localTransform } from "@/lib/local-tool-transform";
import { ToolLaunchVisual } from "@/components/tool-motion-visual";

const categories = ["All tools", ...Array.from(new Set(toolCatalog.map((tool) => tool.category)))];

function supportsAttachments(tool: ToolItem) {
  return /image|photo|visual|thumbnail|video|audio|podcast|speech|voice|pronunciation|transcri|pdf|document|invoice|receipt|handwritten|logo|poster|subtitle|resume|spreadsheet|file/i.test(tool.name);
}
function attachmentAccept(tool: ToolItem) {
  const name = tool.name.toLowerCase();
  if (/image|photo|visual|thumbnail|handwritten|logo|poster/.test(name)) return "image/*";
  if (/audio|podcast|speech|voice|pronunciation|filler-word|transcri/.test(name)) return "audio/mpeg,audio/wav,.mp3,.wav";
  if (/video|subtitle|shorts|scene|shot/.test(name)) return "video/*";
  if (/pdf|document|invoice|receipt|resume|spreadsheet|file/.test(name)) return "application/pdf,image/*,audio/*,video/*";
  return "image/*,audio/mpeg,audio/wav,video/*,application/pdf,.mp3,.wav";
}
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the attachment."));
    reader.onerror = () => reject(new Error("Could not read the attachment."));
    reader.readAsDataURL(file);
  });
}

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const points: Array<{ x: number; y: number; vx: number; vy: number; r: number; phase: number }> = [];
    const pointer = { x: -1000, y: -1000 };
    let width = 0;
    let height = 0;
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      points.length = 0;
      const count = Math.min(74, Math.floor((width * height) / 17000));
      for (let i = 0; i < count; i += 1) {
        points.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.24,
          vy: (Math.random() - 0.5) * 0.24,
          r: Math.random() * 1.5 + 0.4,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };
    const onLeave = () => { pointer.x = -1000; pointer.y = -1000; };
    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerleave", onLeave);

    const draw = () => {
      context.clearRect(0, 0, width, height);
      points.forEach((point, index) => {
        if (!reduceMotion) {
          point.x += point.vx;
          point.y += point.vy;
          if (point.x < -5 || point.x > width + 5) point.vx *= -1;
          if (point.y < -5 || point.y > height + 5) point.vy *= -1;
          const dx = point.x - pointer.x;
          const dy = point.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 120 && distance > 0) {
            point.x += (dx / distance) * 0.38;
            point.y += (dy / distance) * 0.38;
          }
          point.phase += 0.012;
        }
        const alpha = 0.22 + (Math.sin(point.phase) + 1) * 0.17;
        context.beginPath();
        context.arc(point.x, point.y, point.r, 0, Math.PI * 2);
        context.fillStyle = "rgba(173, 190, 255," + alpha.toFixed(2) + ")";
        context.fill();

        for (let j = index + 1; j < points.length; j += 1) {
          const other = points[j];
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance < 105) {
            context.beginPath();
            context.moveTo(point.x, point.y);
            context.lineTo(other.x, other.y);
            context.strokeStyle = "rgba(111, 129, 240," + ((1 - distance / 105) * 0.14).toFixed(3) + ")";
            context.lineWidth = 0.7;
            context.stroke();
          }
        }
      });
      if (!reduceMotion) frame = window.requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="tools-particle-canvas" aria-hidden="true" />;
}


export function ToolsLab() {
  const router = useRouter();
  const [openingTool, setOpeningTool] = useState<ToolItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All tools");
  const [kind, setKind] = useState<"all" | "ai" | "browser">("all");
  const [selected, setSelected] = useState<ToolItem | null>(null);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");

  useEffect(() => {
    setShortcutLabel(/Mac|iPhone|iPad/.test(window.navigator.platform) ? "⌘ K" : "Ctrl K");
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  const filtered = useMemo(() => toolCatalog.filter((tool) => {
    const matchesQuery = (tool.name + " " + tool.description + " " + tool.category).toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === "All tools" || tool.category === category) && (kind === "all" || tool.kind === kind);
  }), [query, category, kind]);

  const openToolPage = (tool: ToolItem) => {
    chooseTool(tool);
    setOpeningTool(tool);
    window.setTimeout(() => router.push("/tools/" + tool.id), 720);
  };

  const chooseTool = (tool: ToolItem) => {
    setSelected(tool);
    setInput("");
    setAttachments([]);
    setResult("");
    setError("");
    setCopied(false);
  };

  const runTool = async () => {
    if (!selected || (!input.trim() && attachments.length === 0)) {
      setError("Add some details or attach a file first.");
      return;
    }
    if (attachments.some(file => file.size > 8 * 1024 * 1024)) {
      setError("Each attachment must be smaller than 8 MB. Use a shorter clip or a smaller file.");
      return;
    }
    setError("");
    setResult("");
    setCopied(false);
    setLoading(true);
    try {
      if (browserToolIds.has(selected.id)) {
        const local = localTransform(selected, input);
        if (local !== null) {
          setResult(local);
          return;
        }
      }
      const encodedAttachments = await Promise.all(attachments.map(async file => ({ name: file.name, type: file.type || "application/octet-stream", data: await readFileAsDataUrl(file) })));
      const response = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: selected.id, input, attachments: encodedAttachments }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The tool could not complete this request.");
      setResult(payload.result || "No result returned.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Something went wrong. Try again.";
      setError(/openrouter|free model|model selected|video model|provider|backend|api key/i.test(message) ? "This tool could not complete the request right now. Please try again." : message);
    } finally {
      setLoading(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard access was blocked. Select the result and copy it manually.");
    }
  };

  return (
    <main className="tools-page" id="content">
      <div className="tools-ambient" aria-hidden="true">
        <div className="tools-ambient-orb tools-ambient-orb-a" />
        <div className="tools-ambient-orb tools-ambient-orb-b" />
        <div className="tools-ambient-grid" />
        <ParticleField />
      </div>

      <section className="tools-hero">
        <div className="tools-shell">
          <motion.div className="tools-hero-copy" initial={{ opacity: 0, y: 24, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}>
            <div className="tools-eyebrow"><span className="tools-live-dot" /> RAPIGENTS LABS <span className="tools-eyebrow-line" /> A WORKSPACE FOR THE WORK</div>
            <h1>Less busywork.<br /><span>More done.</span></h1>
            <p className="tools-hero-lede">A living toolkit for writing, research, business operations, study, and automation. Pick a task, give it context, get something useful back.</p>
            <div className="tools-hero-stats">
              <div><strong>{toolCatalog.length.toString().padStart(2, "0")}</strong><span>TOOLS IN THE LAB</span></div>
              <div><strong>01</strong><span>WORKSPACE</span></div>
              <div><strong>∞</strong><span>WAYS TO USE THEM</span></div>
            </div>
          </motion.div>

          <motion.div className="tools-hero-art" initial={{ opacity: 0, scale: 0.92, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 1, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}>
            <div className="tools-art-top"><span><span className="tools-live-dot" /> YOUR WORKSPACE</span><span>RG / 001</span></div>
            <div className="tools-art-orbit tools-art-orbit-outer" />
            <div className="tools-art-orbit tools-art-orbit-inner" />
            <div className="tools-art-core"><WandSparkles size={30} strokeWidth={1.4} /></div>
            <div className="tools-art-node tools-art-node-a"><FileText size={16}/><span>INPUT</span></div>
            <div className="tools-art-node tools-art-node-b"><Sparkles size={16}/><span>REASON</span></div>
            <div className="tools-art-node tools-art-node-c"><Check size={16}/><span>OUTPUT</span></div>
            <div className="tools-art-bottom"><span>CONTEXT IN</span><span className="tools-art-dash" /><span>USEFULNESS OUT</span></div>
            <div className="tools-art-caption">A little less chaos, one task at a time.</div>
          </motion.div>
        </div>
        <div className="tools-scroll-cue"><span /> SCROLL TO EXPLORE</div>
      </section>

      <section className="tools-workspace tools-shell" id="explore">
        <div className="tools-section-heading">
          <div><span className="tools-section-kicker">THE TOOLKIT / 001—{String(toolCatalog.length).padStart(3, "0")}</span><h2>Find your next <em>unfair advantage.</em></h2></div>
          <p>Small, focused tools. Clear inputs. Useful outputs. No mysterious buttons that do absolutely nothing.</p>
        </div>

        <div className="tools-controls">
          <label className="tools-search"><Search size={17} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools, tasks, or categories…" aria-label="Search tools" /><kbd>{shortcutLabel}</kbd></label>
          <div className="tools-filter-toggle" role="group" aria-label="Filter by tool type">
            <button type="button" className={kind === "all" ? "is-active" : ""} onClick={() => setKind("all")}>All</button>
            <button type="button" className={kind === "ai" ? "is-active" : ""} onClick={() => setKind("ai")}><Sparkles size={13}/> AI tools</button>
            <button type="button" className={kind === "browser" ? "is-active" : ""} onClick={() => setKind("browser")}><Code2 size={13}/> Local tools</button>
          </div>
        </div>

        <div className="tools-category-row">
          {categories.map((item) => <button type="button" key={item} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item}<span>{item === "All tools" ? toolCatalog.length : toolCatalog.filter((tool) => tool.category === item).length}</span></button>)}
        </div>

        <div className="tools-results-meta"><span>{filtered.length} TOOLS MATCH YOUR FILTERS</span><span><span className="tools-live-dot" /> LIVE WORKSPACE</span></div>

        <div className="tools-card-grid">
          {filtered.slice(0, showAll ? filtered.length : 24).map((tool, index) => (
            <motion.button type="button" key={tool.id} className={"tool-card " + (selected?.id === tool.id ? "is-selected" : "")} onClick={() => openToolPage(tool)} onPointerMove={(event) => { if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; const rect = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--pointer-x", ((event.clientX - rect.left) / rect.width * 100).toFixed(1) + "%"); event.currentTarget.style.setProperty("--pointer-y", ((event.clientY - rect.top) / rect.height * 100).toFixed(1) + "%"); }} onPointerLeave={(event) => { event.currentTarget.style.setProperty("--pointer-x", "50%"); event.currentTarget.style.setProperty("--pointer-y", "50%"); }} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.45, delay: Math.min(index % 6, 5) * 0.035 }} whileHover={{ y: -5, transition: { duration: 0.2 } }}>
              <div className="tool-card-top"><span className="tool-card-icon">{tool.kind === "browser" ? <Code2 size={17}/> : <Sparkles size={17}/>}</span><span className={tool.kind === "browser" ? "tool-type-tag local" : "tool-type-tag"}>{tool.kind === "browser" ? "LOCAL" : "AI POWERED"}</span></div>
              <span className="tool-card-category">{tool.category}</span>
              <strong>{tool.name}</strong>
              <p>{tool.description}</p>
              <span className="tool-card-open">OPEN TOOL <ArrowUpRight size={14}/></span>
            </motion.button>
          ))}
        </div>
        {filtered.length > 24 && <button type="button" className="tools-load-more" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer tools" : "Explore all " + filtered.length + " matching tools"} <ChevronDown size={15} className={showAll ? "rotate-180" : ""}/></button>}
        {filtered.length === 0 && <div className="tools-empty"><CircleHelp size={26}/><strong>No tools found</strong><span>Try another search or clear the category filter.</span><button type="button" onClick={() => { setQuery(""); setCategory("All tools"); setKind("all"); }}>Reset filters</button></div>}
      </section>

      <section className="tools-note-band"><div className="tools-shell"><div className="tools-note-icon"><Zap size={19}/></div><div><strong>Built to be useful, not just impressive.</strong><p>Local tools run in your browser. AI-assisted tools analyze the context you provide. Outputs are drafts and should be reviewed before important decisions or external actions.</p></div><a href="#explore">Back to tools <ArrowUpRight size={14}/></a></div></section>

      <AnimatePresence>
        {openingTool && <motion.div className="tool-launch-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" aria-live="polite">
          <motion.div className={"tool-launch-card launch-" + openingTool.kind} initial={{ opacity: 0, y: 18, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .28 }}>
            <div className="tool-launch-top"><span className="tools-live-dot" /> RAPIGENTS / TOOL INITIALIZING <span>{openingTool.category.toUpperCase()}</span></div>
            <ToolLaunchVisual tool={openingTool} />
            <span className="tool-launch-label">{openingTool.name}</span>
            <span className="tool-launch-sub">Preparing your workspace…</span>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
      <AnimatePresence>
        {selected && <motion.div className="tool-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <motion.section className="tool-modal" role="dialog" aria-modal="true" aria-labelledby="tool-modal-title" initial={{ opacity: 0, y: 28, scale: 0.97, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: 18, scale: 0.98, filter: "blur(8px)" }} transition={{ duration: 0.28 }} onKeyDown={(event) => { if (event.key === "Escape") setSelected(null); }}>
            <div className="tool-modal-top"><div className="tool-modal-brand"><span className="tool-modal-symbol"><WandSparkles size={18}/></span><span>RAPIGENTS / TOOL SESSION</span></div><button type="button" className="tool-modal-close" onClick={() => setSelected(null)} aria-label="Close tool"><X size={19}/></button></div>
            <div className="tool-modal-heading"><div><span className="tools-section-kicker">{selected.category.toUpperCase()} / {selected.kind === "browser" ? "LOCAL PROCESSING" : "AI ASSISTED"}</span><h2 id="tool-modal-title">{selected.name}</h2><p>{selected.description}</p></div><span className="tool-modal-index">RG—{String(toolCatalog.findIndex((tool) => tool.id === selected.id) + 1).padStart(3, "0")}</span></div>
            <label className="tool-input-label" htmlFor="tool-input">{selected.kind === "browser" ? "INPUT / TEXT OR VALUES" : "GIVE THE TOOL CONTEXT"}</label>
            <textarea id="tool-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder={selected.id === "text-diff-checker" ? "Paste the first version here, then add a line with --- and paste the second version." : selected.id === "utm-link-builder" ? "https://example.com\nsource=newsletter\nmedium=email\ncampaign=launch" : selected.id === "percentage-calculator" ? "18, 240" : selected.id === "profit-margin-calculator" ? "100, 65" : selected.id === "timestamp-converter" ? "1735689600" : selected.id === "password-generator" ? "20" : "Paste text, describe the task, or provide the details to process…"} maxLength={12000} />
            <div className="tool-input-foot"><span>{input.length.toLocaleString()} / 12,000 characters</span><span>{selected.kind === "browser" ? <><Code2 size={12}/> Processed locally</> : <><Sparkles size={12}/> AI-assisted processing</>}</span></div>
            {selected.kind === "ai" && supportsAttachments(selected) && <div className="tool-attachments">
              <div className="tool-attachments-head"><span><Paperclip size={15}/> ATTACH SUPPORTING FILES</span><small>Up to 3 files · 8 MB each</small></div>
              <label className="tool-attachment-picker"><input type="file" accept={attachmentAccept(selected)} multiple onChange={event => {
                const picked = Array.from(event.target.files || []);
                if (picked.length + attachments.length > 3) { setError("Attach up to 3 files per request."); event.target.value = ""; return; }
                if (picked.some(file => file.size > 8 * 1024 * 1024)) { setError("Each attachment must be smaller than 8 MB."); event.target.value = ""; return; }
                setError(""); setAttachments(current => [...current, ...picked].slice(0, 3)); event.target.value = "";
              }}/><FileImage size={17}/><FileAudio size={17}/><FileVideo size={17}/><span>Choose image, MP3/WAV, video, or PDF</span><b>Browse</b></label>
              {attachments.length > 0 && <div className="tool-attachment-list">{attachments.map((file, index) => <div key={file.name + file.size + index}><span>{file.type.startsWith("image/") ? <FileImage size={14}/> : file.type.startsWith("audio/") ? <FileAudio size={14}/> : file.type.startsWith("video/") ? <FileVideo size={14}/> : <FileText size={14}/>}</span><span>{file.name}<small>{(file.size / (1024 * 1024)).toFixed(1)} MB</small></span><button type="button" onClick={() => setAttachments(current => current.filter((_, i) => i !== index))} aria-label={"Remove " + file.name}><X size={14}/></button></div>)}</div>}
              <p>Files are sent with your prompt to the AI service for analysis. Avoid private or sensitive material.</p>
            </div>}
            {error && <div className="tool-error" role="alert">{error}</div>}
            <div className="tool-modal-actions"><button type="button" className="tool-run-button" onClick={runTool} disabled={loading || (!input.trim() && attachments.length === 0)}>{loading ? <><LoaderCircle size={16} className="animate-spin"/> Working on it…</> : <>Run tool <ArrowRight size={16}/></>}</button><button type="button" className="tool-clear-button" onClick={() => { setInput(""); setAttachments([]); setResult(""); setError(""); }}>Clear input</button><span className="tool-privacy-note"><CircleHelp size={13}/> Don’t include passwords or sensitive personal details.</span></div>
            {result && <motion.div className="tool-output" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}><div className="tool-output-head"><div><span className="tools-section-kicker">RESULT / READY</span><strong>Generated output</strong></div><button type="button" onClick={copyResult} className="tool-copy-button">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copied" : "Copy result"}</button></div><pre>{result}</pre><div className="tool-output-foot"><span><Check size={12}/> Result ready for review</span><button type="button" onClick={() => { setInput(result); setResult(""); setError(""); }}>Use as new input <ArrowDownRight size={13}/></button></div></motion.div>}
            <div className="tool-modal-bottom"><span><AudioLines size={13}/> AI REQUEST</span><span><Clock3 size={13}/> RESULTS ARE NOT SAVED HERE</span></div>
          </motion.section>
        </motion.div>}
      </AnimatePresence>
    </main>
  );
}
