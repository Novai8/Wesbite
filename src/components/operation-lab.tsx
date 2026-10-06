"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

const scenarios = [
  { label: "Missed enquiries", prompt: "New enquiries arrive after hours and nobody follows up until the next day.", steps: ["Capture the enquiry", "Extract the useful details", "Score urgency", "Draft the next reply", "Hold for approval"], result: "The next action is visible before the lead disappears." },
  { label: "Quote follow-up", prompt: "Quotes go out, then follow-up depends on someone remembering three days later.", steps: ["Detect quote sent", "Set follow-up window", "Check for a reply", "Draft a nudge", "Escalate silence"], result: "Follow-up becomes a timed operation instead of a memory test." },
  { label: "Lead admin", prompt: "A lead gets copied between email, Sheets and the CRM and fields keep going missing.", steps: ["Read the enquiry", "Normalize the fields", "Validate required data", "Create the record", "Flag uncertainty"], result: "One source of truth, with unclear fields stopped rather than invented." },
  { label: "Appointments", prompt: "Booking requests bounce between inboxes while someone manually checks availability.", steps: ["Parse the request", "Apply booking rules", "Propose slots", "Check conflicts", "Ask a person to confirm"], result: "Scheduling becomes a controlled sequence, not an email chain." },
];

export function OperationLab() {
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const scenario = scenarios[active];
  function choose(index: number) { setActive(index); setRunning(false); setDone(false); }
  function run() { setRunning(true); setDone(false); window.setTimeout(() => { setRunning(false); setDone(true); }, 900); }
  return <div className="lab-shell" id="lab">
    <div className="lab-topline"><span><span className="live-dot" /> OPERATION LAB</span><span>SIMULATION · NO LIVE SYSTEMS</span></div>
    <div className="lab-grid">
      <div className="lab-sidebar"><div className="lab-sidebar-title">Choose the leak</div>{scenarios.map((item,index)=><button key={item.label} type="button" className={"scenario-button"+(active===index?" is-active":"")} onClick={()=>choose(index)}><span>0{index+1}</span><strong>{item.label}</strong><ArrowUpRight aria-hidden /></button>)}<div className="lab-note"><Sparkles aria-hidden /><span>Start with the work, not the software.</span></div></div>
      <div className="lab-stage">
        <div className="stage-input"><span className="stage-tag">BUSINESS INPUT</span><AnimatePresence mode="wait"><motion.p key={scenario.prompt} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.22}}>“{scenario.prompt}”</motion.p></AnimatePresence></div>
        <div className="flow-line" aria-hidden><span/><span/><span/></div>
        <div className="stage-operation"><div className="stage-operation-head"><div><span className="stage-tag">MAPPED OPERATION</span><h3>{scenario.label}</h3></div><button type="button" className="reset-button" onClick={()=>{setRunning(false);setDone(false)}} aria-label="Reset simulation"><RotateCcw aria-hidden /></button></div>
          <div className="step-stack">{scenario.steps.map((step,index)=><motion.div key={step} className={"operation-step"+(done&&index<4?" is-done":"")} initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} transition={{delay:index*.06}}><span>{String(index+1).padStart(2,"0")}</span><strong>{step}</strong><Check aria-hidden /></motion.div>)}</div>
          <div className="lab-result"><AnimatePresence mode="wait">{running?<motion.div key="running" initial={{opacity:0}} animate={{opacity:1}} className="result-running"><span className="pulse-ring" /> Mapping operation…</motion.div>:<motion.div key={done?"done":"idle"} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}><span className="result-label">{done?"SIMULATION COMPLETE":"READY TO SIMULATE"}</span><p>{done?scenario.result:"See the sequence before anything touches a real inbox, CRM or calendar."}</p></motion.div>}</AnimatePresence></div>
          <button type="button" className="run-button" onClick={run} disabled={running}>{running?"Mapping…":done?"Run again":"Run the simulation"}<ArrowUpRight aria-hidden /></button>
        </div>
      </div>
    </div>
  </div>;
}
