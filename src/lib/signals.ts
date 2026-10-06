export type Signal = {
  id: string;
  n: string;
  label: string;
  drop: number;
  trigger: string;
  steps: string[];
  human: string;
};

export const signals: Signal[] = [
  { id: "missed-enquiry", n: "01", label: "MISSED ENQUIRY", drop: 34, trigger: "An enquiry lands at 10:42 and nobody owns the next step.", steps: ["Capture", "Classify", "Qualify", "Draft", "Review", "Respond", "Log"], human: "A person reviews the draft before anything is sent." },
  { id: "quote-waiting", n: "02", label: "QUOTE WAITING", drop: 56, trigger: "A quote went out three days ago and follow-up depends on memory.", steps: ["Detect", "Wait", "Check", "Nudge", "Escalate"], human: "A person approves any nudge before it reaches the client." },
  { id: "lead-unqualified", n: "03", label: "LEAD UNQUALIFIED", drop: 28, trigger: "A lead sits in a spreadsheet with half its fields missing.", steps: ["Extract", "Validate", "Enrich", "Record", "Flag"], human: "Uncertain fields stop and wait for a person." },
  { id: "booking-pending", n: "04", label: "BOOKING PENDING", drop: 50, trigger: "A booking request bounces between inboxes while availability is checked by hand.", steps: ["Parse", "Check", "Propose", "Confirm", "Calendar"], human: "A person confirms the slot before it is booked." },
  { id: "reply-required", n: "05", label: "REPLY REQUIRED", drop: 38, trigger: "The same question arrives again and someone retypes the answer.", steps: ["Detect", "Classify", "Draft", "Review", "Send"], human: "Low-confidence questions are routed to a person." },
];
