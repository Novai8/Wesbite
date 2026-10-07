export const site = {
  name: "Rapigents",
  owner: "Hussnain Tariq",
  email: "hussnain@rapigents.com",
  github: "https://github.com/Novai8",
  githubRepo: "https://github.com/Novai8/Wesbite",
  linkedin: "https://www.linkedin.com/in/spell-automation/",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://rapigents.com",
  title: "Rapigents | Turn messy work into clear operations",
  description:
    "Rapigents decodes repetitive business work into clear, reviewable operations. Start with the leak, simulate the sequence, then build the fix.",
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

type ContactFields = { name: string; email: string; company: string; interest: string; message: string };

function contactMessage(fields: ContactFields) {
  return ["Name: " + fields.name, "Email: " + fields.email, "Company: " + (fields.company || "—"), "Problem type: " + (fields.interest || "General"), "", "What keeps falling through the cracks:", "", fields.message].join("\n");
}

function contactSubject(fields: ContactFields) {
  return "[Rapigents] Problem — " + fields.name;
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
