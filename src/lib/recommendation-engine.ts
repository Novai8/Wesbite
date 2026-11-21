import { getCatalogue } from "@/lib/catalogue";
import type { Product, Recommendation, ScoredProduct, ShoppingRequest } from "@/lib/types";

/**
 * Deterministic recommendation engine.
 *
 * Transparent scoring across six axes, each normalised to 0–1 and weighted.
 * No AI required — this runs entirely offline against the approved catalogue.
 * The Groq layer (lib/ai/groq.ts) may rewrite the *explanation* text only;
 * it can never change scores or invent product facts.
 */

const WEIGHTS = {
  relevance: 0.35,
  budget: 0.25,
  features: 0.15,
  dataQuality: 0.1,
  freshness: 0.05,
  category: 0.1,
} as const;

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "for", "to", "with", "of", "in", "on",
  "my", "our", "i", "me", "we", "you", "your", "it", "is", "are", "be", "have",
  "has", "want", "need", "would", "like", "get", "some", "any", "that", "this",
  "better", "good", "best", "under", "around", "about", "please", "help",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function daysSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 86_400_000;
}

function textOverlapScore(tokens: string[], haystack: string[]): number {
  if (tokens.length === 0) return 0;
  const hay = new Set(haystack.map((h) => h.toLowerCase()));
  let hits = 0;
  for (const token of tokens) {
    if (hay.has(token)) {
      hits += 1;
      continue;
    }
    for (const h of hay) {
      if (h.includes(token) || token.includes(h)) {
        hits += 0.5;
        break;
      }
    }
  }
  return Math.min(hits / tokens.length, 1);
}

export function scoreProduct(
  product: Product,
  req: ShoppingRequest,
  tokens: string[],
): ScoredProduct {
  const reasons: string[] = [];

  // Relevance — goal + problem text against keywords, use cases, title, description.
  const goalTokens = tokens;
  const problemTokens = tokenize(req.problem ?? "");
  const allTokens = [...new Set([...goalTokens, ...problemTokens])];
  const relevance =
    0.5 * textOverlapScore(allTokens, product.keywords) +
    0.3 * textOverlapScore(allTokens, [...product.useCases, ...product.keywords]) +
    0.2 * textOverlapScore(allTokens, tokenize(`${product.title} ${product.description}`));

  // Budget — how comfortably the price fits.
  let budget = 0.5;
  if (req.budget != null && req.budget > 0) {
    const ratio = product.price / req.budget;
    if (ratio <= 0.25) {
      budget = 0.85;
      reasons.push(`Costs ${Math.round(ratio * 100)}% of your budget — leaves room for more`);
    } else if (ratio <= 0.6) {
      budget = 1;
      reasons.push("Comfortably within your budget");
    } else if (ratio <= 1) {
      budget = 0.75;
      reasons.push("Fits your budget, though it takes a large share of it");
    } else {
      budget = 0;
    }
  } else {
    budget = 0.7;
  }

  // Features — preference phrases matched against specs and pros.
  const prefTokens = (req.preferences ?? []).flatMap(tokenize);
  const featureText = [
    ...Object.entries(product.specs).map(([k, v]) => `${k} ${v}`),
    ...product.pros,
  ].join(" ");
  const features =
    prefTokens.length === 0
      ? 0.6
      : textOverlapScore(prefTokens, [featureText]);

  // Data quality — completeness of the record itself.
  let completeness = 0;
  if (product.specs && Object.keys(product.specs).length >= 3) completeness += 0.3;
  if (product.pros.length > 0) completeness += 0.2;
  if (product.cons.length > 0) completeness += 0.15;
  if (product.imageUrls.length > 0) completeness += 0.2;
  if (product.sourceUrl) completeness += 0.15;
  const dataQuality = completeness;

  // Freshness — recency of price verification.
  const ageDays = daysSince(product.priceVerifiedAt);
  const freshness = ageDays <= 7 ? 1 : ageDays <= 30 ? 0.7 : ageDays <= 90 ? 0.4 : 0.2;

  // Category — direct intent-to-category match from keywords.
  const category = Math.max(
    textOverlapScore(allTokens, [product.categorySlug.replace(/-/g, " ")]),
    0.3,
  );

  const scoreBreakdown = { relevance, budget, features, dataQuality, freshness, category };
  const score =
    WEIGHTS.relevance * relevance +
    WEIGHTS.budget * budget +
    WEIGHTS.features * features +
    WEIGHTS.dataQuality * dataQuality +
    WEIGHTS.freshness * freshness +
    WEIGHTS.category * category;

  if (relevance > 0.25) {
    reasons.push(`Matches what you described: ${product.useCases.slice(0, 2).join(", ") || "your requirements"}`);
  }
  if (features > 0.5) {
    reasons.push("Specs line up with the features you asked for");
  }
  if (freshness === 1) {
    reasons.push(`Price verified within the last week (${product.priceVerifiedAt})`);
  }

  return { product, score, scoreBreakdown, reasons };
}

