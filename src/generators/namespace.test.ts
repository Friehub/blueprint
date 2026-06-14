import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ContractFunction } from "../core/catalog.js";
import type { AdapterDefinition } from "../core/adapters/types.js";
import type { GeneratorContext, AliasMap } from "./types.js";
import { loadAliases, resolveAlias, obfuscateName } from "./aliases.js";
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
    assert.ok(iface.files.some((f) => f.path.startsWith("Acme/")), `${name}: interface file path should start with namespace directory`);

    const adap = gen.generateAdapter(ctx);
    const adapContent = adap.files.map((f) => f.content).join("\n");
    assert.ok(adapContent.includes(nsPrefix), `${name}: adapter should reference ${nsPrefix}`);
    assert.ok(adap.files.some((f) => f.path.startsWith("Acme/")), `${name}: adapter file path should start with namespace directory`);
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

function makeAliasCtx(aliases: AliasMap): GeneratorContext {
  const fn: ContractFunction = {
    name: "getData", params: [], returns: "string",
    signature: "getData() -> string", raw: "getData() -> string",
    source: { file: "test.md", startLine: 1, endLine: 1 },
  };
  const mod = {
    name: "payments", title: "test", version: "0.1.0", summary: "test",
    functions: [fn], types: [], invariants: [], providers: [],
    integrations: [], hardDeps: [], softDeps: [], coreInherits: [],
    rawSections: [], profile: "module-v1" as const,
    source: { file: "t.md", startLine: 1, endLine: 1 },
  };
  return {
    catalog: { modules: [mod], core: [] },
    adapters: [{ name: "stripe", module: "payments", version: "1.0", implements: ["getData"], config: { required: [], optional: [] } }],
    module: undefined, provider: undefined, aliases,
  };
}

