"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { getCategories, getCatalogue } from "@/lib/catalogue";

type SortKey = "relevance" | "price-asc" | "price-desc" | "newest";

const PAGE_SIZE = 8;

export function DiscoverGrid() {
  const products = getCatalogue();
  const categories = getCategories();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tier, setTier] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<SortKey>("relevance");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => {
      if (category && p.categorySlug !== category) return false;
      if (tier && p.budgetTier !== tier) return false;
      if (maxPrice && p.price > Number(maxPrice)) return false;
      if (q) {
        const hay = [p.title, p.description, ...p.keywords, ...p.useCases].join(" ").toLowerCase();
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

  const hasFilters = query || category || tier || maxPrice;

  return (
    <div>
      {/* Controls */}
      <div className="panel" role="search">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <label htmlFor="q" className="field-label">Search</label>
            <input
              id="q"
              type="search"
              className="field"
              placeholder="monitor arm, packing cubes…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <label htmlFor="cat" className="field-label">Category</label>
            <select
              id="cat"
              className="field"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tier" className="field-label">Budget tier</label>
            <select
              id="tier"
              className="field"
              value={tier}
              onChange={(e) => { setTier(e.target.value); setPage(1); }}
            >
              <option value="">Any</option>
              <option value="budget">Budget</option>
              <option value="mid">Mid-range</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div>
            <label htmlFor="maxp" className="field-label">Max price</label>
            <input
              id="maxp"
              type="number"
              min="0"
              className="field"
              placeholder="No limit"
              value={maxPrice}
              onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-sm text-muted" aria-live="polite">
            {filtered.length} product{filtered.length === 1 ? "" : "s"}
            {hasFilters ? " match" : " in the catalogue"}
          </p>
          <div className="flex items-center gap-3">
            {hasFilters && (
              <button
                type="button"
                className="text-sm font-medium text-cobalt-deep hover:underline"
                onClick={() => { setQuery(""); setCategory(""); setTier(""); setMaxPrice(""); setPage(1); }}
              >
                Clear filters
              </button>
            )}
            <label htmlFor="sort" className="sr-only">Sort</label>
            <select
              id="sort"
              className="field h-10 w-44 py-1"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="relevance">Sort: relevance</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="newest">Newest first</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      {pageItems.length > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pageItems.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
        </div>
      ) : (
        <div className="panel-warm mt-8 flex min-h-48 flex-col items-center justify-center gap-3 text-center">
          <p className="font-display text-lg">Nothing matches those filters</p>
          <p className="max-w-sm text-sm text-muted">
            Try widening the price range or clearing the category — or describe
            the problem to the assistant instead and let the engine search for you.
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
          <button
            type="button"
            className="filter-chip"
            disabled={safePage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Previous
          </button>
          <span className="px-3 text-sm text-muted">
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            className="filter-chip"
            disabled={safePage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}
