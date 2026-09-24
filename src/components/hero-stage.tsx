"use client";

import { motion, useReducedMotion } from "framer-motion";

const steps = [
  {
    index: "01",
    title: "Form received",
    detail: "Northwind Dental · web form · fictional",
  },
  {
    index: "02",
    title: "Fit note drafted",
    detail: "Evidence listed. Score held, not sent.",
  },
  {
    index: "03",
    title: "Waiting on a person",
    detail: "CRM write stays off until review.",
  },
];

export function HeroStage() {
  const reduce = useReducedMotion();
  return (
    <div className="surface relative overflow-hidden p-5 sm:p-6" aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium tracking-[0.16em] text-slate-500 uppercase">
          Sample run
        </p>
        <p className="text-[11px] font-medium tracking-[0.16em] text-accent-ink uppercase">
          Fictional
        </p>
      </div>
      <div className="relative mt-6 space-y-0">
        <span className="absolute top-3 bottom-3 left-[15px] w-px bg-line" />
        {steps.map((step, index) => (
          <motion.div
            key={step.index}
            className="relative flex gap-4 py-3"
            initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              duration: 0.5,
              delay: 0.15 + index * 0.12,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <span
              className={`relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[11px] font-medium ${
                index === 2
                  ? "border-accent bg-accent text-ink"
                  : "border-line bg-white text-slate-500"
              }`}
            >
              {step.index}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="mt-0.5 text-sm text-muted">{step.detail}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
        <p className="text-xs text-slate-600">Audit · 3 events · no send</p>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent-ink">
          Held
        </span>
      </div>
    </div>
  );
}
