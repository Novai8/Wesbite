import type { ScoredProduct, ShoppingRequest } from "@/lib/types";

/**
 * AI provider interface.
 *
 * AI may rewrite only the human-facing *explanation* of recommendations.
 * It never produces product facts, prices, specs or scores — those always
 * come from the verified catalogue via the deterministic engine.
 */

export interface AiExplanationInput {
  req: ShoppingRequest;
  primary: ScoredProduct;
  alternatives: ScoredProduct[];
  deterministicExplanation: string;
}

export interface AiProviderResult {
  explanation: string;
  provider: "groq" | "none";
  error?: string;
}

export interface AiProvider {
  name: string;
  isConfigured(): boolean;
  explain(input: AiExplanationInput): Promise<AiProviderResult>;
}

const MAX_GOAL_LENGTH = 400;

function summariseRequest(req: ShoppingRequest): string {
  const bits: string[] = [`Goal: ${req.goal.slice(0, MAX_GOAL_LENGTH)}`];
  if (req.problem) bits.push(`Problem: ${req.problem.slice(0, MAX_GOAL_LENGTH)}`);
  if (req.budget) bits.push(`Budget: ${req.budget} ${req.currency}`);
  if (req.country) bits.push(`Shops from: ${req.country}`);
  if (req.preferences?.length) bits.push(`Preferences: ${req.preferences.join("; ").slice(0, 200)}`);
  return bits.join("\n");
}

function summariseProduct(sp: ScoredProduct): string {
  const p = sp.product;
  const reasons = sp.reasons.slice(0, 3).join("; ");
  return `- ${p.title} (${p.merchant}, ${p.currency} ${p.price.toFixed(2)}, category: ${p.categorySlug}) — engine reasons: ${reasons}`;
}

export function buildPrompt(input: AiExplanationInput): string {
  return [
    "You are writing a short, honest shopping recommendation note for Fyndra,",
    "a shopping discovery service. You are given the user's request and the",
    "products the deterministic engine selected with its reasons. Explain the",
    "primary pick in 2-3 sentences, and mention the main alternative once if",
    "useful. Plain, specific, no hype. Do NOT invent any product facts,",
    "prices, specifications, or claims that are not in the engine reasons",
    "below. If information is missing, say the data is limited.",
    "",
    "USER REQUEST:",
    summariseRequest(input.req),
    "",
    "ENGINE SELECTION (verified data — do not add to it):",
    summariseProduct(input.primary),
    ...input.alternatives.slice(0, 2).map(summariseProduct),
    "",
    "FALLBACK EXPLANATION (rewrite or improve on this, never contradict it):",
    input.deterministicExplanation,
  ].join("\n");
}

/** Sanitise model output: cap length, strip markdown artefacts. */
export function sanitiseExplanation(text: string): string {
  const clean = text
    .replace(/[*_#`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length < 20) throw new Error("Model output too short");
  return clean.slice(0, 800);
}
