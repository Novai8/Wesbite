export const niches = [
  {
    id: "agencies",
    label: "Marketing & Lead-gen Agencies",
    short: "Agencies",
    summary:
      "Qualify inbound leads, stop follow-ups when someone replies, and keep client reporting reviewable.",
  },
  {
    id: "recruitment",
    label: "Recruitment & Executive Search",
    short: "Recruitment",
    summary:
      "Turn CVs, threads, and intake notes into evidence a consultant can actually defend.",
  },
  {
    id: "services",
    label: "Small Service Businesses",
    short: "Service businesses",
    summary:
      "Draft support replies, appointment requests, and a morning brief without sending anything on its own.",
  },
] as const;

export type NicheId = (typeof niches)[number]["id"];
export type NicheLabel = (typeof niches)[number]["label"];

export type Assumptions = {
  manualMinutes: number;
  reviewMinutes: number;
  weeklyVolume: number;
  unit: string;
  notes: string;
};

export type Demo = {
  slug: string;
  title: string;
  niche: NicheLabel;
  workflowTypeTags: string[];
  outputs: string[];
  reliabilityFeatures: string[];
  shortProblem: string;
  beforeSummary: string;
  afterSummary: string;
  whatClientSees: string[];
  reliability: string[];
  assumptions: Assumptions;
  tools: string[];
  videoUrl: string;
  thumbnailUrl: string;
  youtubeUrl: string;
};

