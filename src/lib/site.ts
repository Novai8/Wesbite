export const site = {
  name: "Rapigents",
  owner: "Hussnain Tariq",
  email: "hussnain@rapigents.com",
  github: "https://github.com/Novai8",
  githubRepo: "https://github.com/Novai8/Wesbite",
  linkedin: "https://www.linkedin.com/in/spell-automation/",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://rapigents.com",
  title: "Rapigents | AI tools for everyday work",
  description:
    "Rapigents is a practical collection of AI-powered helpers and browser utilities for writing, research, study, data cleanup, and everyday tasks.",
  disclaimerTitle: "Rapigents AI Tools",
  disclaimerBody: "Practical AI helpers and browser-based utilities for everyday tasks.",
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
  const subject = "[Rapigents] Tool feedback — " + title;
  const body = ["Hello Hussnain,", "", "I have feedback or a question about this Rapigents tool:", title, "", "Details:", ""].join("\n");
  return "mailto:" + site.email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
}

type ContactFields = { name: string; email: string; company: string; interest: string; message: string };

function contactMessage(fields: ContactFields) {
  return ["Name: " + fields.name, "Email: " + fields.email, "Company: " + (fields.company || "—"), "Topic: " + (fields.interest || "General"), "", "Message:", "", fields.message].join("\n");
}

function contactSubject(fields: ContactFields) {
  return "[Rapigents] Tool feedback — " + fields.name;
}

/** mailto: link for visitors who do not use Gmail. */
export function contactMailto(fields: ContactFields) {
  return "mailto:" + site.email + "?subject=" + encodeURIComponent(contactSubject(fields)) + "&body=" + encodeURIComponent(contactMessage(fields));
}

/** Full text (with To / Subject header) shown in the "ready to paste" box. */
export function contactBody(fields: ContactFields) {
  return ["To: " + site.email, "Subject: " + contactSubject(fields), "", contactMessage(fields)].join("\n");
}

/** Gmail compose URL. To and Subject are separate fields, so the body carries only the message. */
export function contactGmailCompose(fields: ContactFields) {
  return "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(site.email) + "&su=" + encodeURIComponent(contactSubject(fields)) + "&body=" + encodeURIComponent(contactMessage(fields));
}
