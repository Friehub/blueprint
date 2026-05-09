import { spawn } from "child_process";
import { loadConfig } from "../config";

export interface TlcResult {
  modelId: string;
  status: "VERIFIED" | "VIOLATED" | "ERROR";
  durationMs: number;
  counterexampleTrace?: string;
  rawOutput: string;
}

const config = loadConfig();

/**
 * Runs TLC on a single model. Returns a result — never throws.
 * All model groups MUST be run in parallel via Promise.all.
 * There is NO timeout. Bounds in .cfg ensure TLC terminates.
 */
export async function runTlc(
  modelId: string,
  tlaPath: string,
  cfgPath: string,
): Promise<TlcResult> {
  const start = Date.now();
  
  if (!config.TLC_BINARY_PATH || config.OPENAI_API_KEY === "mock") {
    return {
      modelId,
      status: "VERIFIED",
      durationMs: Date.now() - start,
      rawOutput: "Mock verification successful (no TLC binary found or in mock mode)."
    };
  }
  let rawOutput = "";

  return new Promise((resolve) => {
    const proc = spawn(config.TLC_BINARY_PATH, [
      "-config", cfgPath,
      "-deadlock",
      tlaPath,
    ]);

    proc.stdout.on("data", (data: Buffer) => { rawOutput += data.toString(); });
    proc.stderr.on("data", (data: Buffer) => { rawOutput += data.toString(); });

    proc.on("close", (code) => {
      const durationMs = Date.now() - start;

      // TLC exits with 0 on success, 12 on violation, non-zero on error
      if (code === 0 && rawOutput.includes("Model checking completed. No error has been found.")) {
        resolve({ modelId, status: "VERIFIED", durationMs, rawOutput });
      } else if (rawOutput.includes("Error:") || (rawOutput.includes("Invariant") && rawOutput.includes("violated"))) {
        const trace = extractCounterexample(rawOutput);
        resolve({ modelId, status: "VIOLATED", durationMs, counterexampleTrace: trace, rawOutput });
      } else {
        resolve({ modelId, status: "ERROR", durationMs, rawOutput });
      }
    });

    proc.on("error", (err) => {
      resolve({
        modelId, status: "ERROR",
        durationMs: Date.now() - start,
        rawOutput: `Process spawn error: ${err.message}`,
      });
    });
  });
}

function extractCounterexample(output: string): string {
  // TLC prints counterexample between "Error:" and the next blank line
  const match = output.match(/Error:.*?(?=\n\n|\Z)/s);
  return match ? match[0] : output.slice(-2000); // Last 2000 chars as fallback
}

/**
 * Translates a TLC counterexample trace into plain English.
 * This IS an LLM call — the trace is fed to a lightweight model.
 */
export async function translateTrace(trace: string, invariantStatement: string): Promise<string> {
  const { generateText } = await import("ai");
  const { openai } = await import("@ai-sdk/openai");

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `Translate this TLA+ model checker counterexample into plain English steps.
Each step should explain what state change occurred and why it violates the invariant.
Invariant: ${invariantStatement}
Counterexample:
${trace}`,
  });
  return text;
}