export const demos: Demo[] = [
  {
    slug: "ai-lead-qualification-crm-handover",
    title: "AI Lead Qualification & CRM Handover",
    niche: "Marketing & Lead-gen Agencies",
    workflowTypeTags: ["Lead qualification", "CRM handover"],
    outputs: ["Fit score", "CRM draft", "Routing note"],
    reliabilityFeatures: ["Human review", "Audit log", "No auto-send"],
    shortProblem:
      "Inbound leads sit in a shared inbox while reps guess fit from incomplete form fills.",
    beforeSummary:
      "A coordinator copies form fields into the CRM, skims the company name, and writes a one-line note. Unqualified leads still get a record. Better leads wait behind whoever opened the inbox first.",
    afterSummary:
      "n8n normalizes the form, drafts an ICP fit note with the fields that drove it, and holds the CRM handover until a person approves the score and the owner. Nothing is written before that approval.",
    whatClientSees: [
      "A fit score with the specific fields that raised or lowered it",
      "A CRM draft — company, contact, source, suggested next step — marked held",
      "A routing suggestion: sales, nurture, or discard",
      "A review control that is the only way the record is created",
    ],
    reliability: [
      "The CRM write is gated. A draft is not a record.",
      "Low-confidence scores are flagged instead of forced into a bucket.",
      "Each run stores the input payload, the model output, and the reviewer.",
      "The workflow does not email the prospect.",
    ],
    assumptions: {
      manualMinutes: 8,
      reviewMinutes: 2,
      weeklyVolume: 50,
      unit: "leads",
      notes: "Assumes a person checks the fit note and the CRM draft before any handover. Does not include sales conversations or CRM cleanup.",
    },
    tools: ["n8n", "OpenAI", "HubSpot", "Inbound form"],
    videoUrl: "https://www.youtube.com/embed/EdLpBw73RIw",
    thumbnailUrl: "https://i.ytimg.com/vi/EdLpBw73RIw/hqdefault.jpg",
    youtubeUrl: "https://youtu.be/EdLpBw73RIw",
  },
  {
    slug: "ai-follow-up-monitor",
    title: "AI Follow-up Monitor (Stop on Reply)",
    niche: "Marketing & Lead-gen Agencies",
    workflowTypeTags: ["Follow-up", "Reply detection"],
    outputs: ["Pause event", "Thread status", "Review queue"],
    reliabilityFeatures: ["Stop on reply", "Human review", "Audit log"],
    shortProblem:
      "Sequences keep emailing people who already replied, because nobody is watching the thread.",
    beforeSummary:
      "A coordinator checks a spreadsheet against the inbox each afternoon and manually pauses rows. Replies that land after hours still receive the next nudge.",
    afterSummary:
      "n8n watches the sending mailbox, matches a reply to the sequence, and pauses the next step. Ambiguous threads — out of office, auto-acknowledgements — wait for a person instead of being guessed.",
    whatClientSees: [
      "A thread status: replied, bounced, or still open",
      "The exact message that triggered the pause",
      "A held queue for “maybe a reply”",
      "An audit line: paused at step N, pending review",
    ],
    reliability: [
      "A detected human reply always stops the next send.",
      "Auto-replies are not treated as a conversation.",
      "The workflow never sends a new email. It only pauses.",
      "The pause, the matched message id, and the reviewer are logged.",
    ],
    assumptions: {
      manualMinutes: 3,
      reviewMinutes: 1,
      weeklyVolume: 120,
      unit: "threads",
      notes: "Assumes someone still glances at the ambiguous queue. Does not include writing the original sequence.",
    },
    tools: ["n8n", "Gmail", "OpenAI"],
    videoUrl: "https://www.youtube.com/embed/A3X_X7KRHJ4",
    thumbnailUrl: "https://i.ytimg.com/vi/A3X_X7KRHJ4/hqdefault.jpg",
    youtubeUrl: "https://youtu.be/A3X_X7KRHJ4",
  },
  {
    slug: "client-reporting-automation",
    title: "Client Reporting Automation",
    niche: "Marketing & Lead-gen Agencies",
    workflowTypeTags: ["Reporting", "Client delivery"],
    outputs: ["Report draft", "Source log", "Review status"],
    reliabilityFeatures: ["Human review", "Source trace", "No auto-send"],
    shortProblem:
      "Weekly client reports are rebuilt by hand from ads, the CRM, and a messy notes doc.",
    beforeSummary:
      "An account manager exports three tools, pastes numbers into a deck, and writes commentary the night before the call. A wrong export is easy to miss and hard to trace.",
    afterSummary:
      "n8n pulls the agreed sources, drafts a one-page narrative with a source label on every figure, and parks the report for the account owner to edit. Send stays off until they mark it reviewed.",
    whatClientSees: [
      "A one-page draft with a source name and pull time on every figure",
      "A missing-source warning instead of a blank zero",
      "A comment field for the account owner",
      "A send step that stays disabled until review is marked",
    ],
    reliability: [
      "A failed pull blocks the draft. The workflow does not invent a number.",
      "Figures stay tied to a source name and a pull time.",
      "The workflow does not email the client.",
      "The reviewed version and the person who approved it are logged.",
    ],
    assumptions: {
      manualMinutes: 90,
      reviewMinutes: 20,
      weeklyVolume: 6,
      unit: "reports",
      notes: "Assumes the sources are already connected and the narrative is edited, not rewritten from scratch. Does not include the client call.",
    },
    tools: ["n8n", "Google Sheets", "OpenAI", "Gmail"],
    videoUrl: "https://www.youtube.com/embed/ZCkYMFwCVV4",
    thumbnailUrl: "https://i.ytimg.com/vi/ZCkYMFwCVV4/hqdefault.jpg",
    youtubeUrl: "https://youtu.be/ZCkYMFwCVV4",
  },
  {
    slug: "ai-inbox-triage-for-agencies",
    title: "AI Inbox Triage for Agencies",
    niche: "Marketing & Lead-gen Agencies",
    workflowTypeTags: ["Inbox triage", "Drafting"],
    outputs: ["Label", "Draft reply", "Owner route"],
    reliabilityFeatures: ["No auto-send", "Confidence flag", "Human review"],
    shortProblem:
      "Client mail, vendor mail, and new business land in one inbox and get answered in the order they shout.",
    beforeSummary:
      "Whoever is free skims subject lines, stars a few, and replies from memory. An urgent client issue can sit under a newsletter until the afternoon.",
    afterSummary:
      "n8n classifies each thread, drafts a reply from the agency’s notes, and routes it to an owner. Unknown intent is marked for a person. Sending still requires that person.",
    whatClientSees: [
      "A label: client, lead, vendor, or noise",
      "Urgency, plus the sentence that justified it",
      "A draft reply the owner can edit",
      "A “do not answer” suggestion for newsletters — never an auto-archive of client mail",
    ],
    reliability: [
      "Client-labeled mail cannot be auto-archived.",
      "Drafts are not sent.",
      "Unknown intent is marked “needs a person”, not guessed.",
      "Low-confidence labels are flagged before anyone treats them as fact.",
    ],
    assumptions: {
      manualMinutes: 4,
      reviewMinutes: 1,
      weeklyVolume: 80,
      unit: "emails",
      notes: "Assumes the owner still edits the draft. Does not include the time spent on the actual client work the email describes.",
    },
    tools: ["n8n", "Gmail", "OpenAI"],
    videoUrl: "https://www.youtube.com/embed/tLnd9kEnQFc",
    thumbnailUrl: "https://i.ytimg.com/vi/tLnd9kEnQFc/hqdefault.jpg",
    youtubeUrl: "https://youtu.be/tLnd9kEnQFc",
  },
  {
    slug: "candidate-profile-generator",
    title: "Candidate Profile Generator",
    niche: "Recruitment & Executive Search",
    workflowTypeTags: ["Profile generation", "Standardization"],
    outputs: ["Standard profile", "Gap list", "Source snippets"],
    reliabilityFeatures: ["Source trace", "Human review", "PII minimization"],
    shortProblem:
      "Search profiles are rewritten from scratch for every CV, so clients see a different format every time.",
    beforeSummary:
      "A researcher reads a CV and a few notes, then types a profile in whatever structure they remember. Gaps get smoothed over in prose so the page looks finished.",
    afterSummary:
      "n8n extracts a fixed profile from the CV text and the researcher notes, and leaves a field blank when the source does not state it. A consultant approves the profile before it is shared.",
    whatClientSees: [
      "A standard profile: scope, sector, locations, and compensation only if stated",
      "Explicit “not in source” fields instead of filled guesses",
      "The source snippet next to each extracted line",
      "A share step that stays off until approval",
    ],
    reliability: [
      "Missing fields stay empty.",
      "Compensation is copied only when the source states it.",
      "The approved profile and the source file id are logged.",
      "The workflow does not contact the candidate or the client.",
    ],
    assumptions: {
      manualMinutes: 25,
      reviewMinutes: 6,
      weeklyVolume: 15,
      unit: "profiles",
      notes: "Assumes the CV text is already available to the workflow. Does not include interviews or reference calls.",
    },
    tools: ["n8n", "OpenAI", "Google Docs"],
    videoUrl: "https://www.youtube.com/embed/_lIu3VDMHDk",
    thumbnailUrl: "https://i.ytimg.com/vi/_lIu3VDMHDk/hqdefault.jpg",
    youtubeUrl: "https://youtu.be/_lIu3VDMHDk",
  },
  {
    slug: "candidate-to-role-evidence-analysis",
    title: "Candidate-to-Role Evidence Analysis",
    niche: "Recruitment & Executive Search",
    workflowTypeTags: ["Evidence analysis", "Scoring"],
    outputs: ["Evidence table", "Gap questions", "Review hold"],
    reliabilityFeatures: ["Source trace", "Human review", "Audit log"],
    shortProblem:
      "Shortlists argue from memory instead of a visible map between the role and the candidate.",
    beforeSummary:
      "A consultant highlights a CV and writes “strong fit” in an email. The client cannot see which requirements were actually evidenced, or which were skipped.",
    afterSummary:
      "n8n lines each role requirement up against the CV and interview notes, marks evidenced, partial, or absent, and holds the note for the search lead. It does not issue a hire recommendation.",
    whatClientSees: [
      "A requirement-by-requirement table",
      "An evidence quote, or “no evidence in packet”",
      "A suggested interview question for each gap",
      "No overall hire recommendation — that stays with the consultant",
    ],
    reliability: [
      "A requirement cannot be marked evidenced without a quote.",
      "Interview notes and the CV are labeled as separate sources.",
      "The analysis is not sent to the client automatically.",
      "The packet id, the table, and the reviewer are stored together.",
    ],
    assumptions: {
      manualMinutes: 35,
      reviewMinutes: 10,
      weeklyVolume: 12,
      unit: "comparisons",
      notes: "Assumes a written role brief already exists. Does not include the client debrief.",
    },
    tools: ["n8n", "OpenAI", "Google Docs"],
    videoUrl: "https://www.youtube.com/embed/fleVKn86PKs",
    thumbnailUrl: "https://i.ytimg.com/vi/fleVKn86PKs/hqdefault.jpg",
    youtubeUrl: "https://youtu.be/fleVKn86PKs",
  },
  {
    slug: "search-inbox-assistant",
    title: "Search Inbox Assistant (Thread Summary → Next Actions)",
    niche: "Recruitment & Executive Search",
    workflowTypeTags: ["Inbox triage", "Next actions"],
    outputs: ["Thread summary", "Open asks", "Next action"],
    reliabilityFeatures: ["Human review", "PII minimization", "Audit log"],
    shortProblem:
      "Search threads sprawl across candidates, clients, and references, and the next action lives in someone’s head.",
    beforeSummary:
      "A consultant re-reads a long thread before each call and writes the next step in a notebook. Handoffs drop the context, and open asks get answered twice or not at all.",
    afterSummary:
      "n8n summarizes the thread, lists open asks tied to a message, and proposes a next action with an owner. Nothing is sent or scheduled until a person confirms the plan.",
    whatClientSees: [
      "A six-line thread summary",
      "Open asks, each tied to a message",
      "A proposed next action: reply, chase, or wait",
      "A confirm control before the suggestion is kept as the plan of record",
    ],
    reliability: [
      "The summary cites message dates instead of blending the thread into one story.",
      "Proposed actions are suggestions, not sends.",
      "Confidential attachments are listed by name and are not extracted into the summary by default.",
      "Confirmation records who accepted the next action.",
    ],
    assumptions: {
      manualMinutes: 6,
      reviewMinutes: 2,
      weeklyVolume: 40,
      unit: "threads",
      notes: "Assumes a person still confirms the next action. Does not include the call itself.",
    },
    tools: ["n8n", "Gmail", "OpenAI"],
    videoUrl: "https://www.youtube.com/embed/Ny1v86BzkNM",
    thumbnailUrl: "https://i.ytimg.com/vi/Ny1v86BzkNM/hqdefault.jpg",
    youtubeUrl: "https://youtu.be/Ny1v86BzkNM",
  },
  {
    slug: "search-launch-preparation-assistant",
    title: "Search Launch Preparation Assistant",
    niche: "Recruitment & Executive Search",
    workflowTypeTags: ["Search prep", "Briefing"],
    outputs: ["Search brief", "Target skeleton", "Outreach draft"],
    reliabilityFeatures: ["No auto-send", "Human review", "Audit log"],
    shortProblem:
      "Kicking off a search means rebuilding the same brief, target skeleton, and outreach draft under time pressure.",
    beforeSummary:
      "A researcher copies last month’s brief, swaps the title, and hopes the must-haves survived. Outreach sometimes goes out before the hiring manager has signed the brief.",
    afterSummary:
      "n8n turns the intake notes into a one-page brief, a target-company skeleton, and an outreach draft, then waits for the search lead to approve the pack. No people are contacted.",
    whatClientSees: [
      "A one-page brief with must-haves and exclusions",
      "A target-list skeleton of companies, not scraped people",
      "An outreach draft marked “not approved to send”",
      "A checklist of what the hiring manager still needs to confirm",
    ],
    reliability: [
      "No people are contacted.",
      "Exclusions in the intake notes are repeated, not dropped.",
      "The pack is versioned when the lead edits it.",
      "The outreach draft cannot be marked sent from this workflow.",
    ],
    assumptions: {
      manualMinutes: 70,
      reviewMinutes: 20,
      weeklyVolume: 3,
      unit: "launches",
      notes: "Assumes intake notes already exist. Does not include sourcing or the hiring-manager workshop.",
    },
    tools: ["n8n", "OpenAI", "Google Docs"],
    videoUrl: "https://www.youtube.com/embed/A-tz0yCfdio",
    thumbnailUrl: "https://i.ytimg.com/vi/A-tz0yCfdio/hqdefault.jpg",
    youtubeUrl: "https://youtu.be/A-tz0yCfdio",
  },
  {
    slug: "customer-support-email-agent",
    title: "Customer Support Email Agent",
    niche: "Small Service Businesses",
    workflowTypeTags: ["Drafting", "Escalation"],
    outputs: ["Draft reply", "Match status", "Escalation card"],
    reliabilityFeatures: ["Human review", "Escalation path", "No auto-send"],
    shortProblem:
      "The owner answers the same support questions at night, and anything unfamiliar gets a rushed guess.",
    beforeSummary:
      "Every email is read in full. Known answers are retyped. Unknown issues are guessed so the inbox looks clear, and a wrong refund promise is hard to unwind.",
    afterSummary:
      "n8n matches the email to a short approved answer set, drafts a reply, and escalates anything outside that set. Refunds and complaints always escalate. The owner sends.",
    whatClientSees: [
      "A matched answer, or “not in the answer set”",
      "A draft the owner can edit",
      "An escalation card for refunds, complaints, and anything not covered",
      "A send step that is manual",
    ],
    reliability: [
      "If it is not in the answer set, the draft is withheld.",
      "Refunds and complaints always escalate.",
      "The workflow itself does not send.",
      "The match status and the escalation reason are logged.",
    ],
    assumptions: {
      manualMinutes: 7,
      reviewMinutes: 2,
      weeklyVolume: 60,
      unit: "emails",
      notes: "Assumes a short approved answer set already exists. Does not include resolving the underlying job.",
    },
    tools: ["n8n", "Gmail", "OpenAI"],
    videoUrl: "https://www.youtube.com/embed/SLDwego-pKA",
    thumbnailUrl: "https://i.ytimg.com/vi/SLDwego-pKA/hqdefault.jpg",
    youtubeUrl: "https://youtu.be/SLDwego-pKA",
  },
  {
    slug: "appointment-request-automation",
    title: "Appointment Request Automation",
    niche: "Small Service Businesses",
    workflowTypeTags: ["Scheduling", "Intake"],
    outputs: ["Parsed request", "Proposed slots", "Confirm hold"],
    reliabilityFeatures: ["Human review", "No auto-send", "Audit log"],
    shortProblem:
      "Booking requests arrive as prose, and the calendar is confirmed by a chain of “does Tuesday work?” emails.",
    beforeSummary:
      "Someone reads the email, checks a calendar, and replies with two times. Double-books happen when two people reply to two requests in the same hour.",
    afterSummary:
      "n8n extracts the request, proposes slots from stated rules, and holds the reply until a person confirms the slot is actually free. It does not write to the calendar.",
    whatClientSees: [
      "A parsed request: service, preferred window, location",
      "Two proposed slots, or “rules could not find a slot”",
      "A confirm control before any reply is sent",
      "A conflict flag if the notes mention an existing booking",
    ],
    reliability: [
      "The workflow does not write to the calendar.",
      "Ambiguous dates are asked, not assumed.",
      "The confirmed slot and the person who confirmed it are logged.",
      "No reply leaves until confirmation.",
    ],
    assumptions: {
      manualMinutes: 5,
      reviewMinutes: 1,
      weeklyVolume: 25,
      unit: "requests",
      notes: "Assumes booking rules are written down. Does not include travel time or the appointment itself.",
    },
    tools: ["n8n", "Gmail", "Google Calendar", "OpenAI"],
    videoUrl: "https://www.youtube.com/embed/ctzsYA_sEmU",
    thumbnailUrl: "https://i.ytimg.com/vi/ctzsYA_sEmU/hqdefault.jpg",
    youtubeUrl: "https://youtu.be/ctzsYA_sEmU",
  },
  {
    slug: "ai-document-intake",
    title: "AI Document Intake",
    niche: "Small Service Businesses",
    workflowTypeTags: ["Document intake", "Extraction"],
    outputs: ["Field extract", "Checklist", "Missing-items draft"],
    reliabilityFeatures: ["Source trace", "Human review", "Audit log"],
    shortProblem:
      "New customers email a pile of documents, and missing pages are noticed days later.",
    beforeSummary:
      "An admin opens each file, types fields into a sheet, and replies “looks good” before the checklist is actually complete. A missing page shows up when the work has already started.",
    afterSummary:
      "n8n extracts the agreed fields, compares them to a required checklist, and drafts a missing-items note for a person to send. Unreadable files are named, not skipped.",
    whatClientSees: [
      "Extracted fields with the file they came from",
      "A checklist: present, unreadable, or missing",
      "A draft “please send these” note, unsent",
      "Unreadable files called out by name",
    ],
    reliability: [
      "A failed extraction is “unreadable”, never a blank success.",
      "The draft is not emailed automatically.",
      "Original filenames and a run id are stored with the extraction.",
      "A person reviews the checklist before any customer reply.",
    ],
    assumptions: {
      manualMinutes: 12,
      reviewMinutes: 3,
      weeklyVolume: 20,
      unit: "packets",
      notes: "Assumes a written checklist of required fields. Does not include chasing the customer after the note is sent.",
    },
    tools: ["n8n", "Gmail", "OpenAI", "Google Drive"],
    videoUrl: "https://www.youtube.com/embed/aNd9a-ix8_o",
    thumbnailUrl: "https://i.ytimg.com/vi/aNd9a-ix8_o/hqdefault.jpg",
    youtubeUrl: "https://youtu.be/aNd9a-ix8_o",
  },
  {
    slug: "daily-executive-operations-brief",
    title: "Daily Executive Operations Brief",
    niche: "Small Service Businesses",
    workflowTypeTags: ["Briefing", "Operations"],
    outputs: ["Decision list", "Awareness list", "Source status"],
    reliabilityFeatures: ["Human review", "Audit log", "Source trace"],
    shortProblem:
      "The owner starts the day by hunting through mail, bookings, and yesterday’s notes for what actually needs a decision.",
    beforeSummary:
      "Half an hour of tab-switching produces a mental list nobody else can see. Items without a number get forgotten, and awareness updates get mixed into decisions.",
    afterSummary:
      "n8n assembles a one-screen brief from the agreed sources and separates “needs a decision” from “for awareness”. The owner marks it read. Nothing is actioned for them.",
    whatClientSees: [
      "Three to seven decision items, each with a source",
      "An awareness list that is not mixed into decisions",
      "A “source failed” line if a feed did not run",
      "A mark-as-read control, not a “do it” button",
    ],
    reliability: [
      "The brief does not send emails or change bookings.",
      "Empty sections stay empty rather than filled with filler.",
      "Each item keeps a source record id in the log.",
      "A failed source is shown as failed. It is not silently dropped.",
    ],
    assumptions: {
      manualMinutes: 30,
      reviewMinutes: 8,
      weeklyVolume: 5,
      unit: "briefs",
      notes: "Assumes the agreed sources are already connected. Does not include the decisions themselves.",
    },
    tools: ["n8n", "Gmail", "Google Calendar", "OpenAI"],
    videoUrl: "https://www.youtube.com/embed/ls2zzeltX2o",
    thumbnailUrl: "https://i.ytimg.com/vi/ls2zzeltX2o/hqdefault.jpg",
    youtubeUrl: "https://youtu.be/ls2zzeltX2o",
  },
];

