"use client";

import { useState, type FormEvent } from "react";
import { Check, Copy } from "lucide-react";
import { usePrefs } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { demos } from "@/data/demos";
import { contactBody, contactMailto, site } from "@/lib/site";

type Fields = {
  name: string;
  email: string;
  company: string;
  interest: string;
  message: string;
};

const empty: Fields = {
  name: "",
  email: "",
  company: "",
  interest: "General enquiry",
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
    else if (next.name.trim().length > 80) nextErrors.name = "Keep the name under 80 characters.";
    if (!next.email.trim()) nextErrors.email = "Add an email so Hussnain can reply.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email.trim())) {
      nextErrors.email = "That email does not look complete.";
    }
    if (next.company.trim().length > 80) {
      nextErrors.company = "Keep the company under 80 characters.";
    }
    if (!next.message.trim()) nextErrors.message = "Add a short note about the workflow.";
    else if (next.message.trim().length > 2000) {
      nextErrors.message = "Keep the note under 2000 characters.";
    }
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
    toast("Opening your email app. If it does not open, copy the message below.");
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
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="surface h-fit p-5 sm:p-6">
        <p className="text-xs font-medium tracking-[0.16em] text-accent-ink uppercase">
          Direct
        </p>
        <a
          href={`mailto:${site.email}`}
          className="mt-3 block text-xl font-medium tracking-tight break-anywhere"
        >
          {site.email}
        </a>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The form opens your email app. This site does not store the message
          and does not need any mail API key.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-5"
          onClick={onCopyEmail}
        >
          {copiedEmail ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {copiedEmail ? "Copied" : "Copy email"}
        </Button>
      </div>

      <form className="surface p-5 sm:p-6" onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              value={fields.name}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-error" : undefined}
              onChange={(event) => set("name", event.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={fields.email}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              onChange={(event) => set("email", event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Company" htmlFor="company" error={errors.company} optional>
            <Input
              id="company"
              name="company"
              autoComplete="organization"
              value={fields.company}
              aria-invalid={Boolean(errors.company)}
              aria-describedby={errors.company ? "company-error" : undefined}
              onChange={(event) => set("company", event.target.value)}
            />
          </Field>
          <Field label="Interest" htmlFor="interest">
            <select
              id="interest"
              name="interest"
              className="field"
              value={fields.interest}
              onChange={(event) => set("interest", event.target.value)}
            >
              <option>General enquiry</option>
              {demos.map((demo) => (
                <option key={demo.slug}>{demo.title}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="What should the workflow hold for review?" htmlFor="message" error={errors.message}>
            <Textarea
              id="message"
              name="message"
              value={fields.message}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? "message-error" : undefined}
              onChange={(event) => set("message", event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="submit">Email Hussnain</Button>
          <p className="text-xs text-slate-500">Opens your mail app. Nothing is stored here.</p>
        </div>
        {composed ? (
          <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Ready to paste</p>
              <button type="button" className="btn btn-ghost h-9 px-3 text-sm" onClick={onCopyMessage}>
                {copiedMessage ? "Copied" : "Copy message"}
              </button>
            </div>
            <pre className="mt-3 max-w-full font-sans text-sm leading-relaxed whitespace-pre-wrap break-anywhere text-slate-700">
              {composed}
            </pre>
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
      {error ? (
        <span id={`${htmlFor}-error`} className="mt-1.5 block text-xs text-accent-ink">
          {error}
        </span>
      ) : null}
    </label>
  );
}
