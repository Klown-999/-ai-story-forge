
import { z } from "zod/v3";
import { callGeminiStructured, callGroqStructured } from "@/lib/ai/providers";

type StructuredRequest<TSchema extends z.ZodTypeAny> = {
  system: string;
  user: string;
  schemaName: string;
  schema: TSchema;
  jsonSchema: Record<string, unknown>;
};

export async function callStructuredWithFallback<TSchema extends z.ZodTypeAny>(
  request: StructuredRequest<TSchema>
): Promise<z.infer<TSchema>> {
  const primary = (process.env.AI_PRIMARY_PROVIDER || "gemini").toLowerCase();
  const fallback = (process.env.AI_FALLBACK_PROVIDER || "groq").toLowerCase();
  const enableFallback = `${process.env.AI_ENABLE_FALLBACK}` !== "false";

  const tryProvider = async (provider: string) => {
    if (provider === "gemini") return callGeminiStructured(request);
    if (provider === "groq") return callGroqStructured(request);
    throw new Error(`Unsupported AI provider: ${provider}`);
  };

  try {
    return await tryProvider(primary);
  } catch (primaryError) {
    console.error(`[AI router] Primary provider "${primary}" failed:`, primaryError);

    if (!enableFallback || fallback === primary) {
      throw primaryError;
    }

    console.warn(`[AI router] Falling back to "${fallback}"`);
    return tryProvider(fallback);
  }
}
