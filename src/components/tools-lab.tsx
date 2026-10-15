"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, AudioLines, Bot, Check, ChevronDown,
  CircleHelp, Clock3, Code2, Copy, FileText, Filter, Layers3, LoaderCircle,
  Search, Sparkles, WandSparkles, X, Zap,
} from "lucide-react";
import { browserToolIds, toolCatalog, type ToolItem } from "@/data/tool-catalog";

const categories = ["All tools", ...Array.from(new Set(toolCatalog.map((tool) => tool.category)))];

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

function makeId(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function localTransform(tool: ToolItem, input: string): string | null {
  const value = input.trim();
  switch (tool.id) {
    case "json-formatter-and-validator":
      try { return JSON.stringify(JSON.parse(value), null, 2); }
      catch (error) { return "Invalid JSON: " + (error instanceof Error ? error.message : "Check commas, quotes, and brackets."); }
    case "csv-to-json-converter": {
      const rows = value.split(/\r?\n/).filter(Boolean).map((row) => row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
      if (rows.length < 2) return "Add a CSV header row followed by at least one data row.";
      const headers = rows[0];
      return JSON.stringify(rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))), null, 2);
    }
    case "json-to-csv-converter": {
      try {
        const data = JSON.parse(value);
        if (!Array.isArray(data) || !data.length || typeof data[0] !== "object" || data[0] === null) return "Provide a non-empty JSON array of objects.";
        const headers = Array.from(new Set(data.flatMap((row: Record<string, unknown>) => Object.keys(row))));
        const quote = (cell: unknown) => '"' + String(cell ?? "").replace(/"/g, '""') + '"';
        return [headers.map(quote).join(","), ...data.map((row: Record<string, unknown>) => headers.map((key) => quote(row[key])).join(","))].join("\n");
      } catch { return "Invalid JSON. Paste a JSON array of objects."; }
    }
    case "word-and-character-counter": {
      const words = value ? value.split(/\s+/).filter(Boolean).length : 0;
      const sentences = value ? (value.match(/[.!?]+(?=\s|$)/g) || []).length : 0;
      const paragraphs = value ? value.split(/\n\s*\n/).filter((item) => item.trim()).length : 0;
      return "Words: " + words + "\nCharacters (with spaces): " + input.length + "\nCharacters (without spaces): " + input.replace(/\s/g, "").length + "\nSentences: " + sentences + "\nParagraphs: " + paragraphs;
    }
    case "text-case-converter":
      return "UPPERCASE\n" + value.toUpperCase() + "\n\nlowercase\n" + value.toLowerCase() + "\n\nTitle Case\n" + value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) + "\n\nSentence case\n" + value.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (char) => char.toUpperCase());
    case "text-diff-checker": {
      const parts = input.split(/\n---\s*\n/);
      if (parts.length < 2) return "Paste version one, then a line containing --- and version two.";
      const a = parts[0].split("\n");
      const b = parts.slice(1).join("\n").split("\n");
      const out = ["COMPARISON", ""];
      a.forEach((line, index) => { if (line !== b[index]) out.push("- " + line); });
      b.forEach((line, index) => { if (line !== a[index]) out.push("+ " + line); });
      if (out.length === 2) out.push("No line-level differences found.");
      return out.join("\n");
    }
    case "base64-encoder-and-decoder":
      try {
        if (value.startsWith("decode:")) return decodeURIComponent(escape(atob(value.slice(7).trim())));
        return btoa(unescape(encodeURIComponent(value)));
      } catch { return "Could not decode that Base64 value. For decoding, start the input with decode:"; }
    case "url-encoder-and-decoder":
      try { return value.startsWith("decode:") ? decodeURIComponent(value.slice(7).trim()) : encodeURIComponent(value); }
      catch { return "Invalid encoded URL component."; }
    case "uuid-generator":
      return Array.from({ length: Math.min(20, Math.max(1, Number(value) || 1)) }, () => crypto.randomUUID()).join("\n");
    case "markdown-previewer":
      return "Markdown preview is represented as plain text here. Use headings (#), lists (-), **bold**, and links [label](url).\n\n" + value;
    case "html-entity-encoder":
      return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    case "timestamp-converter": {
      const number = Number(value);
      if (!Number.isFinite(number)) return "Enter a Unix timestamp in seconds or milliseconds.";
      const milliseconds = Math.abs(number) < 1e12 ? number * 1000 : number;
      const date = new Date(milliseconds);
      return Number.isNaN(date.getTime()) ? "That timestamp is outside the supported range." : date.toISOString() + "\nLocal display: " + date.toLocaleString();
    }
    case "percentage-calculator": {
      const nums = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      if (nums.length < 2) return "Enter two numbers, for example: 18, 240. This calculates the first as a percentage of the second.";
      return nums[1] === 0 ? "Cannot divide by zero." : nums[0] + " is " + ((nums[0] / nums[1]) * 100).toFixed(2) + "% of " + nums[1] + ".";
    }
    case "profit-margin-calculator": {
      const nums = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      if (nums.length < 2) return "Enter selling price and cost, e.g. 100, 65.";
      const [selling, cost] = nums;
      if (selling === 0) return "Selling price must not be zero.";
      return "Profit: " + (selling - cost).toFixed(2) + "\nGross margin: " + (((selling - cost) / selling) * 100).toFixed(2) + "%\nMarkup on cost: " + (cost === 0 ? "Not defined when cost is zero." : (((selling - cost) / cost) * 100).toFixed(2) + "%");
    }
    case "utm-link-builder": {
      try {
        const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
        const url = new URL(lines[0]);
        const params = new URLSearchParams(url.search);
        for (const line of lines.slice(1)) {
          const [key, ...rest] = line.split("=");
          if (key && rest.length) params.set("utm_" + key.trim().replace(/^utm_/, ""), rest.join("=").trim());
        }
        url.search = params.toString();
        return url.toString();
      } catch { return "Enter a full URL on the first line, then source=..., medium=..., campaign=... on separate lines."; }
    }
    case "password-generator": {
      const length = Math.min(128, Math.max(12, Number(value) || 20));
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_";
      const bytes = crypto.getRandomValues(new Uint8Array(length));
      return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
    }
    case "text-duplicate-remover":
      return Array.from(new Set(input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))).join("\n");
    default:
      return null;
  }
}

