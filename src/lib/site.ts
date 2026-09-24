export const site = {
  name: "Rapigents",
  owner: "Hussnain Tariq",
  email: "hussnain@rapigents.online",
  github: "https://github.com/Novai8",
  githubRepo: "https://github.com/Novai8/Wesbite",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://rapigents.online",
  title: "Rapigents — AI Workflow Automation Demos",
  description:
    "Niche-specific, before-and-after n8n automation demos with reliability, human review, and audit logs. Independent portfolio prototype. Fictional data.",
  disclaimerTitle: "Independent Portfolio Prototype • Fictional Data",
  disclaimerBody:
    "Time-saved figures are illustrative assumptions. Actual results vary.",
} as const;

export const toolLinks: Record<string, string> = {
  n8n: "https://n8n.io",
  OpenAI: "https://openai.com",
  Gmail: "https://workspace.google.com/products/gmail/",
  HubSpot: "https://www.hubspot.com",
  "Google Sheets": "https://www.google.com/sheets/about/",
  "Google Docs": "https://www.google.com/docs/about/",
  "Google Drive": "https://www.google.com/drive/",
  "Google Calendar": "https://calendar.google.com",
};

export function workflowMailto(title: string) {
  const subject = `[Workflow Request] ${title}`;
  const body = [
    "Hello Hussnain,",
    "",
    "I would like to request this workflow:",
    title,
    "",
    "A little context:",
    "",
  ].join("\n");
  return `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function contactMailto(fields: {
  name: string;
  email: string;
  company: string;
  interest: string;
  message: string;
}) {
  const subject = `[Contact] ${fields.name}`;
  const body = [
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    `Company: ${fields.company || "—"}`,
    `Interest: ${fields.interest || "General"}`,
    "",
    fields.message,
  ].join("\n");
  return `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function contactBody(fields: {
  name: string;
  email: string;
  company: string;
  interest: string;
  message: string;
}) {
  return [
    `To: ${site.email}`,
    `Subject: [Contact] ${fields.name}`,
    "",
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    `Company: ${fields.company || "—"}`,
    `Interest: ${fields.interest || "General"}`,
    "",
    fields.message,
  ].join("\n");
}
