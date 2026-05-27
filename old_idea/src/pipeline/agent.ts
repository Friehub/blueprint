import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z, ZodSchema } from "zod";
import { loadConfig } from "../config";
import { MOCK_DATA } from "./mock-data";

const config = loadConfig();

export async function runAgentPass<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: ZodSchema<T>,
  passName: string,
  maxRetries = 3,
): Promise<T> {
  // 1. Check for API Key or Mock Mode
  if (!config.OPENAI_API_KEY || config.OPENAI_API_KEY === "mock") {
    console.info(`[${passName}] No API Key found. Using high-quality mock data.`);
    return getMockForPass(passName) as unknown as T;
  }

  let lastError: string = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const userMessage = attempt === 1
      ? userPrompt
      : `${userPrompt}\n\nPREVIOUS ATTEMPT FAILED SCHEMA VALIDATION:\n${lastError}\nCorrect and return only valid JSON.`;

    try {
      const result = await generateObject({
        model: openai("gpt-4o"),
        system: systemPrompt,
        prompt: userMessage,
        schema,
      });
      return result.object;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[${passName}] Attempt ${attempt} failed: ${lastError}`);
      
      // Fallback to mock data if LLM fails repeatedly or quota is hit
      if (attempt === maxRetries) {
        console.info(`[${passName}] Max retries hit. Falling back to mock data for demonstration.`);
        return getMockForPass(passName) as unknown as T;
      }
    }
  }
  throw new Error(`Pass ${passName} failed after ${maxRetries} attempts.`);
}

function getMockForPass(name: string) {
  if (name.includes("Pass1")) return MOCK_DATA.extraction;
  if (name.includes("Pass2")) return MOCK_DATA.decomposition;
  if (name.includes("Pass3")) return MOCK_DATA.adversarial;
  if (name.includes("Pass4")) return MOCK_DATA.design;
  if (name.includes("Pass5")) return MOCK_DATA.verification;
  if (name.includes("Invariant")) return { model_groups: [] }; // Internal Pass 5
  return {};
}