export function ToolsLab() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All tools");
  const [kind, setKind] = useState<"all" | "ai" | "browser">("all");
  const [selected, setSelected] = useState<ToolItem | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => toolCatalog.filter((tool) => {
    const matchesQuery = (tool.name + " " + tool.description + " " + tool.category).toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === "All tools" || tool.category === category) && (kind === "all" || tool.kind === kind);
  }), [query, category, kind]);

  const chooseTool = (tool: ToolItem) => {
    setSelected(tool);
    setInput("");
    setResult("");
    setError("");
    setCopied(false);
  };

  const runTool = async () => {
    if (!selected || !input.trim()) {
      setError("Add your text or details first.");
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
      const response = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: selected.id, input }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The tool could not complete this request.");
      setResult(payload.result || "No result returned.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
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
            <div className="tools-art-top"><span><span className="tools-live-dot" /> SYSTEM ONLINE</span><span>RG / 001</span></div>
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
          <label className="tools-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools, tasks, or categories…" aria-label="Search tools" /><kbd>⌘ K</kbd></label>
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
            <motion.button type="button" key={tool.id} className={"tool-card " + (selected?.id === tool.id ? "is-selected" : "")} onClick={() => chooseTool(tool)} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.45, delay: Math.min(index % 6, 5) * 0.035 }} whileHover={{ y: -5, transition: { duration: 0.2 } }}>
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

      <section className="tools-note-band"><div className="tools-shell"><div className="tools-note-icon"><Zap size={19}/></div><div><strong>Built to be useful, not just impressive.</strong><p>Local tools run in your browser. AI tools use the server-side OpenRouter connection when configured. Outputs are drafts and should be reviewed before important decisions or external actions.</p></div><a href="#explore">Back to tools <ArrowUpRight size={14}/></a></div></section>

      <AnimatePresence>
        {selected && <motion.div className="tool-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <motion.section className="tool-modal" role="dialog" aria-modal="true" aria-labelledby="tool-modal-title" initial={{ opacity: 0, y: 28, scale: 0.97, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, y: 18, scale: 0.98, filter: "blur(8px)" }} transition={{ duration: 0.28 }} onKeyDown={(event) => { if (event.key === "Escape") setSelected(null); }}>
            <div className="tool-modal-top"><div className="tool-modal-brand"><span className="tool-modal-symbol"><WandSparkles size={18}/></span><span>RAPIGENTS / TOOL SESSION</span></div><button type="button" className="tool-modal-close" onClick={() => setSelected(null)} aria-label="Close tool"><X size={19}/></button></div>
            <div className="tool-modal-heading"><div><span className="tools-section-kicker">{selected.category.toUpperCase()} / {selected.kind === "browser" ? "LOCAL PROCESSING" : "AI ASSISTED"}</span><h2 id="tool-modal-title">{selected.name}</h2><p>{selected.description}</p></div><span className="tool-modal-index">RG—{String(toolCatalog.findIndex((tool) => tool.id === selected.id) + 1).padStart(3, "0")}</span></div>
            <label className="tool-input-label" htmlFor="tool-input">{selected.kind === "browser" ? "INPUT / TEXT OR VALUES" : "GIVE THE TOOL CONTEXT"}</label>
            <textarea id="tool-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder={selected.id === "text-diff-checker" ? "Paste the first version here, then add a line with --- and paste the second version." : selected.id === "utm-link-builder" ? "https://example.com\nsource=newsletter\nmedium=email\ncampaign=launch" : selected.id === "percentage-calculator" ? "18, 240" : selected.id === "profit-margin-calculator" ? "100, 65" : selected.id === "timestamp-converter" ? "1735689600" : selected.id === "password-generator" ? "20" : "Paste text, describe the task, or provide the details to process…"} maxLength={12000} />
            <div className="tool-input-foot"><span>{input.length.toLocaleString()} / 12,000 characters</span><span>{selected.kind === "browser" ? <><Code2 size={12}/> Processed locally</> : <><Sparkles size={12}/> AI model required</>}</span></div>
            {error && <div className="tool-error" role="alert">{error}</div>}
            <div className="tool-modal-actions"><button type="button" className="tool-run-button" onClick={runTool} disabled={loading || !input.trim()}>{loading ? <><LoaderCircle size={16} className="animate-spin"/> Working on it…</> : <>Run tool <ArrowRight size={16}/></>}</button><button type="button" className="tool-clear-button" onClick={() => { setInput(""); setResult(""); setError(""); }}>Clear input</button><span className="tool-privacy-note"><CircleHelp size={13}/> Avoid sensitive personal data.</span></div>
            {result && <motion.div className="tool-output" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}><div className="tool-output-head"><div><span className="tools-section-kicker">RESULT / READY</span><strong>Generated output</strong></div><button type="button" onClick={copyResult} className="tool-copy-button">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copied" : "Copy result"}</button></div><pre>{result}</pre><div className="tool-output-foot"><span><Check size={12}/> Result ready for review</span><button type="button" onClick={() => { setInput(result); setResult(""); setError(""); }}>Use as new input <ArrowDownRight size={13}/></button></div></motion.div>}
            <div className="tool-modal-bottom"><span><AudioLines size={13}/> SESSION IS PRIVATE TO THIS PAGE</span><span><Clock3 size={13}/> NO RESULT HISTORY SAVED</span></div>
          </motion.section>
        </motion.div>}
      </AnimatePresence>
    </main>
  );
}
