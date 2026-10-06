export const site = {
  name: "Rapigents",
  owner: "Hussnain Tariq",
  email: "hussnain@rapigents.com",
  github: "https://github.com/Novai8",
  githubRepo: "https://github.com/Novai8/Wesbite",
  linkedin: "https://www.linkedin.com/in/spell-automation/",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://rapigents.com",
  title: "Rapigents | Business Operations, Built Around the Problem",
  description:
    "Rapigents turns repetitive business problems into visible, reviewable AI operations. Prototype-first, human-approved, and built around the work itself.",
  disclaimerTitle: "Independent Portfolio Prototype • Fictional Data",
  disclaimerBody: "Time and outcome figures are illustrative assumptions, not measured client results.",
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
  const subject = "[Rapigents] Adapt this operation — " + title;
  const body = ["Hello Hussnain,", "", "I want to adapt this Rapigents operation:", title, "", "The current process / problem:", "", "What should remain under human approval:", ""].join("\n");
  return "mailto:" + site.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
}

export function contactMailto(fields: { name: string; email: string; company: string; interest: string; message: string }) {
  const subject = "[Rapigents] Problem — " + fields.name;
  const body = ["Name: " + fields.name, "Email: " + fields.email, "Company: " + (fields.company || "—"), "Problem type: " + (fields.interest || "General"), "", "What keeps falling through the cracks:", "", fields.message].join("\n");
  return "mailto:" + site.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
}

export function contactBody(fields: { name: string; email: string; company: string; interest: string; message: string }) {
  return ["To: " + site.email, "Subject: [Rapigents] Problem — " + fields.name, "", "Name: " + fields.name, "Email: " + fields.email, "Company: " + (fields.company || "—"), "Problem type: " + (fields.interest || "General"), "", "What keeps falling through the cracks:", fields.message].join("\n");
}

export function contactGmailCompose(fields: { name: string; email: string; company: string; interest: string; message: string }) {
  const subject = "[Rapigents] Problem — " + fields.name;
  const body = contactBody(fields);
  return "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(site.email) + "&su=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
}
