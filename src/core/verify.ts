import { readFile } from "node:fs/promises";
import type { Catalog, ModuleContract, ContractFunction } from "./catalog.js";
import type { AliasMap } from "../generators/types.js";
import { obfuscateName } from "../generators/aliases.js";

export type VerificationIssue = {
  module: string;
  kind: "missing" | "extra" | "mismatch" | "file-not-found";
  function: string;
  expected?: string;
  actual?: string;
  message: string;
};

export type VerificationResult = {
  module: string;
  contractVersion: string | null;
  valid: boolean;
  implFunctions: string[];
  contractFunctions: string[];
  issues: VerificationIssue[];
};

export async function verifyImplementation(
  implementationFile: string,
  moduleName: string,
  catalog: Catalog,
  aliases?: AliasMap,
  obfuscateSeed?: string,
): Promise<VerificationResult> {
  const mod = catalog.modules.find((m) => m.name === moduleName);

  if (!mod) {
    return {
      module: moduleName,
      contractVersion: null,
      valid: false,
      implFunctions: [],
      contractFunctions: [],
      issues: [{ module: moduleName, kind: "file-not-found", function: "", message: `Module "${moduleName}" not found in catalog` }],
    };
  }

  let content: string;
  try {
    content = await readFile(implementationFile, "utf8");
  } catch {
    return {
      module: moduleName,
      contractVersion: mod.version,
      valid: false,
      implFunctions: [],
      contractFunctions: mod.functions.map((f) => f.name),
      issues: [{ module: moduleName, kind: "file-not-found", function: "", message: `File not found: ${implementationFile}` }],
    };
  }

  const issues: VerificationIssue[] = [];
  const implFns = extractFunctions(content);

  for (const fn of mod.functions) {
    const expectedName = fn.name;
    const aliasedOrObfuscated = obfuscateSeed
      ? obfuscateName(obfuscateSeed, expectedName)
      : aliases?.functions?.[expectedName] ?? expectedName;

    // Try matching by aliased/obfuscated name first, then by contract name
    const implFn = implFns.find((f) => f.name === aliasedOrObfuscated)
      ?? implFns.find((f) => f.name === expectedName);

    if (!implFn) {
      const expectedSig = formatSignature(fn);
      const msg = aliasedOrObfuscated !== expectedName
        ? `Missing: "${expectedName}" (aliased as "${aliasedOrObfuscated}")`
        : `Missing: ${expectedSig}`;
      issues.push({
        module: moduleName,
        kind: "missing",
        function: fn.name,
        expected: expectedSig,
        message: msg,
      });
    } else {
      const issues = compareReturnTypes(fn, implFn, moduleName);
      issues.push(...issues);
    }
  }

  return {
    module: moduleName,
    contractVersion: mod.version,
    valid: issues.filter((i) => i.kind === "missing" || i.kind === "mismatch").length === 0,
    implFunctions: [...implFns.keys()].map((n) => String(n)),
    contractFunctions: mod.functions.map((f) => f.name),
    issues,
  };
}

type ImplFunction = {
  name: string;
  returnType: string | null;
  returnTypeLine: number;
  hasReturnStatement: boolean;
};

function extractFunctions(content: string): ImplFunction[] {
  const functions: ImplFunction[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();

    if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;

    // Match: async initPayment(params): ReturnType {
    // Match: async initPayment(params) {
    // Match: initPayment(params): ReturnType {
    // Match: initPayment = async (params): ReturnType => {
    // Match: private async initPayment(params): ReturnType {
    const asyncMatch = line.match(
      /(?:private\s+|public\s+|protected\s+)?(?:async\s+)?(\w+)\s*[=(]\s*(?:async\s*)?[=(]?\s*(?:async\s*)?/
    );

    if (asyncMatch && isValidMethodName(asyncMatch[1]!)) {
      const name = asyncMatch[1]!;

      // Look for return type annotation
      let returnType: string | null = null;
      let returnTypeLine = i;

      // Check current line for return type
      const rtMatch = line.match(/\)\s*:\s*(\S+?)\s*[{=]/);
      if (rtMatch) {
        returnType = rtMatch[1]!.replace(/Promise<|>/g, "").split("|")[0]?.trim() ?? null;
        returnTypeLine = i;
      }

      // Check next lines for return type (multi-line)
      if (!returnType && i + 1 < lines.length) {
        const nextLine = lines[i + 1]!.trim();
        const nextMatch = nextLine.match(/\)\s*:\s*(\S+?)\s*[{=]/);
        if (nextMatch) {
          returnType = nextMatch[1]!.replace(/Promise<|>/g, "").split("|")[0]?.trim() ?? null;
          returnTypeLine = i + 1;
        }
      }

      // Check for return statements in the body
      let hasReturn = false;
      for (let j = i + 1; j < Math.min(lines.length, i + 20); j++) {
        if (lines[j]!.trim().startsWith("return ")) {
          hasReturn = true;
          break;
        }
        if (lines[j]!.trim() === "}") break;
      }

      functions.push({
        name,
        returnType,
        returnTypeLine,
        hasReturnStatement: hasReturn,
      });
    }
  }

  return functions;
}

function isValidMethodName(name: string): boolean {
  const RESERVED = new Set([
    "constructor", "if", "else", "for", "while", "return", "const", "let", "var", "new",
    "import", "export", "from", "typeof", "function", "class", "this", "throw", "try",
    "catch", "finally", "switch", "case", "default",
  ]);
  return !RESERVED.has(name) && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function formatSignature(fn: ContractFunction): string {
  const params = fn.params.map((p) => `${p.name}${p.optional ? "?" : ""}${p.type ? ": " + p.type : ""}`).join(", ");
  return `${fn.name}(${params}) → ${fn.returns}`;
}

function compareReturnTypes(fn: ContractFunction, implFn: ImplFunction, moduleName: string): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  if (fn.returns === "void" || fn.returns === "void?") {
    return issues;
  }

  if (!implFn.returnType) {
    if (!implFn.hasReturnStatement) {
      issues.push({
        module: moduleName,
        kind: "mismatch",
        function: fn.name,
        expected: fn.returns,
        message: `${fn.name}: expected return type "${fn.returns}" but no return type annotation found. Add return type.`,
      });
    }
    return issues;
  }

  const expected = fn.returns.toLowerCase().replace("?", "");
  const actual = implFn.returnType.toLowerCase();

  if (
    expected !== actual &&
    expected !== actual.replace("[]", "") &&
    !expected.includes(actual) &&
    !actual.includes(expected) &&
    actual !== "unknown" &&
    actual !== "any"
  ) {
    issues.push({
      module: moduleName,
      kind: "mismatch",
      function: fn.name,
      expected: fn.returns,
      actual: implFn.returnType,
      message: `${fn.name}: expected return type "${fn.returns}" but found "${implFn.returnType}"`,
    });
  }

  return issues;
}