export const workflowTypes = Array.from(
  new Set(demos.flatMap((demo) => demo.workflowTypeTags)),
);

export const reliabilityFeatures = Array.from(
  new Set(demos.flatMap((demo) => demo.reliabilityFeatures)),
);

export function nicheById(id: string) {
  return niches.find((niche) => niche.id === id);
}

export function nicheIdFor(label: NicheLabel): NicheId {
  const match = niches.find((niche) => niche.label === label);
  return match?.id ?? "agencies";
}

export function getDemo(slug: string) {
  return demos.find((demo) => demo.slug === slug);
}

export function demoIndex(slug: string) {
  return demos.findIndex((demo) => demo.slug === slug);
}

export function relatedDemos(slug: string, limit = 2) {
  const current = getDemo(slug);
  if (!current) return [];
  return demos
    .filter((demo) => demo.slug !== slug && demo.niche === current.niche)
    .slice(0, limit);
}

export function illustrativeSavings(assumptions: Assumptions) {
  const perItem = Math.max(
    0,
    assumptions.manualMinutes - assumptions.reviewMinutes,
  );
  const weeklyMinutes = perItem * assumptions.weeklyVolume;
  return {
    perItem,
    weeklyMinutes,
    weeklyHours: weeklyMinutes / 60,
  };
}

