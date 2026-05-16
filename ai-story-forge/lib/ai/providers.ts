
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod/v3";

type StructuredRequest<TSchema extends z.ZodTypeAny> = {
  system: string;
  user: string;
  schemaName: string;
  schema: TSchema;
  jsonSchema: Record<string, unknown>;
};

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  return new GoogleGenAI({ apiKey });
}

function createGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonSafely(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    const cleaned = trimmed
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    return JSON.parse(cleaned);
  }

  return JSON.parse(trimmed);
}

export async function callGeminiStructured<TSchema extends z.ZodTypeAny>(
  request: StructuredRequest<TSchema>
): Promise<z.infer<TSchema>> {
  const client = createGeminiClient();
  const model = process.env.GEMINI_MODEL_PRIMARY || "gemini-3.1-flash-lite";

  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${request.system}

IMPORTANT:
- Return ONLY valid JSON.
- Do not wrap the response in markdown.
- Do not omit required fields.
- If an array is empty, return [].
- If a string field has no meaningful value, return an empty string.

${request.user}`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: request.jsonSchema,
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error(`Gemini model ${model} returned empty content`);
      }

      const parsedJson = parseJsonSafely(text);
      return request.schema.parse(parsedJson);
    } catch (error: any) {
      lastError = error;

      const status = error?.status;
      const isRetryable = status === 503 || status === 429;

      if (isRetryable && attempt < maxAttempts) {
        const delay = 1500 * attempt;
        console.warn(
          `[Gemini] Attempt ${attempt} failed with status ${status}. Retrying in ${delay}ms...`
        );
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

export async function callGroqStructured<TSchema extends z.ZodTypeAny>(
  request: StructuredRequest<TSchema>
): Promise<z.infer<TSchema>> {
  const client = createGroqClient();
  const model = process.env.GROQ_MODEL_FALLBACK || "openai/gpt-oss-20b";

  console.log("[Groq] Using fallback model:", model);

  const maxAttempts = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: `${request.system}

IMPORTANT OUTPUT RULES:
- Return ONLY a valid JSON object.
- Do not use markdown.
- Do not explain anything outside JSON.
- Include ALL required fields.
- Use empty arrays [] instead of omitting array fields.
- Use empty string "" instead of omitting string fields.

Expected JSON schema shape:
${JSON.stringify(request.jsonSchema, null, 2)}`,
          },
          { role: "user", content: request.user },
        ],
        response_format: {
          type: "json_object",
        },
        temperature: 0.1,
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error(`Groq model ${model} returned empty content`);
      }

      const parsedJson = parseJsonSafely(content);
      return request.schema.parse(parsedJson);
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        console.warn(
          `[Groq] Attempt ${attempt} failed. Retrying once with same fallback model...`
        );
        await sleep(1200);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}
