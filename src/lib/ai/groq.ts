import { buildPrompt, sanitiseExplanation, type AiExplanationInput, type AiProvider, type AiProviderResult } from "./provider";

/**
 * Groq provider — server-side only. GROQ_API_KEY must come from the
 * environment; it is never sent to the browser. If unset or the call fails,
 * callers fall back to the deterministic explanation.
 */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";
const TIMEOUT_MS = 8000;

export const groqProvider: AiProvider = {
  name: "groq",
  isConfigured() {
    return Boolean(process.env.GROQ_API_KEY);
  },
  async explain(input: AiExplanationInput): Promise<AiProviderResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return { explanation: input.deterministicExplanation, provider: "none" };
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.4,
          max_tokens: 300,
          messages: [
            { role: "system", content: "You write concise, factual shopping notes. Never invent product details." },
            { role: "user", content: buildPrompt(input) },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        return {
          explanation: input.deterministicExplanation,
          provider: "none",
          error: `Groq returned ${res.status}`,
        };
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty completion");
      return { explanation: sanitiseExplanation(content), provider: "groq" };
    } catch (err) {
      return {
        explanation: input.deterministicExplanation,
        provider: "none",
        error: err instanceof Error ? err.message : "Groq request failed",
      };
    }
  },
};

export function getActiveProvider(): AiProvider {
  return groqProvider;
}
