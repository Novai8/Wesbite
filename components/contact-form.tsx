"use client";

import { useState, type FormEvent } from "react";
import { Check, Copy } from "lucide-react";
import { usePrefs } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { contactBody, contactMailto, site } from "@/lib/site";

type Fields = {
  name: string;
  email: string;
  company: string;
  interest: string;
  message: string;
};

const interests = [
  "Missed calls / enquiries",
  "Quote follow-up",
  "Lead capture",
  "Appointment scheduling",
  "Customer support",
  "Admin / data entry",
  "Something else",
];

const empty: Fields = {
  name: "",
  email: "",
  company: "",
  interest: interests[0],
  message: "",
};

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function ContactForm() {
  const { toast } = usePrefs();
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [composed, setComposed] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(next: Fields) {
    const nextErrors: Partial<Record<keyof Fields, string>> = {};
    if (!next.name.trim()) nextErrors.name = "Add your name.";
    if (!next.email.trim()) nextErrors.email = "Add an email so Hussnain can reply.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email.trim())) nextErrors.email = "That email does not look complete.";
    if (next.company.trim().length > 80) nextErrors.company = "Keep the company under 80 characters.";
    if (!next.message.trim()) nextErrors.message = "Describe the repetitive problem.";
    else if (next.message.trim().length > 2000) nextErrors.message = "Keep the note under 2000 characters.";
    return nextErrors;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validate(fields);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast("Check the highlighted fields.");
      return;
    }

    const payload = {
      name: fields.name.trim(),
      email: fields.email.trim(),
      company: fields.company.trim(),
      interest: fields.interest,
      message: fields.message.trim(),
    };
    const body = contactBody(payload);
    const href = contactMailto(payload);
    setComposed(body);
    const link = document.createElement("a");
    link.href = href;
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast("Opening your email app. Nothing was stored by this site.");
  }

  async function onCopyEmail() {
    const ok = await copyText(site.email);
    if (!ok) {
      toast("Could not copy automatically. Select the email and copy it.");
      return;
    }
    setCopiedEmail(true);
    toast("Email copied.");
    window.setTimeout(() => setCopiedEmail(false), 1800);
  }

  async function onCopyMessage() {
    const ok = await copyText(composed);
    if (!ok) {
      toast("Could not copy automatically. Select the message and copy it.");
      return;
    }
    setCopiedMessage(true);
    toast("Message copied.");
    window.setTimeout(() => setCopiedMessage(false), 1800);
  }

  return (
    <div className="contact-layout">
      <div className="contact-info-card">
        <span className="section-number">DIRECT</span>
        <a href={"mailto:" + site.email} className="contact-email">{site.email}</a>
        <p>
          The current prototype intentionally avoids storing enquiries. Your form
          opens the email app with the message composed for you.
        </p>
        <Button type="button" variant="secondary" onClick={onCopyEmail}>
          {copiedEmail ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copiedEmail ? "Copied" : "Copy email"}
        </Button>
      </div>

      <form className="contact-form-card" onSubmit={onSubmit} noValidate>
        <div className="contact-form-heading">
          <div>
            <span className="section-number">DESCRIBE THE LEAK</span>
            <h2>Give us one process.</h2>
          </div>
          <span className="form-prototype-label">Prototype intake</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mt-6">
          <Field label="Name" htmlFor="name" error={errors.name}>
            <Input id="name" name="name" autoComplete="name" value={fields.name} aria-invalid={Boolean(errors.name)} onChange={(event) => set("name", event.target.value)} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" value={fields.email} aria-invalid={Boolean(errors.email)} onChange={(event) => set("email", event.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mt-4">
          <Field label="Company" htmlFor="company" error={errors.company} optional>
            <Input id="company" name="company" autoComplete="organization" value={fields.company} aria-invalid={Boolean(errors.company)} onChange={(event) => set("company", event.target.value)} />
          </Field>
          <Field label="Problem type" htmlFor="interest">
            <select id="interest" name="interest" className="field" value={fields.interest} onChange={(event) => set("interest", event.target.value)}>
              {interests.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="What keeps falling through the cracks?" htmlFor="message" error={errors.message}>
            <Textarea id="message" name="message" value={fields.message} aria-invalid={Boolean(errors.message)} onChange={(event) => set("message", event.target.value)} />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="submit">Compose the email</Button>
          <p className="text-xs text-slate-500">No message database. No automated send.</p>
        </div>

        {composed ? (
          <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Ready to paste</p>
              <button type="button" className="btn btn-ghost h-9 px-3 text-sm" onClick={onCopyMessage}>
                {copiedMessage ? "Copied" : "Copy message"}
              </button>
            </div>
            <pre className="mt-3 max-w-full font-sans text-sm leading-relaxed whitespace-pre-wrap break-anywhere text-slate-700">{composed}</pre>
          </div>
        ) : null}
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0" htmlFor={htmlFor}>
      <span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium">
        {label}
        {optional ? <span className="text-xs font-normal text-slate-400">Optional</span> : null}
      </span>
      {children}
      {error ? <span id={htmlFor + "-error"} className="mt-1.5 block text-xs text-accent-ink">{error}</span> : null}
    </label>
  );
}
