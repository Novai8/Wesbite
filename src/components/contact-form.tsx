"use client";

import { useRef, useState, type FormEvent } from "react";
import { Check, Copy } from "lucide-react";
import { usePrefs } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { contactBody, contactGmailCompose, contactMailto, site } from "@/lib/site";

const interests = ["Missed calls / enquiries", "Quote follow-up", "Lead capture", "Appointment scheduling", "Customer support", "Admin / data entry", "Something else"];
type Fields = { name: string; email: string; company: string; interest: string; message: string };
const empty: Fields = { name:"", email:"", company:"", interest:interests[0], message:"" };

async function copyText(value:string) { try { await navigator.clipboard.writeText(value); return true; } catch { try { const area=document.createElement("textarea"); area.value=value; area.setAttribute("readonly",""); area.style.position="fixed"; area.style.left="-9999px"; document.body.appendChild(area); area.select(); const ok=document.execCommand("copy"); area.remove(); return ok; } catch { return false; } } }

export function ContactForm() {
  const { toast } = usePrefs();
  const [fields,setFields] = useState<Fields>(empty);
  const [errors,setErrors] = useState<Partial<Record<keyof Fields,string>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const [composed,setComposed] = useState("");
  const [mailtoHref,setMailtoHref] = useState("");
  const [copiedEmail,setCopiedEmail] = useState(false);
  const [copiedMessage,setCopiedMessage] = useState(false);

  function set<K extends keyof Fields>(key:K,value:Fields[K]) { setFields(current=>({...current,[key]:value})); setErrors(current=>({...current,[key]:undefined})); }
  function validate(next:Fields) { const errors:Partial<Record<keyof Fields,string>>={}; if(!next.name.trim()) errors.name="Add your name."; if(!next.email.trim()) errors.email="Add an email so Hussnain can reply."; else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email.trim())) errors.email="That email does not look complete."; if(next.message.trim().length===0) errors.message="Describe the repetitive problem."; else if(next.message.trim().length>2000) errors.message="Keep the note under 2000 characters."; return errors; }
  function submit(e:FormEvent) {
    e.preventDefault();
    const nextErrors=validate(fields);
    setErrors(nextErrors);
    const firstInvalid=(["name","email","message"] as const).find(key=>nextErrors[key]);
    if(firstInvalid){
      toast("Check the highlighted fields.");
      formRef.current?.querySelector<HTMLElement>("#"+firstInvalid)?.focus();
      return;
    }
    const payload={name:fields.name.trim(),email:fields.email.trim(),company:fields.company.trim(),interest:fields.interest,message:fields.message.trim()};
    setComposed(contactBody(payload));
    setMailtoHref(contactMailto(payload));
    // Note: passing "noopener" makes window.open() always return null, which would
    // wrongly report a blocked popup. Open normally, then drop the opener reference.
    const gmailWindow=window.open(contactGmailCompose(payload),"_blank");
    if(gmailWindow){
      gmailWindow.opener=null;
      toast("Gmail opened in a new tab. Nothing was stored here.");
    } else {
      toast("Popup blocked. Use the buttons below instead.");
    }
  }
  async function copyEmail(){const ok=await copyText(site.email);if(!ok){toast("Could not copy automatically.");return;}setCopiedEmail(true);toast("Email copied.");window.setTimeout(()=>setCopiedEmail(false),1800);}
  async function copyMessage(){const ok=await copyText(composed);if(!ok){toast("Could not copy automatically.");return;}setCopiedMessage(true);toast("Message copied.");window.setTimeout(()=>setCopiedMessage(false),1800);}

  return <div className="contact-layout">
    <div className="contact-info-card"><span className="section-number">DIRECT</span><a href={"mailto:" + site.email} className="contact-email">{site.email}</a><p>The prototype does not store enquiries. Use the form to compose a problem report in Gmail.</p><Button type="button" variant="secondary" onClick={copyEmail}>{copiedEmail?<Check className="h-4 w-4"/>:<Copy className="h-4 w-4"/>}{copiedEmail?"Copied":"Copy email"}</Button></div>
    <form ref={formRef} className="contact-form-card" onSubmit={submit} noValidate><div className="contact-form-heading"><div><span className="section-number">DESCRIBE THE LEAK</span><h2>Give us one process.</h2></div><span className="form-prototype-label">Prototype intake</span></div>
      <div className="grid gap-4 sm:grid-cols-2 mt-6"><Field label="Name" htmlFor="name" error={errors.name}><Input id="name" autoComplete="name" aria-invalid={errors.name?true:undefined} aria-describedby={errors.name?"name-error":undefined} value={fields.name} onChange={e=>set("name",e.target.value)} /></Field><Field label="Email" htmlFor="email" error={errors.email}><Input id="email" type="email" inputMode="email" autoComplete="email" aria-invalid={errors.email?true:undefined} aria-describedby={errors.email?"email-error":undefined} value={fields.email} onChange={e=>set("email",e.target.value)} /></Field></div>
      <div className="grid gap-4 sm:grid-cols-2 mt-4"><Field label="Company" htmlFor="company" optional><Input id="company" autoComplete="organization" value={fields.company} onChange={e=>set("company",e.target.value)} /></Field><Field label="Problem type" htmlFor="interest"><select id="interest" className="field" value={fields.interest} onChange={e=>set("interest",e.target.value)}>{interests.map(item=><option key={item}>{item}</option>)}</select></Field></div>
      <div className="mt-4"><Field label="What keeps falling through the cracks?" htmlFor="message" error={errors.message}><Textarea id="message" maxLength={2000} aria-invalid={errors.message?true:undefined} aria-describedby={errors.message?"message-error":undefined} value={fields.message} onChange={e=>set("message",e.target.value)} /></Field></div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><Button type="submit">Compose the email <Check className="h-4 w-4" aria-hidden /></Button><p className="text-xs text-muted">No message database. No automated send.</p></div>
      {composed?<div className="mt-5 rounded-2xl border border-line bg-paper p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Ready to paste</p><button type="button" className="btn btn-ghost h-9 px-3 text-sm" onClick={copyMessage}>{copiedMessage?"Copied":"Copy message"}</button></div><p className="mt-2 text-xs text-muted">Not a Gmail user? <a className="underline" href={mailtoHref}>Open in your email app</a> or copy the message below.</p><pre className="mt-3 whitespace-pre-wrap break-anywhere text-sm leading-relaxed text-ink">{composed}</pre></div>:null}
    </form>
  </div>;
}
function Field({label,htmlFor,error,optional,children}:{label:string;htmlFor:string;error?:string;optional?:boolean;children:React.ReactNode}) { return <label className="block min-w-0" htmlFor={htmlFor}><span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium">{label}{optional?<span className="text-xs font-normal text-muted">Optional</span>:null}</span>{children}{error?<span id={htmlFor+"-error"} role="alert" className="field-error mt-1.5 block text-xs">{error}</span>:null}</label>; }