export function formatHours(hours: number) {
  return (Math.round(hours * 10) / 10).toFixed(1);
}

export type FilterState = {
  q: string;
  niche: "all" | NicheId;
  tags: string[];
  rel: string[];
  preview: string | null;
};

export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): FilterState {
  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  const many = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value : value ? [value] : [];
  const nicheRaw = one(sp.niche);
  const niche =
    nicheRaw === "agencies" ||
    nicheRaw === "recruitment" ||
    nicheRaw === "services"
      ? nicheRaw
      : "all";

  return {
    q: one(sp.q),
    niche,
    tags: many(sp.tag).filter((tag) => workflowTypes.includes(tag)),
    rel: many(sp.rel).filter((item) => reliabilityFeatures.includes(item)),
    preview: one(sp.preview) || null,
  };
}

export function filtersToQuery(filters: FilterState) {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q) params.set("q", q);
  if (filters.niche !== "all") params.set("niche", filters.niche);
  for (const tag of filters.tags) params.append("tag", tag);
  for (const item of filters.rel) params.append("rel", item);
  if (filters.preview) params.set("preview", filters.preview);
  return params.toString();
}

export function filterDemos(filters: FilterState) {
  const query = filters.q.trim().toLowerCase();
  return demos.filter((demo) => {
    if (filters.niche !== "all" && nicheIdFor(demo.niche) !== filters.niche) {
      return false;
    }
    if (
      filters.tags.length > 0 &&
      !filters.tags.some((tag) => demo.workflowTypeTags.includes(tag))
    ) {
      return false;
    }
    if (
      filters.rel.length > 0 &&
      !filters.rel.some((item) => demo.reliabilityFeatures.includes(item))
    ) {
      return false;
    }
    if (!query) return true;
    const haystack = [
      demo.title,
      demo.niche,
      demo.shortProblem,
      demo.beforeSummary,
      demo.afterSummary,
      ...demo.workflowTypeTags,
      ...demo.outputs,
      ...demo.reliabilityFeatures,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}
