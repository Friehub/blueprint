import { readFile } from "node:fs/promises";
import type { Catalog, ModuleContract, ContractFunction } from "./catalog.js";

export type VerificationIssue = {
  module: string;
  kind: "missing" | "extra" | "mismatch";
  function: string;
  expected?: string;
  actual?: string;
  message: string;
};

export type VerificationResult = {
  module: string;
  valid: boolean;
  issues: VerificationIssue[];
};

export async function verifyImplementation(
  implementationFile: string,
  moduleName: string,
  catalog: Catalog,
): Promise<VerificationResult> {
  const issues: VerificationIssue[] = [];
  const mod = catalog.modules.find((m) => m.name === moduleName);

  if (!mod) {
    return {
      module: moduleName,
      valid: false,
      issues: [{ module: moduleName, kind: "missing", function: "", message: `Module "${moduleName}" not found in catalog` }],
    };
  }

  let content: string;
  try {
    content = await readFile(implementationFile, "utf8");
  } catch {
    return {
      module: moduleName,
      valid: false,
      issues: [{ module: moduleName, kind: "missing", function: "", message: `File not found: ${implementationFile}` }],
    };
  }

  // Extract function names from implementation file
  const implFns = new Set<string>();
  const funcRegex = /async\s+(\w+)\s*\(|(\w+)\s*:\s*async\s*\(|(\w+)\s*\([^)]*\)\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1] || match[2] || match[3];
    if (name && name !== "constructor") implFns.add(name);
  }

  // Check each contract function
  for (const fn of mod.functions) {
    if (!implFns.has(fn.name)) {
      const expectedSig = `${fn.name}(${fn.params.map((p) => `${p.name}${p.optional ? "?" : ""}`).join(", ")})`;
      issues.push({
        module: moduleName,
        kind: "missing",
        function: fn.name,
        expected: expectedSig,
        message: `Missing implementation: ${expectedSig}`,
      });
    }
  }

  return {
    module: moduleName,
    valid: issues.length === 0,
    issues,
  };
}
