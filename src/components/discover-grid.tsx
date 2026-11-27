"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Archive, ArrowLeft, ArrowRight, BookOpen, Check, Coffee, Gamepad2,
  Grid2X2, Monitor, PackageCheck, Plane, Search, SlidersHorizontal, Sparkles,
  type LucideIcon,
} from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { getCategories, getCatalogue } from "@/lib/catalogue";
import type { Category, Product } from "@/lib/types";

type SortKey = "relevance" | "price-asc" | "price-desc" | "newest";
type Step = "category" | "budget" | "preferences" | "results";

const iconMap: Record<string, LucideIcon> = {
  Monitor, Gamepad2, Archive, BookOpen, Plane, Coffee,
};
const wheelSlots = [
  "wizard-slot-left-top", "wizard-slot-right-top",
  "wizard-slot-left-middle", "wizard-slot-right-middle",
  "wizard-slot-left-bottom", "wizard-slot-right-bottom",
];

function CategoryIcon({ category, fallback = Grid2X2 }: { category?: Category; fallback?: LucideIcon }) {
  const Icon = category ? iconMap[category.icon] ?? fallback : fallback;
  return <Icon aria-hidden="true" strokeWidth={1.7} />;
}

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
  const knownCategory = categories.some((item) => item.slug === categoryFromUrl) ? categoryFromUrl : "";

  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState(knownCategory);
  const [tier, setTier] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [useCases, setUseCases] = useState<string[]>([]);
  const [merchant, setMerchant] = useState("");
  const [availability, setAvailability] = useState("any");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("relevance");
  const [page, setPage] = useState(1);

  const counts = useMemo(() => categories.reduce<Record<string, number>>((acc, item) => {
    acc[item.slug] = products.filter((product) => product.categorySlug === item.slug).length;
    return acc;
  }, {}), [categories, products]);

  const categoryProducts = useMemo(
    () => category ? products.filter((product) => product.categorySlug === category) : products,
    [products, category],
  );
  const availableCurrencies = useMemo(
    () => Array.from(new Set(categoryProducts.map((product) => product.currency))).sort(),
    [categoryProducts],
  );
  const availableUseCases = useMemo(
    () => Array.from(new Set(categoryProducts.flatMap((product) => product.useCases))).sort().slice(0, 18),
    [categoryProducts],
  );
  const merchants = useMemo(
    () => Array.from(new Set(categoryProducts.map((product) => product.merchant))).sort(),
    [categoryProducts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((product) => {
      if (category && product.categorySlug !== category) return false;
      if (tier && product.budgetTier !== tier) return false;
      if ((minPrice || maxPrice) && product.currency !== currency) return false;
      if (minPrice && product.price < Number(minPrice)) return false;
      if (maxPrice && product.price > Number(maxPrice)) return false;
      if (merchant && product.merchant !== merchant) return false;
      if (availability !== "any" && product.availability !== availability) return false;
      if (useCases.length && !useCases.every((useCase) => product.useCases.includes(useCase))) return false;
      if (q) {
        const haystack = [product.title, product.description, product.subcategory ?? "", ...product.keywords, ...product.useCases]
          .join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
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
  }, [products, category, tier, currency, minPrice, maxPrice, merchant, availability, useCases, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / 12));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * 12, safePage * 12);
  const selectedCategory = categories.find((item) => item.slug === category);
  const activeStepIndex = step === "category" ? 0 : step === "budget" ? 1 : step === "preferences" ? 2 : 3;
  const hasFilters = Boolean(category || tier || minPrice || maxPrice || merchant || availability !== "any" || useCases.length || query);

  const goTo = (next: Step) => {
    setPage(1);
    setStep(next);
  };
  const reset = () => {
    setCategory("");
    setTier("");
    setMinPrice("");
    setMaxPrice("");
    setUseCases([]);
    setMerchant("");
    setAvailability("any");
    setQuery("");
    setSort("relevance");
    setPage(1);
    setStep("category");
  };
  const toggleUseCase = (value: string) => {
    setUseCases((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  return (
    <section className="discovery-wizard" aria-label="Fyndra product discovery">
      <div className="wizard-heading">
        <div>
          <p className="wizard-kicker"><Sparkles size={14} /> FIND YOUR NEXT GOOD THING</p>
          <h2>Build your discovery.</h2>
          <p className="wizard-intro">A few smart filters. A much shorter hunt.</p>
        </div>
        <div className="wizard-step-count">STEP {String(activeStepIndex + 1).padStart(2, "0")} <span>/ 04</span></div>
      </div>

      <nav className="wizard-progress" aria-label="Discovery steps">
        {(["category", "budget", "preferences", "results"] as Step[]).map((item, index) => (
          <button
            key={item}
            type="button"
            className={index === activeStepIndex ? "is-current" : index < activeStepIndex ? "is-complete" : ""}
            onClick={() => index <= activeStepIndex && goTo(item)}
            aria-current={index === activeStepIndex ? "step" : undefined}
            disabled={index > activeStepIndex}
          >
            <span>{index < activeStepIndex ? <Check size={13} /> : String(index + 1).padStart(2, "0")}</span>
            {item === "category" ? "Category" : item === "budget" ? "Budget" : item === "preferences" ? "Preferences" : "Results"}
          </button>
        ))}
      </nav>

      {step === "category" && (
        <div className="wizard-stage wizard-category-stage">
          <div className="wizard-stage-copy">
            <p className="wizard-overline">01 / START SOMEWHERE</p>
            <h3>What are we looking for?</h3>
            <p>Choose a shelf. Or leave it on ALL and explore everything.</p>
          </div>
          <div className="category-orbit" aria-label="Choose a product category">
            <button
              type="button"
              className={category === "" ? "orbit-all is-selected" : "orbit-all"}
              onClick={() => setCategory("")}
              aria-pressed={category === ""}
            >
              <Grid2X2 size={22} />
              <span>ALL</span>
            </button>
            <div className="orbit-core" aria-hidden="true">
              <span>Category</span>
              <small>{category ? selectedCategory?.name : "Explore everything"}</small>
            </div>
            {categories.slice(0, 6).map((item, index) => (
              <button
                key={item.slug}
                type="button"
                className={`orbit-category ${wheelSlots[index]} ${category === item.slug ? "is-selected" : ""}`}
                onClick={() => setCategory(item.slug)}
                aria-pressed={category === item.slug}
              >
                <CategoryIcon category={item} />
                <span>{item.name}</span>
                <small>{counts[item.slug] ?? 0}</small>
              </button>
            ))}
          </div>
          {categories.length > 6 && (
            <div className="wizard-extra-categories">
              {categories.slice(6).map((item) => (
                <button key={item.slug} type="button" className={category === item.slug ? "wizard-pill is-selected" : "wizard-pill"} onClick={() => setCategory(item.slug)}>
                  <CategoryIcon category={item} /> {item.name} <small>{counts[item.slug] ?? 0}</small>
                </button>
              ))}
            </div>
          )}
          <div className="wizard-stage-footer">
            <span>{category ? selectedCategory?.name : "All categories"} selected · {category ? counts[category] ?? 0 : products.length} products</span>
            <button type="button" className="wizard-primary" onClick={() => goTo("budget")}>Set my budget <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {step === "budget" && (
        <div className="wizard-stage">
          <div className="wizard-stage-copy">
            <p className="wizard-overline">02 / KEEP IT REAL</p>
            <h3>What feels comfortable?</h3>
            <p>Pick a broad range or enter your own limits. No currency conversion is guessed.</p>
          </div>
          <div className="wizard-budget-options">
            {[
              { id: "", title: "Any budget", note: "Show me the range" },
              { id: "budget", title: "Budget", note: "Spend less, solve the need" },
              { id: "mid", title: "Mid-range", note: "Balance price and features" },
              { id: "premium", title: "Premium", note: "Show higher-end options" },
            ].map((option) => (
              <button key={option.id || "any"} type="button" className={tier === option.id ? "budget-option is-selected" : "budget-option"} onClick={() => setTier(option.id)}>
                <span className="budget-option-check">{tier === option.id ? <Check size={14} /> : null}</span>
                <strong>{option.title}</strong><small>{option.note}</small>
              </button>
            ))}
          </div>
          <div className="wizard-price-range">
            <div className="wizard-range-title"><SlidersHorizontal size={16} /><strong>Custom price range</strong></div>
            <label>Currency
              <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                {Array.from(new Set(["USD", ...availableCurrencies])).map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
            <label>Minimum
              <input type="number" min="0" inputMode="decimal" placeholder="No minimum" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} />
            </label>
            <label>Maximum
              <input type="number" min="0" inputMode="decimal" placeholder="No maximum" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} />
            </label>
          </div>
          <p className="wizard-note">When you set a custom price, results are limited to that currency so prices are never compared incorrectly.</p>
          <div className="wizard-stage-footer">
            <button type="button" className="wizard-back" onClick={() => goTo("category")}><ArrowLeft size={16} /> Category</button>
            <button type="button" className="wizard-primary" onClick={() => goTo("preferences")}>Add preferences <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {step === "preferences" && (
        <div className="wizard-stage">
          <div className="wizard-stage-copy">
            <p className="wizard-overline">03 / MAKE IT YOURS</p>
            <h3>What matters in the details?</h3>
            <p>Choose the use cases that fit. These options come from the products in your selected shelf.</p>
          </div>
          {availableUseCases.length > 0 ? (
            <div className="wizard-preference-group">
              <div className="wizard-group-title"><span>USE CASES</span><small>Choose any that apply</small></div>
              <div className="wizard-choice-cloud">
                {availableUseCases.map((item) => (
                  <button key={item} type="button" className={useCases.includes(item) ? "wizard-pill is-selected" : "wizard-pill"} onClick={() => toggleUseCase(item)}>
                    {useCases.includes(item) ? <Check size={13} /> : <Sparkles size={13} />} {item}
                  </button>
                ))}
              </div>
            </div>
          ) : <p className="wizard-note">No use-case tags are available for this shelf yet. You can continue without them.</p>}
          <div className="wizard-preference-controls">
            <label>Preferred merchant
              <select value={merchant} onChange={(event) => setMerchant(event.target.value)}>
                <option value="">Any merchant</option>
                {merchants.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>Availability
              <select value={availability} onChange={(event) => setAvailability(event.target.value)}>
                <option value="any">Any availability</option>
                <option value="in_stock">Marked in stock</option>
                <option value="out_of_stock">Marked out of stock</option>
              </select>
            </label>
          </div>
          <p className="wizard-note">Availability reflects the catalogue record and may change at the merchant.</p>
          <div className="wizard-stage-footer">
            <button type="button" className="wizard-back" onClick={() => goTo("budget")}><ArrowLeft size={16} /> Budget</button>
            <button type="button" className="wizard-primary" onClick={() => goTo("results")}>Find matching products <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {step === "results" && (
        <div className="wizard-results">
          <div className="wizard-results-heading">
            <div>
              <p className="wizard-overline">04 / YOUR MATCHES</p>
              <h3>{filtered.length} product{filtered.length === 1 ? "" : "s"} found</h3>
              <p>Change any step to tune the results. Every match comes from the approved catalogue.</p>
            </div>
            <button type="button" className="wizard-edit-button" onClick={() => goTo("category")}>Edit discovery</button>
          </div>
          <div className="wizard-result-tools">
            <label className="wizard-search"><Search size={17} /><span className="sr-only">Search matching products</span><input type="search" placeholder="Search products, keywords or use cases" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label>
            <label className="wizard-sort">Sort
              <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                <option value="relevance">Relevance</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="newest">Recently updated</option>
              </select>
            </label>
          </div>
          <div className="wizard-active-filters">
            <span>{selectedCategory?.name ?? "All categories"}</span>
            {tier && <span>{tier === "mid" ? "Mid-range" : tier === "budget" ? "Budget" : "Premium"}</span>}
            {(minPrice || maxPrice) && <span>{currency} {minPrice || "0"} – {maxPrice || "No limit"}</span>}
            {merchant && <span>{merchant}</span>}
            {useCases.map((item) => <span key={item}>{item}</span>)}
            {availability !== "any" && <span>{availability === "in_stock" ? "Marked in stock" : "Marked out of stock"}</span>}
            {hasFilters && <button type="button" onClick={reset}>Reset all</button>}
          </div>
          {pageItems.length ? (
            <div className="catalogue-grid">
              {pageItems.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 2} />)}
            </div>
          ) : (
            <div className="catalogue-empty">
              <p className="catalogue-eyebrow">No exact matches</p>
              <h2>Let's widen the search.</h2>
              <p>Try removing a use case, expanding the budget, or choosing ALL categories.</p>
              <button type="button" className="wizard-primary" onClick={reset}>Start over <ArrowRight size={16} /></button>
            </div>
          )}
          {totalPages > 1 && (
            <nav className="catalogue-pagination" aria-label="Product pages">
              <button type="button" className="catalogue-page-button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>← Previous</button>
              <span className="catalogue-page-count">{String(safePage).padStart(2, "0")} / {String(totalPages).padStart(2, "0")}</span>
              <button type="button" className="catalogue-page-button" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next →</button>
            </nav>
          )}
        </div>
      )}
    </section>
  );
}