export function recommend(req: ShoppingRequest): Recommendation {
  const catalogue = getCatalogue();
  const tokens = tokenize(req.goal);

  const scored = catalogue
    .map((p) => scoreProduct(p, req, tokens))
    .filter((s) => s.score > 0.18)
    .sort((a, b) => b.score - a.score);

  const warnings: string[] = [];
  let primary: ScoredProduct;
  let alternatives: ScoredProduct[] = [];

  if (scored.length === 0) {
    // Fallback: top by data quality + budget fit so the page is never empty,
    // clearly flagged as a weak match.
    const fallback = catalogue
      .map((p) => scoreProduct(p, req, tokens))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    warnings.push(
      "Nothing in the catalogue matched that closely. These are the closest overall — try describing the problem differently.",
    );
    primary = fallback[0];
    alternatives = fallback.slice(1);
  } else {
    primary = scored[0];
    alternatives = scored.slice(1, 4);
  }

  let remainingBudget: number | undefined;
  if (req.budget != null && req.budget > 0) {
    remainingBudget = req.budget - primary.product.price;
    if (remainingBudget < 0) {
      warnings.push(
        `This pick is ${(-remainingBudget).toFixed(2)} ${req.currency} over your stated budget.`,
      );
      remainingBudget = undefined;
    }
  }

  const generatedBy: Recommendation["generatedBy"] = "deterministic";
  const explanation = buildExplanation(req, primary, alternatives);

  return { primary, alternatives, explanation, generatedBy, remainingBudget, warnings };
}

function buildExplanation(
  req: ShoppingRequest,
  primary: ScoredProduct,
  alternatives: ScoredProduct[],
): string {
  const parts: string[] = [];
  parts.push(
    `${primary.product.title} was selected because it scored highest across ${req.mode === "setup-builder" ? "your setup's categories" : "your requirements"}:`,
  );
  const bd = primary.scoreBreakdown;
  const strong: string[] = [];
  if (bd.relevance > 0.3) strong.push("a close match to the problem you described");
  if (bd.budget >= 0.75) strong.push("a comfortable fit for your budget");
  if (bd.features > 0.5) strong.push("specs that match your preferences");
  if (bd.freshness === 1) strong.push("a recently verified price");
  if (strong.length === 0) strong.push("the best overall balance in the catalogue");
  parts.push(strong.join(", ") + ".");
  if (alternatives.length > 0) {
    parts.push(
      `The alternatives below trade off differently — compare them before deciding.`,
    );
  }
  return parts.join(" ");
}

export interface SetupCategoryBudget {
  categorySlug: string;
  allocated: number;
  product: Product;
}

export interface SetupBuild {
  categories: SetupCategoryBudget[];
  total: number;
  remaining: number;
  overBudget: boolean;
  explanation: string;
  warnings: string[];
}

/**
 * Setup builder: distributes budget across distinct categories, picking the
 * best-scoring product per category without ever silently exceeding budget.
 */
export function buildSetup(req: ShoppingRequest): SetupBuild {
  const catalogue = getCatalogue();
  const tokens = tokenize(req.goal);
  const budget = req.budget ?? 150;

  // Rank products, then walk down the list taking at most one per category
  // until the budget is spent or the catalogue is exhausted.
  const ranked = catalogue
    .map((p) => scoreProduct(p, { ...req, budget: undefined }, tokens))
    .sort((a, b) => b.score - a.score);

  const chosen: Map<string, Product> = new Map();
  let spent = 0;
  const warnings: string[] = [];

  for (const { product } of ranked) {
    if (chosen.has(product.categorySlug)) continue;
    // Reserve room: don't take a mid/premium item if it would eat >70% of
    // remaining budget while we still have empty categories to fill.
    const categoriesLeft = new Set(
      catalogue.map((p) => p.categorySlug).filter((c) => !chosen.has(c)),
    ).size;
    const wouldSpend = spent + product.price;
    if (categoriesLeft > 1 && wouldSpend > budget * 0.7) continue;
    if (categoriesLeft === 1 && wouldSpend > budget) continue;
    chosen.set(product.categorySlug, product);
    spent = wouldSpend;
    if (chosen.size >= 4) break;
  }

  if (chosen.size === 0) {
    // Budget too small for the guardrails — take the single best cheap item.
    const cheapest = [...catalogue].sort((a, b) => a.price - b.price)[0];
    if (cheapest && cheapest.price <= budget) {
      chosen.set(cheapest.categorySlug, cheapest);
      spent = cheapest.price;
    } else {
      warnings.push(
        `Your budget of ${budget} ${req.currency} doesn't cover any catalogue item. Prices shown are in USD.`,
      );
    }
  }

  if (spent > budget) {
    warnings.push(
      `The selection totals ${spent.toFixed(2)} ${req.currency}, which exceeds your budget. Remove items to fit.`,
    );
  }

  const categories: SetupCategoryBudget[] = [...chosen.entries()].map(
    ([categorySlug, product]) => ({
      categorySlug,
      product,
      allocated: product.price,
    }),
  );

  const remaining = budget - spent;
  const overBudget = spent > budget;

  const explanation = categories.length
    ? `This setup spreads your budget across ${categories.length} categories: ${categories
        .map((c) => c.product.title)
        .join(", ")}. Each pick was the best-scored item in its category that still fit the overall budget.`
    : "No combination of catalogue items fits this budget.";

  return { categories, total: spent, remaining, overBudget, explanation, warnings };
}