describe("Function aliasing", () => {
  it("resolveAlias returns aliased name when matched", () => {
    const aliases: AliasMap = { functions: { getData: "fetchData" } };
    assert.equal(resolveAlias("getData", aliases), "fetchData");
  });

  it("resolveAlias returns original name when no match", () => {
    const aliases: AliasMap = { functions: { getData: "fetchData" } };
    assert.equal(resolveAlias("unknownFn", aliases), "unknownFn");
  });

  it("resolveAlias returns original when no aliases defined", () => {
    assert.equal(resolveAlias("getData"), "getData");
  });

  it("resolveAlias returns original when aliases is empty", () => {
    assert.equal(resolveAlias("getData", {}), "getData");
  });

  it("loadAliases returns null for non-existent file", () => {
    assert.equal(loadAliases("/tmp/nonexistent-aliases.json"), null);
  });

  it("TypeScript: aliases function names in generated interfaces", () => {
    const aliases: AliasMap = { functions: { getData: "fetchData" } };
    const ctx: GeneratorContext = {
      catalog: { modules: [testModule], core: [] },
      adapters: testAdapters,
      module: undefined,
      provider: undefined,
      aliases,
    };

    const gen = new TypeScriptGenerator();
    const result = gen.generateInterfaces(ctx);
    const content = result.files.map((f) => f.content).join("\n");
    assert.ok(content.includes("fetchData"), "should use aliased name");
    assert.ok(!content.includes("getData("), "should not contain original contract name as function call");
  });

  it("TypeScript: aliases function names in generated adapters", () => {
    const aliases: AliasMap = { functions: { getData: "fetchData" } };
    const ctx: GeneratorContext = {
      catalog: { modules: [testModule], core: [] },
      adapters: testAdapters,
      module: undefined,
      provider: undefined,
      aliases,
    };

    const gen = new TypeScriptGenerator();
    const result = gen.generateAdapter(ctx);
    const content = result.files.map((f) => f.content).join("\n");
    assert.ok(content.includes("fetchData"), "adapter should use aliased name");
  });

  it("Python: aliases function names", () => {
    const ctx = makeAliasCtx({ functions: { getData: "fetch_data" } });
    const gen = new PythonGenerator();
    const iface = gen.generateInterfaces(ctx);
    const content = iface.files.map((f) => f.content).join("\n");
    assert.ok(content.includes("fetch_data"), "Python interface should use aliased snake_case name");
  });

  it("Go: aliases function names", () => {
    const ctx = makeAliasCtx({ functions: { getData: "GetData" } });
    const gen = new GoGenerator();
    const iface = gen.generateInterfaces(ctx);
    const content = iface.files.map((f) => f.content).join("\n");
    assert.ok(content.includes("GetData"), "Go interface should use aliased PascalCase name");
  });

  it("Rust: aliases function names", () => {
    const ctx = makeAliasCtx({ functions: { getData: "fetch_data" } });
    const gen = new RustGenerator();
    const iface = gen.generateInterfaces(ctx);
    const content = iface.files.map((f) => f.content).join("\n");
    assert.ok(content.includes("fetch_data"), "Rust interface should use aliased snake_case name");
  });

  it("Java: aliases function names", () => {
    const ctx = makeAliasCtx({ functions: { getData: "fetchData" } });
    const gen = new JavaGenerator();
    const iface = gen.generateInterfaces(ctx);
    const content = iface.files.map((f) => f.content).join("\n");
    assert.ok(content.includes("fetchData"), "Java interface should use aliased camelCase name");
  });

  it("TypeScript: module aliasing changes file paths and interface names", () => {
    const ctx = makeAliasCtx({ modules: { payments: "billing" } });
    const gen = new TypeScriptGenerator();
    const iface = gen.generateInterfaces(ctx);
    const paths = iface.files.map((f) => f.path);
    const content = iface.files.map((f) => f.content).join("\n");
    assert.ok(paths.some((p) => p.includes("billing")), "interface path should use aliased module name");
    assert.ok(content.includes("BillingContract"), "interface should use aliased module name");
  });

  it("TypeScript: class aliasing changes adapter class name", () => {
    const ctx = makeAliasCtx({ classes: { StripeAdapter: "CardProcessor" } });
    const gen = new TypeScriptGenerator();
    const adap = gen.generateAdapter(ctx);
    const content = adap.files.map((f) => f.content).join("\n");
    assert.ok(content.includes("CardProcessor"), "adapter class should use aliased name");
    assert.ok(!content.includes("StripeAdapter"), "adapter class should not contain original name");
  });

  it("obfuscateName produces deterministic output", () => {
    const seed = "project-secret-123";
    const hash1 = obfuscateName(seed, "initiatePayment");
    const hash2 = obfuscateName(seed, "initiatePayment");
    assert.equal(hash1, hash2, "same seed + name should produce same hash");
    assert.ok(hash1.startsWith("fn_"), "should start with fn_");
    assert.equal(hash1.length, 11, "should be 11 chars (fn_ + 8 hex)");
  });

  it("obfuscateName different seeds produce different hashes", () => {
    const a = obfuscateName("seed1", "getData");
    const b = obfuscateName("seed2", "getData");
    assert.notEqual(a, b, "different seeds should produce different hashes");
  });

  it("obfuscateName empty seed returns original name", () => {
    assert.equal(obfuscateName("", "getData"), "getData");
  });

  it("TypeScript: obfuscation overrides aliases in generated output", () => {
    const fn: ContractFunction = {
      name: "getData", params: [], returns: "string",
      signature: "getData() -> string", raw: "getData() -> string",
      source: { file: "test.md", startLine: 1, endLine: 1 },
    };
    const mod = {
      name: "payments", title: "test", version: "0.1.0", summary: "test",
      functions: [fn], types: [], invariants: [], providers: [],
      integrations: [], hardDeps: [], softDeps: [], coreInherits: [],
      rawSections: [], profile: "module-v1" as const,
      source: { file: "t.md", startLine: 1, endLine: 1 },
    };
    const ctx: GeneratorContext = {
      catalog: { modules: [mod], core: [] },
      adapters: [{ name: "stripe", module: "payments", version: "1.0", implements: ["getData"],
        config: { required: [{ name: "api_key", type: "string", description: "key", secret: true }], optional: [] } }],
      module: undefined, provider: undefined,
      obfuscate: "test-seed",
    };
    const gen = new TypeScriptGenerator();
    const iface = gen.generateInterfaces(ctx);
    const content = iface.files.map((f) => f.content).join("\n");
    assert.ok(content.includes("fn_"), "obfuscated interface should contain hashed name");
    assert.ok(!content.includes("getData("), "should not contain original function name");
  });

  it("TypeScript: obfuscation also affects adapter class and config names", () => {
    const fn: ContractFunction = {
      name: "getData", params: [], returns: "string",
      signature: "getData() -> string", raw: "getData() -> string",
      source: { file: "test.md", startLine: 1, endLine: 1 },
    };
    const mod = {
      name: "payments", title: "test", version: "0.1.0", summary: "test",
      functions: [fn], types: [], invariants: [], providers: [],
      integrations: [], hardDeps: [], softDeps: [], coreInherits: [],
      rawSections: [], profile: "module-v1" as const,
      source: { file: "t.md", startLine: 1, endLine: 1 },
    };
    const ctx: GeneratorContext = {
      catalog: { modules: [mod], core: [] },
      adapters: [{ name: "stripe", module: "payments", version: "1.0", implements: ["getData"],
        config: { required: [{ name: "api_key", type: "string", description: "key", secret: true }], optional: [] } }],
      module: undefined, provider: undefined,
      obfuscate: "test-seed",
    };
    const gen = new TypeScriptGenerator();
    const adap = gen.generateAdapter(ctx);
    const content = adap.files.map((f) => f.content).join("\n");
    assert.ok(content.includes("fn_"), "obfuscated adapter should contain hashed names");
  });

  it("TypeScript: config aliasing changes constructor field names", () => {
    const fn: ContractFunction = {
      name: "getData", params: [], returns: "string",
      signature: "getData() -> string", raw: "getData() -> string",
      source: { file: "test.md", startLine: 1, endLine: 1 },
    };
    const mod = {
      name: "payments", title: "test", version: "0.1.0", summary: "test",
      functions: [fn], types: [], invariants: [], providers: [],
      integrations: [], hardDeps: [], softDeps: [], coreInherits: [],
      rawSections: [], profile: "module-v1" as const,
      source: { file: "t.md", startLine: 1, endLine: 1 },
    };
    const ctx: GeneratorContext = {
      catalog: { modules: [mod], core: [] },
      adapters: [{ name: "stripe", module: "payments", version: "1.0", implements: ["getData"],
        config: { required: [{ name: "api_key", type: "string", description: "API key", secret: true }], optional: [] } }],
      module: undefined, provider: undefined,
      aliases: { config: { api_key: "stripe_secret" } },
    };
    const gen = new TypeScriptGenerator();
    const adap = gen.generateAdapter(ctx);
    const content = adap.files.map((f) => f.content).join("\n");
    assert.ok(content.includes("stripe_secret"), "constructor should use aliased config name");
    assert.ok(!content.includes("api_key:"), "should not contain original config field name");
  });
});
