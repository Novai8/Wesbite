"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { getCategories, getCatalogue } from "@/lib/catalogue";
import type { Category, Product } from "@/lib/types";

type SortKey = "relevance" | "price-asc" | "price-desc" | "newest";

const PAGE_SIZE = 12;

const budgetLabels: Record<string, string> = {
  budget: "Budget",
  mid: "Mid-range",
  premium: "Premium",
};

/**
 * When the server supplies the merged catalogue (seed + imported), use it.
 * Falling back to the synchronous seed keeps the component usable in isolation
 * and keeps the client bundle free of any Supabase concern.
 */
export function DiscoverGrid({
  initialProducts,
  initialCategories,
}: {
  initialProducts?: Product[];
  initialCategories?: Category[];
} = {}) {
  const products = initialProducts ?? getCatalogue();
  const categories = initialCategories ?? getCategories();
  const searchParams = useSearchParams();

  const categoryFromUrl = searchParams.get("category") ?? "";
  const knownCategory = categories.some((item) => item.slug === categoryFromUrl)
    ? categoryFromUrl
    : "";

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(knownCategory);
  const [tier, setTier] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<SortKey>("relevance");
  const [page, setPage] = useState(1);

  const counts = useMemo(
    () =>
      categories.reduce<Record<string, number>>((acc, item) => {
        acc[item.slug] = products.filter((product) => product.categorySlug === item.slug).length;
        return acc;
      }, {}),
    [categories, products],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => {
      if (category && p.categorySlug !== category) return false;
      if (tier && p.budgetTier !== tier) return false;
      if (maxPrice && p.price > Number(maxPrice)) return false;
      if (q) {
        const hay = [p.title, p.description, ...p.keywords, ...p.useCases]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    switch (sort) {
      case "price-asc":
        list = [...list].sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list = [...list].sort((a, b) => b.price - a.price);
        break;
      case "newest":
        list = [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
        break;
      default:
        break;
    }
    return list;
  }, [products, query, category, tier, maxPrice, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasFilters = Boolean(query || category || tier || maxPrice);

  const resetFilters = () => {
    setQuery("");
    setCategory("");
    setTier("");
    setMaxPrice("");
    setPage(1);
  };

  return (
    <div>
      <div className="catalogue-toolbar" role="search">
        <div className="catalogue-search-row">
          <div className="catalogue-search-field">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
              <circle cx="8.6" cy="8.6" r="5.6" stroke="currentColor" strokeWidth="1.5" />
              <path d="m13 13 4.2 4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <label htmlFor="q" className="sr-only">
              Search the catalogue
            </label>
            <input
              id="q"
              type="search"
              placeholder="Search a product, a problem, or a use case"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
          {query ? (
            <button
              type="button"
              className="catalogue-clear"
              onClick={() => {
                setQuery("");
                setPage(1);
              }}
            >
              Clear search
            </button>
          ) : null}
        </div>

        <div>
          <div className="catalogue-channel-row" aria-label="Filter by category">
            <button
              type="button"
              className={`catalogue-channel ${category === "" ? "is-on" : ""}`}
              aria-pressed={category === ""}
              onClick={() => {
                setCategory("");
                setPage(1);
              }}
            >
              All shelves
              <small>{products.length}</small>
            </button>
            {categories.map((item) => (
              <button
                key={item.slug}
                type="button"
                className={`catalogue-channel ${category === item.slug ? "is-on" : ""}`}
                aria-pressed={category === item.slug}
                onClick={() => {
                  setCategory(item.slug);
                  setPage(1);
                }}
              >
                {item.name}
                <small>{counts[item.slug] ?? 0}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="catalogue-filter-row">
          <div className="catalogue-control">
            <label htmlFor="tier">Budget tier</label>
            <select
              id="tier"
              value={tier}
              onChange={(event) => {
                setTier(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Any tier</option>
              <option value="budget">Budget</option>
              <option value="mid">Mid-range</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div className="catalogue-control">
            <label htmlFor="maxp">Max price (USD)</label>
            <input
              id="maxp"
              type="number"
              min="0"
              inputMode="decimal"
              placeholder="No limit"
              value={maxPrice}
              onChange={(event) => {
                setMaxPrice(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="catalogue-control">
            <label htmlFor="cat">Category select</label>
            <select
              id="cat"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="catalogue-result-bar">
          <p aria-live="polite">
            {filtered.length} product{filtered.length === 1 ? "" : "s"}
            {hasFilters ? " match" : " in the catalogue"}
            {tier ? ` · ${budgetLabels[tier] ?? tier}` : ""}
          </p>
          <div className="catalogue-result-actions">
            {hasFilters ? (
              <button type="button" className="catalogue-reset" onClick={resetFilters}>
                Clear filters
              </button>
            ) : null}
            <label htmlFor="sort" className="catalogue-sort">
              <span className="sr-only">Sort</span>
              <select
                id="sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
              >
                <option value="relevance">Relevance</option>
                <option value="price-asc">Price, low to high</option>
                <option value="price-desc">Price, high to low</option>
                <option value="newest">Newest first</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {pageItems.length > 0 ? (
        <div className="catalogue-grid">
          {pageItems.map((product, index) => (
            <ProductCard key={product.id} product={product} priority={index < 2} />
          ))}
        </div>
      ) : (
        <div className="catalogue-empty">
          <p className="catalogue-eyebrow">No matches</p>
          <h2>That shelf is empty.</h2>
          <p>
            Try widening the price range or clearing the category. Or describe
            the problem to Fyndra and let the assistant search the full catalogue.
          </p>
          <button type="button" className="catalogue-reset" onClick={resetFilters}>
            Show the full catalogue
          </button>
        </div>
      )}

      {totalPages > 1 ? (
        <nav className="catalogue-pagination" aria-label="Pagination">
          <button
            type="button"
            className="catalogue-page-button"
            disabled={safePage === 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            ← Previous
          </button>
          <span className="catalogue-page-count">
            {String(safePage).padStart(2, "0")} / {String(totalPages).padStart(2, "0")}
          </span>
          <button
            type="button"
            className="catalogue-page-button"
            disabled={safePage === totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Next →
          </button>
        </nav>
      ) : null}
    </div>
  );
}
