export const CURRENCIES = ["USD", "EUR", "GBP"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

const MAX_GOAL = 500;
const MAX_PROBLEM = 800;
const MAX_COUNTRY = 60;
const MAX_PREFERENCES = 8;

export interface ParsedShoppingInput {
  goal: string;
  problem?: string;
  budget?: number;
  currency: CurrencyCode;
  country?: string;
  preferences: string[];
}

export function parseShoppingInput(body: unknown): { ok: true; value: ParsedShoppingInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const raw = body as Record<string, unknown>;

  const goal = typeof raw.goal === "string" ? raw.goal.trim() : "";
  if (goal.length < 5) {
    return { ok: false, error: "Describe what you're looking for in at least a few words." };
  }
  if (goal.length > MAX_GOAL) {
    return { ok: false, error: `Keep the goal under ${MAX_GOAL} characters.` };
  }

  let problem: string | undefined;
  if (raw.problem != null) {
    if (typeof raw.problem !== "string") return { ok: false, error: "Problem must be text." };
    problem = raw.problem.trim().slice(0, MAX_PROBLEM) || undefined;
  }

  let budget: number | undefined;
  if (raw.budget != null && raw.budget !== "") {
    const n = Number(raw.budget);
    if (!Number.isFinite(n) || n < 0 || n > 100_000) {
      return { ok: false, error: "Budget must be a number between 0 and 100000." };
    }
    budget = n > 0 ? n : undefined;
  }

  const currency = CURRENCIES.includes(raw.currency as CurrencyCode)
    ? (raw.currency as CurrencyCode)
    : "USD";

  let country: string | undefined;
  if (typeof raw.country === "string" && raw.country.trim()) {
    country = raw.country.trim().slice(0, MAX_COUNTRY);
  }

  const preferences = Array.isArray(raw.preferences)
    ? raw.preferences
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, MAX_PREFERENCES)
    : [];

  return { ok: true, value: { goal, problem, budget, currency, country, preferences } };
}
