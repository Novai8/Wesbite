import { Disclaimer } from "@/components/disclaimer";
import {
  formatHours,
  illustrativeSavings,
  type Assumptions,
} from "@/data/demos";

export function AssumptionsPanel({ assumptions }: { assumptions: Assumptions }) {
  const saved = illustrativeSavings(assumptions);
  return (
    <section className="surface p-5 sm:p-6">
      <p className="text-xs font-medium tracking-[0.16em] text-accent-ink uppercase">
        Illustrative assumptions
      </p>
      <h2 className="mt-2 text-xl font-medium tracking-tight">
        Manual minutes versus review minutes
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        This is arithmetic on stated assumptions, not a measured result.
      </p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-paper px-4 py-3">
          <dt className="text-xs text-slate-500">Manual handling</dt>
          <dd className="mt-1 text-lg font-medium tracking-tight">
            {assumptions.manualMinutes} min
          </dd>
        </div>
        <div className="rounded-2xl border border-line bg-paper px-4 py-3">
          <dt className="text-xs text-slate-500">Review of the draft</dt>
          <dd className="mt-1 text-lg font-medium tracking-tight">
            {assumptions.reviewMinutes} min
          </dd>
        </div>
        <div className="rounded-2xl border border-line bg-paper px-4 py-3">
          <dt className="text-xs text-slate-500">Weekly volume</dt>
          <dd className="mt-1 text-lg font-medium tracking-tight">
            {assumptions.weeklyVolume} {assumptions.unit}
          </dd>
        </div>
      </dl>
      <p className="mt-5 font-mono text-[13px] leading-relaxed text-slate-700">
        ({assumptions.manualMinutes} − {assumptions.reviewMinutes}) ×{" "}
        {assumptions.weeklyVolume} = {saved.weeklyMinutes} minutes / week
        <span className="text-slate-400"> · </span>
        {formatHours(saved.weeklyHours)} hours
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">{assumptions.notes}</p>
      <Disclaimer className="mt-4" />
    </section>
  );
}
