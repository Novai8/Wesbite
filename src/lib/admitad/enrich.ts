/**
 * AI enrichment for imported products.
 *
 * Scope, enforced by the prompt *and* by the shape of the output:
 *  - MAY write: a promotional headline, a short rewritten description, and
 *    quality flags about the record's completeness.
 *  - MUST NOT write: price, currency, availability, specs, images, ratings,
 *    review counts, sales numbers, discounts or any product fact.
 *
 * Output therefore lands in `ai_headline` / `ai_description` / `ai_quality_flags`
 * only. Source columns are never touched. If Groq is unset or fails, the caller
 * gets a `configured: false` result and nothing is written.
 */

import type { Product } from "@/lib/types";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";
const TIMEOUT_MS = 12_000;

export interface EnrichmentInput {
  product: Pick<
    Product,
    "title" | "description" | "categorySlug" | "price" | "currency" | "merchant" | "imageUrls" | "specs" | "availability" | "sourceUrl"
  >;
  /** Optional keywords from the source. Never generated. */
  keywords?: string[];
}

export interface EnrichmentResult {
  configured: boolean;
  headline?: string;
  description?: string;
  qualityFlags?: string[];
  provider: "groq" | "none";
  error?: string;
}

/**
 * Quality flags are computed deterministically from the record's own
 * completeness. This is the one "AI-ish" judgement we do NOT send to a model —
 * it is checkable, so it should be checked.
 */
export function computeQualityFlags(
  product: Pick<Product, "title" | "description" | "imageUrls" | "price" | "specs" | "availability" | "sourceUrl">,
): string[] {
  const flags: string[] = [];
  if (!product.imageUrls.length) flags.push("missing_image");
  if (!product.price || product.price <= 0) flags.push("missing_price");
  if (!product.description || product.description.length < 60) flags.push("thin_description");
  if (Object.keys(product.specs).length === 0) flags.push("no_specs");
  if (product.availability === "unknown") flags.push("unknown_availability");
  if (!product.sourceUrl) flags.push("missing_source_url");
  if (product.title.length > 150) flags.push("title_too_long");
  return flags;
}

function buildPrompt(input: EnrichmentInput): string {
  return [
    "You write short, factual product blurbs for a shopping catalogue.",
    "",
    "HARD RULES:",
    "- Use ONLY the fields given below. Do not add numbers, specs, materials,",
    "  dimensions, ratings, reviews, sales figures or discounts.",
    "- Do not claim quality, popularity or authenticity.",
    "- No exclamation marks, no hype, no emoji, no markdown.",
    "- If the source text is thin, write something plain instead of inventing.",
    "",
    "Return ONLY minified JSON:",
    '{"headline":"<=60 chars","description":"<=220 chars"}',
    "",
    "SOURCE FIELDS:",
    `Title: ${input.product.title}`,
    `Category: ${input.product.categorySlug}`,
    `Merchant: ${input.product.merchant}`,
    `Price: ${input.product.price} ${input.product.currency}`,
    `Source description: ${input.product.description.slice(0, 800)}`,
    input.keywords?.length ? `Keywords: ${input.keywords.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function sanitise(text: unknown, max: number): string | undefined {
  if (typeof text !== "string") return undefined;
  const clean = text.replace(/[*_#`>"]/g, "").replace(/\s+/g, " ").trim();
  if (clean.length < 8) return undefined;
  return clean.slice(0, max);
}

/** Rejects output that smuggles in facts not present in the input. */
export function looksLikeFabrication(output: string, input: EnrichmentInput): boolean {
  const numbers = output.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const allowed = new Set(
    [
      String(input.product.price),
      input.product.price.toFixed(2),
      input.product.currency,
      ...(input.product.title.match(/\d+(?:[.,]\d+)?/g) ?? []),
      ...(input.product.description.match(/\d+(?:[.,]\d+)?/g) ?? []),
    ].map((n) => n.toLowerCase()),
  );
  return numbers.some((n) => !allowed.has(n.toLowerCase()));
}

export async function enrichProduct(input: EnrichmentInput): Promise<EnrichmentResult> {
  const apiKey = process.env.GROQ_API_KEY;
  const qualityFlags = computeQualityFlags(input.product);

  if (!apiKey) {
    return { configured: false, provider: "none", qualityFlags };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 260,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You write restrained product copy. Never invent product facts.",
          },
          { role: "user", content: buildPrompt(input) },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { configured: true, provider: "none", qualityFlags, error: `Groq returned ${res.status}` };
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return { configured: true, provider: "none", qualityFlags, error: "Empty completion" };

    let parsed: { headline?: unknown; description?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { configured: true, provider: "none", qualityFlags, error: "Model returned non-JSON" };
    }

    const headline = sanitise(parsed.headline, 80);
    const description = sanitise(parsed.description, 260);

    const combined = `${headline ?? ""} ${description ?? ""}`;
    if (combined.trim() && looksLikeFabrication(combined, input)) {
      return {
        configured: true,
        provider: "none",
        qualityFlags,
        error: "Model output contained unverifiable figures; discarded.",
      };
    }

    return { configured: true, provider: "groq", headline, description, qualityFlags };
  } catch (err) {
    clearTimeout(timer);
    return {
      configured: true,
      provider: "none",
      qualityFlags,
      error: err instanceof Error ? err.message : "Groq request failed",
    };
  }
}
