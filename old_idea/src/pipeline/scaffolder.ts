import { DecompositionOutput, DesignOutput } from "./schemas";
import * as path from "path";

export interface ScaffoldFile {
  path: string;
  content: string;
}

/**
 * Generates code stubs based on the verified design.
 * Enforces the "Core Rule": invariants as compiler-enforced contracts.
 */
export async function generateScaffold(
  target: "typescript-node" | "rust-axum" | "solidity",
  decomposition: DecompositionOutput,
  design: DesignOutput,
): Promise<ScaffoldFile[]> {
  if (target === "typescript-node") {
    return generateTypescriptNode(decomposition, design);
  }
  // TODO: Implement other targets
  throw new Error(`Scaffold target ${target} not yet implemented.`);
}

function generateTypescriptNode(
  decomposition: DecompositionOutput,
  design: DesignOutput,
): ScaffoldFile[] {
  const files: ScaffoldFile[] = [];

  // 1. Common Types (Branded Identifiers)
  files.push({
    path: "src/types/common.ts",
    content: `// SPEC[IMPLICIT_CONSTRAINT_3]: Domain identifiers are never raw strings.
declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type AccountId = Brand<string, "AccountId">;
export type PaymentId = Brand<string, "PaymentId">;
export type IdempotencyKey = Brand<string, "IdempotencyKey">;
export type TransactionReference = Brand<string, "TransactionReference">;
`
  });

  // 2. Money Class (Integer minor units only)
  files.push({
    path: "src/types/money.ts",
    content: `// SPEC[MONETARY_PRECISION, FM-006]: All monetary values in minor units.
export class Money {
  private constructor(private readonly minorUnits: bigint, readonly currency: string) {}

  static fromMinorUnits(units: bigint, currency: string): Money {
    return new Money(units, currency);
  }

  toMinorUnits(): bigint { return this.minorUnits; }

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error("Currency mismatch");
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }
}
`
  });

  // 3. Services (One per bounded context)
  for (const svc of decomposition.services) {
    const algorithms = design.algorithms.filter(a => a.service === svc.id);
    
    let serviceContent = `import { Result } from "../types/common";
import { Money } from "../types/money";
import { ${svc.id}Repository } from "./${svc.id.toLowerCase()}.repository";

export interface ${svc.name}Service {
${algorithms.map(alg => `  /**
   * SPEC: ${alg.operation}
   * See PIPELINE.md § Pass 4 — Algorithm: ${alg.operation}
   */
  ${toCamelCase(alg.operation)}(params: {
    ${alg.steps.some(s => s.description.includes("idempotency")) ? "idempotencyKey: string;" : ""}
    ${alg.preconditions.join(",\n    ")}
  }): Promise<void>;`).join("\n\n")}
}
`;
    files.push({
      path: `src/${svc.id.toLowerCase()}/${svc.id.toLowerCase()}.service.ts`,
      content: serviceContent
    });

    files.push({
      path: `src/${svc.id.toLowerCase()}/${svc.id.toLowerCase()}.repository.ts`,
      content: `export interface ${svc.id}Repository {
  // TODO: Add methods for: ${svc.owns.join(", ")}
}
`
    });
  }

  return files;
}

function toCamelCase(str: string): string {
  return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
}
