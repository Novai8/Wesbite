import { NextResponse } from "next/server";
import { getActiveProvider } from "@/lib/ai/groq";
import { recommend } from "@/lib/recommendation-engine";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { parseShoppingInput } from "@/lib/validation";
import type { ShoppingRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "recommend"), 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.resetInSec}s.` },
      { status: 429, headers: { "Retry-After": String(rl.resetInSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseShoppingInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const mode = (body as { mode?: string }).mode;
  const validModes = new Set(["assistant", "setup-builder", "problem-solver", "discover"]);
  const shoppingReq: ShoppingRequest = {
    ...parsed.value,
    mode: validModes.has(mode ?? "") ? (mode as ShoppingRequest["mode"]) : "assistant",
  };

  const result = recommend(shoppingReq);

  // AI layer rewrites only the explanation; scores and products stay engine-verified.
  let generatedBy = "deterministic";
  let explanation = result.explanation;
  if (process.env.GROQ_API_KEY) {
    const provider = getActiveProvider();
    const ai = await provider.explain({
      req: shoppingReq,
      primary: result.primary,
      alternatives: result.alternatives,
      deterministicExplanation: result.explanation,
    });
    explanation = ai.explanation;
    generatedBy = ai.provider;
  }

  return NextResponse.json({
    primary: {
      product: result.primary.product,
      score: Number(result.primary.score.toFixed(3)),
      scoreBreakdown: Object.fromEntries(
        Object.entries(result.primary.scoreBreakdown).map(([k, v]) => [k, Number(v.toFixed(2))]),
      ),
      reasons: result.primary.reasons,
    },
    alternatives: result.alternatives.map((a) => ({
      product: a.product,
      score: Number(a.score.toFixed(3)),
      reasons: a.reasons,
    })),
    explanation,
    generatedBy,
    remainingBudget: result.remainingBudget,
    warnings: result.warnings,
  });
}
