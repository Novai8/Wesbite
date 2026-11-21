"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/catalogue";
import type { Product } from "@/lib/types";

interface RecommendResponse {
  primary: {
    product: Product;
    score: number;
    reasons: string[];
  };
  alternatives: { product: Product; score: number; reasons: string[] }[];
  explanation: string;
  generatedBy: string;
  warnings: string[];
}

export function ProblemSolverForm() {
  const [problem, setProblem] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: problem.trim(),
          budget: budget ? Number(budget) : undefined,
          mode: "problem-solver",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setResult(data as RecommendResponse);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="panel">
        <label htmlFor="problem" className="field-label">
          What&apos;s the problem?
        </label>
        <textarea
          id="problem"
          className="field min-h-24"
          placeholder="e.g. my desk cables are a tangled mess and I trip on them"
          value={problem}
          maxLength={800}
          onChange={(e) => setProblem(e.target.value)}
          required
          minLength={5}
        />
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="budget" className="field-label">
              Max spend <span className="font-normal text-faint">(optional)</span>
            </label>
            <input
              id="budget"
              type="number"
              min="0"
              className="field max-w-32"
              placeholder="30"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Searching…" : "Find a fix"}
          </Button>
        </div>
      </form>

      {error && (
        <p className="mt-4 text-sm font-medium text-danger" role="alert">{error}</p>
      )}

      {result && (
        <div className="panel-reveal mt-6">
          <h2 className="text-2xl">The fix</h2>
          <div className="panel-warm mt-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="font-display text-xl">
                <Link href={`/products/${result.primary.product.slug}`} className="no-underline hover:text-cobalt-deep">
                  {result.primary.product.title}
                </Link>
              </h3>
              <p className="price text-xl">{formatPrice(result.primary.product.price, result.primary.product.currency)}</p>
            </div>
            <ul className="verified-list mt-3">
              {result.primary.reasons.map((r) => (
                <li key={r}>
                  <span aria-hidden="true" className="text-lime-ink">✓</span>
                  {r}
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-muted">
              {result.explanation}
            </p>
          </div>

          {result.alternatives.length > 0 && (
            <div className="mt-5 space-y-3">
              <h3 className="text-lg">Other approaches</h3>
              {result.alternatives.map((a) => (
                <div key={a.product.id} className="flex items-start justify-between gap-4 border-b border-line pb-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      <Link href={`/products/${a.product.slug}`} className="no-underline hover:text-cobalt-deep">
                        {a.product.title}
                      </Link>
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-muted">{a.reasons[0]}</p>
                  </div>
                  <p className="price shrink-0">{formatPrice(a.product.price, a.product.currency)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
