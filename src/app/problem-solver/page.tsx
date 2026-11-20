import type { Metadata } from "next";
import { ProblemSolverForm } from "@/components/problem-solver-form";

export const metadata: Metadata = {
  title: "Problem solver",
  description:
    "Stuck on an annoying daily problem? Describe it and Fyndra finds the cheap, specific products that fix it.",
};

const examples = [
  { problem: "Cables everywhere behind the TV", fix: "Cable organiser kits and under-desk trays" },
  { problem: "Kitchen counter has no space", fix: "Over-door shelves and stackable racks" },
  { problem: "Losing small items when travelling", fix: "Packing cubes and zip pouches" },
];

export default function ProblemSolverPage() {
  return (
    <div className="container-page py-12 md:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Problem solver</p>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)]">Fix the annoying thing</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          The daily problems nobody makes a page for. Describe yours and Fyndra
          finds the specific, affordable products that solve it.
        </p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <ProblemSolverForm />

        <aside className="panel-warm h-fit" aria-label="Examples">
          <p className="field-label">Real examples</p>
          <ul className="mt-2 list-none space-y-4 p-0">
            {examples.map((e) => (
              <li key={e.problem} className="border-b border-line pb-4 last:border-0 last:pb-0">
                <p className="font-medium">“{e.problem}”</p>
                <p className="mt-1 text-sm text-muted">→ {e.fix}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
