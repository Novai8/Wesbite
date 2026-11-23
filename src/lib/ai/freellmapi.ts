/**
 * FreeLLMAPI adapter — server-side only.
 *
 * FreeLLMAPI is an OpenAI-compatible local gateway (default
 * `http://127.0.0.1:31415/v1`) that the user already runs. It is used for
 * low-stakes auxiliary reasoning only: product categorisation and a short
 * object label. It never provides product facts, prices or specs, and any
 * failure is non-fatal — the caller falls back to the catalogue's own data.
 *
 * The gateway is local to this machine. A remote deployment must point
 * `FREELLMAPI_BASE_URL` at a reachable, authenticated endpoint or this layer
 * simply stays off.
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:31415/v1";
const MODEL = "auto";
const TIMEOUT_MS = 20_000;

export interface ProductAnalysis {
  categorySlug?: string;
  objectLabel?: string;
  confidence?: "low" | "medium" | "high";
}

export function isFreeLlmConfigured(): boolean {
  return Boolean(process.env.FREELLMAPI_API_KEY);
}

function baseUrl(): string {
  return (process.env.FREELLMAPI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function extractOutputText(payload: unknown): string | undefined {
  const data = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  for (const item of data.output ?? []) {
    for (const part of item.content ?? []) {
      if (typeof part.text === "string" && part.text.trim()) return part.text;
    }
  }
  const choice = data.choices?.[0]?.message?.content;
  return typeof choice === "string" && choice.trim() ? choice : undefined;
}

function parseJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function sanitiseLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/[*_#`>\n\r]/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length < 3) return undefined;
  return clean.slice(0, 60);
}

/**
 * Ask FreeLLMAPI to categorise a product and suggest a short object label.
 * Returns `null` on any failure (no key, timeout, exhausted routing, bad
 * output). Callers must treat this as optional enrichment.
 */
export async function analyseProduct(input: {
  title: string;
  description?: string;
  categorySlug?: string;
  allowedCategories: string[];
}): Promise<ProductAnalysis | null> {
  const apiKey = process.env.FREELLMAPI_API_KEY;
  if (!apiKey) return null;

  const allowed = input.allowedCategories.length > 0 ? input.allowedCategories : ["uncategorised"];
  const prompt = [
    "You are a catalogue assistant for an ecommerce site.",
    `Allowed categories: ${allowed.join(", ")}.`,
    "Pick exactly one allowed category (or \"uncategorised\" if none fit).",
    "Also give a 3-6 word object label naming the physical item for 3D modelling.",
    "Do not invent prices or specifications.",
    "Reply with JSON only: {\"category\":\"...\",\"label\":\"...\"}",
    "",
    `Title: ${input.title.slice(0, 300)}`,
    input.description ? `Description: ${input.description.slice(0, 600)}` : "",
    input.categorySlug ? `Current catalogue category: ${input.categorySlug}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl()}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = extractOutputText(await res.json());
    if (!text) return null;
    const parsed = parseJsonLoose(text) as { category?: unknown; label?: unknown } | null;
    if (!parsed) return null;
    const category = typeof parsed.category === "string" ? parsed.category.trim() : undefined;
    return {
      categorySlug: category && allowed.includes(category) ? category : undefined,
      objectLabel: sanitiseLabel(parsed.label),
      confidence: category && allowed.includes(category) ? "medium" : "low",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
