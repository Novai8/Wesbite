"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Check, CornerDownLeft, LoaderCircle, RotateCcw, Send, Sparkles, X } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Tool = { id: string; name: string; category: string; description: string };

const starters = [
  "Help me write a professional email",
  "Find the right tool for my resume",
  "Analyze a spreadsheet or CSV",
  "Help me automate a business task",
];

export function RapigentsAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<Tool[]>([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(starters);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, messages, busy]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next = [...messages, { role: "user" as const, content: trimmed }].slice(-12);
    setMessages(next);
    setInput("");
    setBusy(true);
    setError("");
    setRecommendations([]);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The assistant couldn't answer right now.");
      const reply = typeof payload.message === "string" ? payload.message : "I couldn't prepare a response. Please try again.";
      setMessages((current) => [...current, { role: "assistant", content: reply }].slice(-12));
      setRecommendations(Array.isArray(payload.tools) ? payload.tools : []);
      setSuggestedPrompts(Array.isArray(payload.suggestedPrompts) && payload.suggestedPrompts.length ? payload.suggestedPrompts : starters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant couldn't answer right now.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (input.trim() && !busy) void sendMessage(input);
    }
  }

  function resetChat() {
    setMessages([]);
    setInput("");
    setError("");
    setRecommendations([]);
    setSuggestedPrompts(starters);
  }

  return (
    <div className="rg-assistant-root">
      {open && (
        <section className="rg-assistant-panel" role="dialog" aria-label="Rapigents AI assistant" aria-modal="false">
          <header className="rg-assistant-head">
            <div className="rg-assistant-avatar"><Bot size={21}/><i/></div>
            <div className="rg-assistant-head-copy"><strong>Rapigents Assistant</strong><span><span className="rg-assistant-online"/> AI guide · GPT-6 Astra</span></div>
            <button type="button" onClick={resetChat} aria-label="New conversation" title="New conversation" className="rg-assistant-icon-btn"><RotateCcw size={16}/></button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="rg-assistant-icon-btn"><X size={19}/></button>
          </header>

          <div className="rg-assistant-feed" aria-live="polite">
            {messages.length === 0 && (
              <div className="rg-assistant-welcome">
                <span className="rg-assistant-eyebrow"><Sparkles size={13}/> YOUR TASK PARTNER</span>
                <h3>What are we getting done?</h3>
                <p>Ask a question, work through a task, or tell me what you're trying to do. I can help directly and point you to the best tool in the toolbox.</p>
                <div className="rg-assistant-starters">{starters.map((starter) => <button type="button" key={starter} onClick={() => void sendMessage(starter)}>{starter}<ArrowRight size={13}/></button>)}</div>
              </div>
            )}
            {messages.map((message, index) => (
              <div className={"rg-assistant-message " + message.role} key={index}>
                {message.role === "assistant" && <span className="rg-assistant-message-mark"><Sparkles size={13}/></span>}
                <div className="rg-assistant-bubble">{message.content}</div>
              </div>
            ))}
            {busy && <div className="rg-assistant-thinking"><span/><span/><span/> <small>Thinking through it…</small></div>}
            {error && <div className="rg-assistant-error" role="alert">{error}<button type="button" onClick={() => void sendMessage(messages[messages.length - 1]?.content || "")}>Try again</button></div>}
            {recommendations.length > 0 && (
              <div className="rg-assistant-recommendations">
                <span className="rg-assistant-recommend-label">TOOLS THAT FIT</span>
                {recommendations.map((tool) => <Link key={tool.id} href={"/tools/" + tool.id} onClick={() => setOpen(false)} className="rg-assistant-tool-link"><span><strong>{tool.name}</strong><small>{tool.category} · {tool.description}</small></span><ArrowRight size={15}/></Link>)}
              </div>
            )}
            {!busy && messages.length > 0 && suggestedPrompts.length > 0 && <div className="rg-assistant-followups">{suggestedPrompts.slice(0, 3).map((prompt) => <button key={prompt} type="button" onClick={() => void sendMessage(prompt)}>{prompt}</button>)}</div>}
            <div ref={endRef}/>
          </div>

          <form className="rg-assistant-compose" onSubmit={submit}>
            <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onInputKeyDown} placeholder="Tell me what you need…" rows={2} maxLength={4000} aria-label="Message the Rapigents assistant" disabled={busy}/>
            <div className="rg-assistant-compose-foot"><span><CornerDownLeft size={12}/> Enter to send · Shift + Enter for a new line</span><button type="submit" disabled={busy || !input.trim()} aria-label="Send message">{busy ? <LoaderCircle size={17} className="rg-assistant-spin"/> : <Send size={17}/>}</button></div>
          </form>
          <div className="rg-assistant-disclaimer"><Check size={11}/> AI can make mistakes. Review important outputs.</div>
        </section>
      )}
      <button type="button" className={"rg-assistant-launcher " + (open ? "is-open" : "")} onClick={() => setOpen((value) => !value)} aria-label={open ? "Close Rapigents assistant" : "Open Rapigents AI assistant"} aria-expanded={open}>
        {open ? <X size={22}/> : <><span className="rg-assistant-launcher-icon"><Sparkles size={20}/></span><span className="rg-assistant-launcher-label">Ask Rapigents</span></>}
        {!open && <i className="rg-assistant-launcher-pulse"/>}
      </button>
    </div>
  );
}
