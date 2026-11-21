"use client";

import { useState } from "react";
import { outboundPath } from "@/lib/affiliate";
import { formatPrice, getCatalogue } from "@/lib/catalogue";
import type { Product } from "@/lib/types";

const MAX_PICKS = 3;

export function CompareTool() {
  const products = getCatalogue();
  const [query, setQuery] = useState("");
  const [picks, setPicks] = useState<Product[]>([]);

  const matches = query.trim()
    ? products
        .filter((p) =>
          `${p.title} ${p.keywords.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .filter((p) => !picks.some((pick) => pick.id === p.id))
        .slice(0, 5)
    : [];

  function toggle(p: Product) {
    setPicks((prev) =>
      prev.some((x) => x.id === p.id)
        ? prev.filter((x) => x.id !== p.id)
        : prev.length < MAX_PICKS
          ? [...prev, p]
          : prev,
    );
    setQuery("");
  }

  const specKeys =
    picks.length > 0
      ? [...new Set(picks.flatMap((p) => Object.keys(p.specs)))].slice(0, 8)
      : [];

  return (
    <div>
      {/* Picker */}
      <div className="panel">
        <label htmlFor="compare-q" className="field-label">
          Add products ({picks.length}/{MAX_PICKS})
        </label>
        <input
          id="compare-q"
          type="search"
          className="field"
          placeholder="Start typing a product name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={picks.length >= MAX_PICKS}
        />
        {matches.length > 0 && (
          <ul className="mt-2 list-none rounded-lg border border-line p-0" role="listbox">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-warm"
                  onClick={() => toggle(p)}
                >
                  <span>{p.title}</span>
                  <span className="price">{formatPrice(p.price, p.currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {picks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {picks.map((p) => (
              <button key={p.id} type="button" className="filter-chip is-on" onClick={() => toggle(p)}>
                {p.title} ✕
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      {picks.length === 0 ? (
        <div className="panel-warm mt-8 flex min-h-48 items-center justify-center text-center">
          <p className="max-w-xs text-sm leading-relaxed text-muted">
            Add products above to compare. Or explore{" "}
            <a href="/discover" className="text-cobalt-deep hover:underline">the catalogue</a> first.
          </p>
        </div>
      ) : (
        <div className="panel mt-8 overflow-x-auto">
          <table className="w-full min-w-140 border-collapse text-sm">
            <caption className="sr-only">Product comparison</caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-line-strong pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-faint">
                  Attribute
                </th>
                {picks.map((p) => (
                  <th key={p.id} scope="col" className="border-b border-line-strong pb-3 text-left">
                    {p.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="py-3 pr-4 text-left font-medium text-muted">Price</th>
                {picks.map((p) => (
                  <td key={p.id} className="py-3">
                    <span className="price">{formatPrice(p.price, p.currency)}</span>
                    {p.previousPrice != null && p.previousPrice > p.price && (
                      <span className="ml-2 text-xs text-faint line-through">
                        {formatPrice(p.previousPrice, p.currency)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 text-left font-medium text-muted">Merchant</th>
                {picks.map((p) => (
                  <td key={p.id} className="py-3">{p.merchant}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 text-left font-medium text-muted">Budget tier</th>
                {picks.map((p) => (
                  <td key={p.id} className="py-3 capitalize">{p.budgetTier}</td>
                ))}
              </tr>
              {specKeys.map((key) => (
                <tr key={key}>
                  <th scope="row" className="py-3 pr-4 text-left font-medium text-muted">{key}</th>
                  {picks.map((p) => (
                    <td key={p.id} className="py-3">{p.specs[key] ?? "—"}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-3 pr-4 text-left align-top font-medium text-muted">What&apos;s good</th>
                {picks.map((p) => (
                  <td key={p.id} className="py-3">
                    <ul className="m-0 list-none space-y-1 p-0">
                      {p.pros.slice(0, 3).map((pro) => (
                        <li key={pro} className="text-muted">✓ {pro}</li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 text-left align-top font-medium text-muted">Trade-offs</th>
                {picks.map((p) => (
                  <td key={p.id} className="py-3">
                    <ul className="m-0 list-none space-y-1 p-0">
                      {p.cons.slice(0, 3).map((con) => (
                        <li key={con} className="text-muted">– {con}</li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
              <tr>
                <td aria-hidden="true" />
                {picks.map((p) => (
                  <td key={p.id} className="pt-4">
                    <a href={outboundPath(p, "compare")} rel="nofollow sponsored noopener" className="btn btn-secondary">
                      Affiliate link
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
