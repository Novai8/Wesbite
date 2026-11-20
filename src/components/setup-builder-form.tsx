"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCategories, formatPrice } from "@/lib/catalogue";
import { CURRENCIES } from "@/lib/validation";
import type { Product } from "@/lib/types";

interface SetupResponse {
  categories: { categorySlug: string; product: Product; allocated: number }[];
  total: number;
  remaining: number;
  overBudget: boolean;
  explanation: string;
  warnings?: string[];
}

export function SetupBuilderForm() {
  const categories = getCategories();
  const [selected, setSelected] = useState<string[]>(categories.slice(0, 3).map((c) => c.slug));
  const [budget, setBudget] = useState("150");
  const [currency, setCurrency] = useState<string>("USD");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SetupResponse | null>(null);

  function toggle(slug: string) {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/setup-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim() || "a complete setup across my chosen categories",
          budget: Number(budget) || undefined,
          currency,
          preferences: selected,
          mode: "setup-builder",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setResult(data as SetupResponse);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const budgetNum = Number(budget) || 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      {/* Controls */}
      <div className="panel h-fit">
        <p className="field-label">1. Which areas do you need?</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              className={`filter-chip ${selected.includes(c.slug) ? "is-on" : ""}`}
              aria-pressed={selected.includes(c.slug)}
              onClick={() => toggle(c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <p className="field-label mt-6">2. Total budget</p>
        <div className="flex gap-3">
          <input
            type="number"
            min="10"
            step="5"
            className="field max-w-40"
            aria-label="Total budget"
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

        <p className="field-label mt-6">3. Anything specific? <span className="font-normal text-faint">(optional)</span></p>
        <input
          type="text"
          className="field"
          aria-label="What the setup is for"
          placeholder="e.g. work-from-home desk in a small room"
          value={goal}
          maxLength={500}
          onChange={(e) => setGoal(e.target.value)}
        />

        <Button className="mt-6 w-full" onClick={submit} disabled={loading || selected.length === 0}>
          {loading ? "Building…" : "Build my setup"}
        </Button>
      </div>

      {/* Result */}
      <div>
        {!result && (
          <div className="panel-warm flex h-full min-h-64 items-center justify-center text-center">
            <p className="max-w-xs text-sm leading-relaxed text-muted">
              Your budget breakdown will appear here — one pick per category,
              every allocation visible, nothing silently over budget.
            </p>
          </div>
        )}

        {result && (
          <div className="panel-reveal">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl">Your setup</h2>
              <p className="text-sm text-muted">
                Total <span className="price">{formatPrice(result.total, currency as "USD")}</span>
                {" · "}
                Remaining <span className="price">{formatPrice(Math.max(result.remaining, 0), currency as "USD")}</span>
              </p>
            </div>

            {/* Allocation bar */}
            <div
              className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-surface-warm"
              role="img"
              aria-label={`Budget allocation: ${result.categories.map((c) => `${c.product.title} ${formatPrice(c.allocated, currency as "USD")}`).join(", ")}`}
            >
              {result.categories.map((c, i) => (
                <div
                  key={c.categorySlug}
                  style={{
                    width: `${Math.min((c.allocated / Math.max(budgetNum, result.total)) * 100, 100)}%`,
                    backgroundColor: ["#2941E8", "#5B6FED", "#A3D418", "#D6D0C4"][i % 4],
                  }}
                />
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {result.categories.map((c) => (
                <div key={c.categorySlug} className="panel">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-widest text-faint">
                        {categories.find((cat) => cat.slug === c.categorySlug)?.name ?? c.categorySlug}
                      </p>
                      <h3 className="mt-1 font-display text-lg leading-snug">
                        <Link href={`/products/${c.product.slug}`} className="no-underline hover:text-cobalt-deep">
                          {c.product.title}
                        </Link>
                      </h3>
                    </div>
                    <p className="price text-lg">{formatPrice(c.allocated, currency as "USD")}</p>
                  </div>
                </div>
              ))}
            </div>

            {result.warnings?.map((w) => (
              <p key={w} className="mt-4 rounded-lg bg-lime-soft p-3 text-sm text-lime-ink" role="note">
                {w}
              </p>
            ))}

            <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-muted">
              {result.explanation}
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm font-medium text-danger" role="alert">{error}</p>
        )}
      </div>
    </div>
  );
}
