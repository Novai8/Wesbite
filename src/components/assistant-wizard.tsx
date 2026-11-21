"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/catalogue";
import { CURRENCIES } from "@/lib/validation";
import type { Product } from "@/lib/types";

interface RecommendResponse {
  primary: {
    product: Product;
    score: number;
    scoreBreakdown: Record<string, number>;
    reasons: string[];
  };
  alternatives: { product: Product; score: number; reasons: string[] }[];
  explanation: string;
  generatedBy: string;
  remainingBudget?: number;
  warnings: string[];
}

const STEPS = ["What do you need?", "Budget", "Preferences", "Results"] as const;

const EXAMPLES = [
  "My back hurts working at my desk all day",
  "Small apartment, need more storage",
  "Quiet headset for late-night gaming",
  "Student desk setup under $100",
];

export function AssistantWizard() {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [problem, setProblem] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState<string>("USD");
  const [preferences, setPreferences] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);

  const canContinue =
    (step === 0 && goal.trim().length >= 5) ||
    (step === 1 && true) ||
    (step === 2 && true);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          problem: problem.trim() || undefined,
          budget: budget ? Number(budget) : undefined,
          currency,
          preferences: preferences
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
          mode: "assistant",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setResult(data as RecommendResponse);
      setStep(3);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel max-w-3xl">
      {/* Step indicator */}
      <ol className="mb-8 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 text-sm" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={i === step ? "font-semibold text-cobalt-deep" : "text-faint"}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="panel-reveal">
          <label htmlFor="goal" className="field-label">
            What are you trying to solve?
          </label>
          <textarea
            id="goal"
            className="field min-h-28"
            placeholder="e.g. I get neck pain working at my laptop in a small apartment"
            value={goal}
            maxLength={500}
            onChange={(e) => setGoal(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="filter-chip" onClick={() => setGoal(ex)}>
                {ex}
              </button>
            ))}
          </div>
          <label htmlFor="problem" className="field-label mt-6">
            Any extra detail? <span className="font-normal text-faint">(optional)</span>
          </label>
          <input
            id="problem"
            type="text"
            className="field"
            placeholder="Constraints, space, setup details…"
            value={problem}
            maxLength={800}
            onChange={(e) => setProblem(e.target.value)}
          />
        </div>
      )}

      {step === 1 && (
        <div className="panel-reveal">
          <label htmlFor="budget" className="field-label">
            Budget <span className="font-normal text-faint">(optional)</span>
          </label>
          <div className="flex gap-3">
            <input
              id="budget"
              type="number"
              min="0"
              step="1"
              className="field max-w-40"
              placeholder="100"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <select
              aria-label="Currency"
              className="field max-w-28"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <p className="mt-3 text-sm text-muted">
            Leave empty and we&apos;ll score on fit alone. We never recommend beyond
            your budget silently — if nothing fits, we say so.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="panel-reveal">
          <label htmlFor="prefs" className="field-label">
            Preferences <span className="font-normal text-faint">(comma-separated, optional)</span>
          </label>
          <input
            id="prefs"
            type="text"
            className="field"
            placeholder="wireless, quiet, under 30 cm wide"
            value={preferences}
            maxLength={640}
            onChange={(e) => setPreferences(e.target.value)}
          />
        </div>
      )}

      {step === 3 && result && (
        <div className="panel-reveal">
          <h2 className="text-2xl">Top recommendation</h2>

          <div className="panel-warm mt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="font-display text-xl">{result.primary.product.title}</h3>
              <p className="price text-xl">
                {formatPrice(result.primary.product.price, result.primary.product.currency)}
              </p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{result.primary.product.description}</p>

            <div className="mt-4">
              <p className="field-label">Why this pick</p>
              <ul className="verified-list">
                {result.primary.reasons.map((r) => (
                  <li key={r}>
                    <span aria-hidden="true" className="text-lime-ink">✓</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 border-t border-line pt-3 text-sm leading-relaxed text-muted">
              {result.explanation}
            </p>
            <p className="mt-2 text-xs text-faint">
              Scores from the deterministic engine ({Object.entries(result.primary.scoreBreakdown)
                .map(([k, v]) => `${k} ${Math.round(v * 100)}`)
                .join(" · ")}). Explanation by: {result.generatedBy}.
            </p>
          </div>

          {result.warnings.length > 0 && (
            <div className="panel mt-4 border-lime/50 bg-lime-soft" role="note">
              {result.warnings.map((w) => (
                <p key={w} className="text-sm text-lime-ink">{w}</p>
              ))}
            </div>
          )}

          {result.alternatives.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg">Also worth a look</h3>
              <div className="mt-3 space-y-3">
                {result.alternatives.map((a) => (
                  <div key={a.product.id} className="flex items-start justify-between gap-4 border-b border-line pb-3">
                    <div className="min-w-0">
                      <p className="font-medium">{a.product.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-sm text-muted">{a.reasons[0]}</p>
                    </div>
                    <p className="price shrink-0">{formatPrice(a.product.price, a.product.currency)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.remainingBudget != null && (
            <p className="mt-4 text-sm text-muted">
              Remaining from budget: <span className="price">{formatPrice(result.remainingBudget, currency as "USD")}</span>
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between gap-4 border-t border-line pt-6">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || loading}
        >
          ← Back
        </Button>
        {step < 2 && (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
            Continue
          </Button>
        )}
        {step === 2 && (
          <Button onClick={submit} disabled={loading}>
            {loading ? "Searching the catalogue…" : "Find my products"}
          </Button>
        )}
        {step === 3 && (
          <Button onClick={() => { setStep(0); setResult(null); }}>
            Start over
          </Button>
        )}
      </div>
    </div>
  );
}
