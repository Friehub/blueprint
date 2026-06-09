import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ContractFunction } from "../core/catalog.js";
import type { AdapterDefinition } from "../core/adapters/types.js";
import type { GeneratorContext } from "./types.js";
import { TypeScriptGenerator } from "./typescript/index.js";
import { PythonGenerator } from "./python/index.js";
import { GoGenerator } from "./go/index.js";
import { RustGenerator } from "./rust/index.js";
import { JavaGenerator } from "./java/index.js";

const testFn: ContractFunction = {
  name: "getData",
  params: [],
  returns: "string",
  signature: "getData() -> string",
  raw: "getData() -> string",
  source: { file: "test.md", startLine: 1, endLine: 1 },
};

const testModule = {
  name: "payments",
  title: "Module Contract: `payments`",
  version: "0.1.0",
  summary: "Test module",
  functions: [testFn],
  types: [],
  invariants: [],
  providers: [],
  integrations: [],
  hardDeps: [],
  softDeps: [],
  coreInherits: [],
  rawSections: [],
  profile: "module-v1" as const,
  source: { file: "contracts/payments.md", startLine: 1, endLine: 10 },
};

const testAdapters: AdapterDefinition[] = [{
  name: "stripe",
  module: "payments",
  version: "1.0",
  implements: ["getData"],
  config: { required: [], optional: [] },
}];

type GenFactory = () => TypeScriptGenerator | PythonGenerator | GoGenerator | RustGenerator | JavaGenerator;

function testGenerator(
  name: string,
  factory: GenFactory,
  nsPrefix: string,
  defaultName: string,
) {
  it(`${name}: prefixes with namespace`, () => {
    const gen = factory();
    const ctx: GeneratorContext = {
      catalog: { modules: [testModule], core: [] },
      adapters: testAdapters,
      module: undefined,
      provider: undefined,
      namespace: "acme",
    };

    const iface = gen.generateInterfaces(ctx);
    const ifaceContent = iface.files.map((f) => f.content).join("\n");
    assert.ok(ifaceContent.includes(nsPrefix), `${name}: interface should contain ${nsPrefix}`);
    assert.ok(ifaceContent.includes('namespace: "acme"'), `${name}: should include namespace in comment`);

    const adap = gen.generateAdapter(ctx);
    const adapContent = adap.files.map((f) => f.content).join("\n");
    assert.ok(adapContent.includes(nsPrefix), `${name}: adapter should reference ${nsPrefix}`);
  });

  it(`${name}: uses default name without namespace`, () => {
    const gen2 = factory();
    const ctxNoNs: GeneratorContext = {
      catalog: { modules: [testModule], core: [] },
      adapters: testAdapters,
      module: undefined,
      provider: undefined,
    };

    const iface = gen2.generateInterfaces(ctxNoNs);
    const ifaceContent = iface.files.map((f) => f.content).join("\n");
    assert.ok(ifaceContent.includes(defaultName), `${name}: should contain ${defaultName}`);
    assert.ok(!ifaceContent.includes("Acme_"), `${name}: should not have prefix without namespace`);
  });
}

describe("Namespace prefix", () => {
  testGenerator("TypeScript", () => new TypeScriptGenerator(), "Acme_PaymentsContract", "PaymentsContract");
  testGenerator("Python", () => new PythonGenerator(), "Acme_PaymentsContract", "PaymentsContract");
  testGenerator("Go", () => new GoGenerator(), "Acme_PaymentsService", "PaymentsService");
  testGenerator("Rust", () => new RustGenerator(), "Acme_PaymentsContract", "PaymentsContract");
  testGenerator("Java", () => new JavaGenerator(), "Acme_PaymentsContract", "PaymentsContract");
});
