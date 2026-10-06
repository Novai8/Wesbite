"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, CircleAlert, Play, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

type Scenario = {
  label: string;
  problem: string;
  signal: string;
  outcome: string;
  steps: string[];
};

const scenarios: Scenario[] = [
  {
    label: "Missed calls",
    problem: "Leads are disappearing when nobody answers the phone.",
    signal: "Missed lead capture",
    outcome: "Every missed enquiry gets a controlled next step.",
    steps: ["Capture the caller", "Send an immediate response", "Qualify the request", "Escalate or book", "Log the outcome"],
  },
  {
    label: "Quote follow-up",
    problem: "Quotes get sent, then nobody remembers to follow up.",
    signal: "Follow-up leak",
    outcome: "Quotes get a timed next step without relying on memory.",
    steps: ["Find open quotes", "Check timing rules", "Draft the follow-up", "Hold for approval", "Log the decision"],
  },
  {
    label: "Lead admin",
    problem: "New enquiries are copied from email into spreadsheets by hand.",
    signal: "Manual intake",
    outcome: "Every new lead enters the right pipeline with a traceable record.",
    steps: ["Read the enquiry", "Extract key fields", "Validate the record", "Route by rules", "Create an audit event"],
  },
  {
    label: "Appointments",
    problem: "Booking requests bounce between inboxes and calendars.",
    signal: "Scheduling friction",
    outcome: "Requests become structured options before anyone confirms a slot.",
    steps: ["Parse the request", "Apply booking rules", "Propose valid slots", "Hold for approval", "Record the confirmation"],
  },
  {
    label: "Support",
    problem: "The same customer questions keep consuming the team's attention.",
    signal: "Repeated support",
    outcome: "Known questions become drafts and edge cases reach a person.",
    steps: ["Classify the message", "Match approved answers", "Draft the response", "Escalate exceptions", "Log what happened"],
  },
];

function chooseScenario(input: string): Scenario {
  const q = input.toLowerCase();
  if (q.includes("call") || q.includes("phone") || q.includes("missed")) return scenarios[0];
  if (q.includes("quote") || q.includes("estimate") || q.includes("follow up")) return scenarios[1];
  if (q.includes("lead") || q.includes("spreadsheet") || q.includes("inquiry") || q.includes("enquiry")) return scenarios[2];
  if (q.includes("appointment") || q.includes("booking") || q.includes("calendar")) return scenarios[3];
  if (q.includes("support") || q.includes("customer") || q.includes("email")) return scenarios[4];
  return { ...scenarios[2], problem: input.trim() || scenarios[2].problem, outcome: "A first-pass operation is mapped from the work you described." };
}

export function ProblemConsole() {
  const reduce = useReducedMotion();
  const [input, setInput] = useState("Our team keeps missing customer enquiries after business hours.");
  const [scenario, setScenario] = useState<Scenario>(scenarios[0]);
  const [running, setRunning] = useState(false);

  function analyze() {
    setScenario(chooseScenario(input));
    setRunning(true);
    window.setTimeout(() => setRunning(false), 1300);
  }

  function reset() {
    setInput("");
    setScenario(scenarios[0]);
    setRunning(false);
  }

  return (
    <div className="problem-console" aria-label="Interactive business problem prototype">
      <div className="console-topline">
        <div>
          <span className="console-kicker"><span className="status-dot" aria-hidden /> RAPIGENTS PROTOTYPE</span>
          <p className="console-caption">No systems connected. Simulation only.</p>
        </div>
        <span className="console-status">{running ? "Prototype running" : "Prototype ready"}</span>
      </div>

      <div className="console-input-wrap">
        <label htmlFor="problem-input" className="console-label">Describe the work that keeps breaking</label>
        <textarea
          id="problem-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={4}
          className="console-input"
          placeholder="Example: every new enquiry gets copied into a spreadsheet and some never get followed up."
        />
        <div className="console-actions">
          <div className="console-example-row">
            {scenarios.slice(0, 3).map((item) => (
              <button key={item.label} type="button" className="console-example" onClick={() => { setInput(item.problem); setScenario(item); setRunning(false); }}>
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className="run-button" onClick={analyze}>
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
            Analyze
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={scenario.signal + scenario.problem}
          className="console-result"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: .38, ease: [.22, 1, .36, 1] }}
        >
          <div className="result-heading">
            <div>
              <span className="result-eyebrow">Detected problem</span>
              <h3>{scenario.signal}</h3>
            </div>
            <CircleAlert className="h-5 w-5 text-accent" aria-hidden />
          </div>

          <p className="result-problem">{scenario.problem}</p>

          <div className="operation-flow">
            {scenario.steps.map((step, index) => (
              <motion.div
                key={step}
                className="operation-node"
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: .28, delay: reduce ? 0 : index * .07, ease: [.22, 1, .36, 1] }}
              >
                <span className="operation-index">{String(index + 1).padStart(2, "0")}</span>
                <span>{step}</span>
                {index < scenario.steps.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-slate-300" aria-hidden /> : null}
              </motion.div>
            ))}
          </div>

          <div className="result-footer">
            <div className="result-outcome"><Check className="h-4 w-4" aria-hidden /><span>{scenario.outcome}</span></div>
            <button type="button" className="reset-button" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="console-footnote">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        <span>Built to expose the operation before deployment. Human approval stays in the loop.</span>
      </div>
    </div>
  );
}
