import { ModelGroupSchema, Pass5Input } from "./schemas";
import { z } from "zod";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";

type ModelGroup = z.infer<typeof ModelGroupSchema>;

export interface GeneratedModel {
  modelId: string;
  tlaPath: string;
  cfgPath: string;
  tlaSource: string;
  cfgSource: string;
  workDir: string;
}

/**
 * Generates .tla and .cfg files for each model group.
 * Uses domain-specific templates for core fintech invariants.
 */
export async function generateModels(input: Pass5Input): Promise<GeneratedModel[]> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprinter-tla-"));
  const results: GeneratedModel[] = [];

  for (const group of input.model_groups) {
    const tlaSource = buildTlaModule(group);
    const cfgSource = buildTlaCfg(group);

    const tlaPath = path.join(workDir, `${group.model_id}.tla`);
    const cfgPath = path.join(workDir, `${group.model_id}.cfg`);

    await fs.writeFile(tlaPath, tlaSource, "utf8");
    await fs.writeFile(cfgPath, cfgSource, "utf8");

    results.push({ modelId: group.model_id, tlaPath, cfgPath, tlaSource, cfgSource, workDir });
  }

  return results;
}

function buildTlaModule(group: ModelGroup): string {
  const { model_id, variables, bounds, invariants, symmetry } = group;

  const constants = Object.keys(bounds).map(k => `${k}`).join(", ");
  const varList = variables.join(", ");
  
  // Choose template based on model_id or variables
  let actions = "";
  if (model_id.includes("Balance") || variables.includes("balance")) {
    actions = buildBalanceActions(bounds);
  } else if (model_id.includes("Idempotency") || variables.includes("idempotency_store")) {
    actions = buildIdempotencyActions(bounds);
  } else {
    actions = `Init ==\n  /\\ ${variables.map(v => `${v} = 0`).join("\n  /\\ ")}\n\nNext ==\n  UNCHANGED <<${varList}>>`;
  }

  const invariantDefs = invariants
    .map((inv) => `${inv.id} ==\n  ${inv.formal_assertion}`)
    .join("\n\n");

  const safetyInvariant = invariants
    .map((inv) => inv.id)
    .join(" /\\ ");

  return `---- MODULE ${model_id} ----
EXTENDS Naturals, FiniteSets, Sequences

CONSTANTS ${constants}

VARIABLES ${varList}

${actions}

${invariantDefs}

SafetyInvariant == ${safetyInvariant || "TRUE"}

Spec == Init /\\ [][Next]_<<${varList}>>
====`;
}

function buildBalanceActions(bounds: Record<string, number>): string {
  return `Init == 
  /\\ balance = [a \\in 1..MaxAccounts |-> 100]
  /\\ ledger = {}

Next ==
  \\E s, r \\in 1..MaxAccounts:
    \\E amt \\in 1..10:
      /\\ s /= r
      /\\ balance[s] >= amt
      /\\ balance' = [balance EXCEPT ![s] = @ - amt, ![r] = @ + amt]
      /\\ ledger' = ledger \\cup {[s |-> s, r |-> r, amt |-> amt]}`;
}

function buildIdempotencyActions(bounds: Record<string, number>): string {
  return `Init ==
  /\\ idempotency_store = [k \\in 1..MaxKeys |-> "none"]
  /\\ processed_count = 0

Next ==
  \\E k \\in 1..MaxKeys:
    /\\ IF idempotency_store[k] = "none"
       THEN /\\ idempotency_store' = [idempotency_store EXCEPT ![k] = "done"]
            /\\ processed_count' = processed_count + 1
       ELSE /\\ UNCHANGED <<idempotency_store, processed_count>>`;
}

function buildTlaCfg(group: ModelGroup): string {
  const constants = Object.entries(group.bounds)
    .map(([k, v]) => `CONSTANT ${k} = ${v}`)
    .join("\n");

  return `${constants}
SPECIFICATION Spec
INVARIANT SafetyInvariant`;
}
