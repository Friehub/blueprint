import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ModuleContract, ContractFunction, ContractType } from "../core/catalog.js";
import type { LanguageGenerator, GeneratorContext, GeneratorResult, GeneratedFile } from "./types.js";
import type { AdapterDefinition } from "../core/adapters/types.js";
import { mapType, inferType, pascalCase } from "./types.js";
import { PythonGenerator } from "./python/index.js";
import { GoGenerator } from "./go/index.js";
import { TypeScriptGenerator } from "./typescript/index.js";

function makeContract(overrides: Partial<ModuleContract> = {}): ModuleContract {
  return {
    name: "test_module",
    title: "Module Contract: `test_module`",
    version: "0.1.0",
    summary: "A test module",
    functions: [],
    types: [],
    invariants: [],
    providers: [],
    integrations: [],
    hardDeps: [],
    softDeps: [],
    coreInherits: [],
    rawSections: [],
    profile: "module-v1",
    source: { file: "contracts/test_module.md", startLine: 1, endLine: 10 },
    ...overrides,
  };
}

function makeContext(overrides: Partial<GeneratorContext> = {}): GeneratorContext {
  return {
    catalog: { modules: [makeContract()], core: [] },
    adapters: [],
    module: undefined,
    provider: undefined,
    ...overrides,
  };
}

function extractFile(files: GeneratedFile[], path: string): string | undefined {
  return files.find((f) => f.path === path)?.content;
}

describe("Python generator — edge cases", () => {
  const gen: LanguageGenerator = new PythonGenerator();

  it("handles a module with no functions", () => {
    const mod = makeContract({ name: "empty_module", functions: [] });
    const ctx = makeContext({ catalog: { modules: [mod], core: [] } });
    const result = gen.generateInterfaces(ctx);
    assert.equal(result.errors.length, 0, `No errors: ${result.errors}`);
    const content = extractFile(result.files, "interfaces/empty_module.py");
    assert.ok(content, "should produce interface file");
    assert.ok(content!.includes("class EmptyModuleContract(ABC):"));
    assert.ok(content!.includes("class EmptyModuleError(Exception)"));
  });

  it("handles a module with no types", () => {
    const fn: ContractFunction = {
      name: "doSomething",
      params: [{ name: "input", type: "string", optional: false }],
      returns: "void",
      signature: "doSomething(input) → void",
      raw: "doSomething(input) → void",
      source: { file: "test.md", startLine: 1, endLine: 1 },
    };
    const mod = makeContract({ name: "notypes", functions: [fn], types: [] });
    const ctx = makeContext({ catalog: { modules: [mod], core: [] } });
    const result = gen.generateInterfaces(ctx);

    assert.equal(result.errors.length, 0);
    const content = extractFile(result.files, "interfaces/notypes.py");
    assert.ok(content, "should produce interface file");
    assert.ok(content!.includes("do_something"));
    assert.ok(content!.includes("async def"));
  });

  it("handles a function with no parameters", () => {
    const fn: ContractFunction = {
      name: "ping",
      params: [],
      returns: "string",
      signature: "ping() → string",
      raw: "ping() → string",
      source: { file: "test.md", startLine: 1, endLine: 1 },
    };
    const mod = makeContract({ name: "health", functions: [fn] });
    const ctx = makeContext({ catalog: { modules: [mod], core: [] } });
    const result = gen.generateInterfaces(ctx);

    assert.equal(result.errors.length, 0);
    const content = extractFile(result.files, "interfaces/health.py");
    assert.ok(content!.includes("async def ping(self) -> str"));
  });

  it("handles a function with many optional parameters", () => {
    const fn: ContractFunction = {
      name: "search",
      params: [
        { name: "query", type: "string", optional: false },
        { name: "limit", type: "number", optional: true },
        { name: "offset", type: "number", optional: true },
        { name: "sort_by", type: "string", optional: true },
        { name: "filter", type: "string", optional: true },
      ],
      returns: "PaginatedResult",
      signature: "search(query, limit?, offset?, sort_by?, filter?) → PaginatedResult",
      raw: "search(query, limit?, offset?, sort_by?, filter?) → PaginatedResult",
      source: { file: "test.md", startLine: 1, endLine: 1 },
    };
    const mod = makeContract({ name: "search_engine", functions: [fn] });
    const ctx = makeContext({ catalog: { modules: [mod], core: [] } });
    const result = gen.generateInterfaces(ctx);

    assert.equal(result.errors.length, 0);
    const content = extractFile(result.files, "interfaces/search_engine.py");
    assert.ok(content!.includes("Optional"), "should use Optional for nullable params");
    assert.ok(content!.includes("= None"), "should have None defaults");
  });

  it("handles type with generic container types", () => {
    const type: ContractType = {
      name: "Result",
      raw: "Result<T> { data: T, total: number }",
      source: { file: "test.md", startLine: 1, endLine: 1 },
    };
    const fn: ContractFunction = {
      name: "query",
      params: [],
      returns: "Result",
      signature: "query() → Result",
      raw: "query() → Result",
      source: { file: "test.md", startLine: 1, endLine: 1 },
    };
    const mod = makeContract({ name: "generic_test", types: [type], functions: [fn] });
    const ctx = makeContext({ catalog: { modules: [mod], core: [] } });
    const result = gen.generateInterfaces(ctx);

    assert.equal(result.errors.length, 0);
    const content = extractFile(result.files, "interfaces/generic_test.py");
    assert.ok(content, "should produce output for generic types");
  });

  it("handles empty invariants list", () => {
    const mod = makeContract({ name: "no_invariants", functions: [], invariants: [] });
    const ctx = makeContext({ catalog: { modules: [mod], core: [] } });
    const result = gen.generateInterfaces(ctx);
    assert.equal(result.errors.length, 0);
  });

  it("handles types with union values (enum-style)", () => {
    const type: ContractType = {
      name: "Color",
      raw: "Color = red | green | blue",
      source: { file: "test.md", startLine: 1, endLine: 1 },
    };
    const mod = makeContract({ name: "palette", types: [type] });
    const ctx = makeContext({ catalog: { modules: [mod], core: [] } });
    const result = gen.generateInterfaces(ctx);

    assert.equal(result.errors.length, 0);
    const content = extractFile(result.files, "interfaces/palette.py");
    assert.ok(content!.includes('Literal["red", "green", "blue"]'));
  });
});

describe("Go generator — edge cases", () => {
  const gen: LanguageGenerator = new GoGenerator();

  it("handles module with no functions", () => {
    const mod = makeContract({ name: "empty_go", functions: [] });
    const ctx = makeContext({ catalog: { modules: [mod], core: [] } });
    const result = gen.generateInterfaces(ctx);
    assert.equal(result.errors.length, 0, `No errors: ${result.errors}`);
    const content = extractFile(result.files, "interfaces/empty_go.go");
    assert.ok(content, "should produce interface file");
    assert.ok(content!.includes("type EmptyGoService interface"));
    assert.ok(content!.includes("var ErrEmptyGo"));
  });

  it("handles function with void return", () => {
    const fn: ContractFunction = {
      name: "deleteItem",
      params: [{ name: "id", type: "string", optional: false }],
      returns: "void",
      signature: "deleteItem(id) → void",
      raw: "deleteItem(id) → void",
      source: { file: "test.md", startLine: 1, endLine: 1 },
    };
    const mod = makeContract({ name: "crud", functions: [fn] });
    const ctx = makeContext({ catalog: { modules: [mod], core: [] } });
    const result = gen.generateInterfaces(ctx);

    assert.equal(result.errors.length, 0);
    const content = extractFile(result.files, "interfaces/crud.go");
    assert.ok(content!.includes("deleteItem"));
  });

  it("handles nested type definitions", () => {
    const type: ContractType = {
      name: "Nested",
      raw: "Nested { id: string, metadata: Record<string, unknown>, tags: string[] }",
      source: { file: "test.md", startLine: 1, endLine: 1 },
    };
    const mod = makeContract({ name: "nested_type", types: [type] });
    const ctx = makeContext({ catalog: { modules: [mod], core: [] } });
    const result = gen.generateInterfaces(ctx);

    assert.equal(result.errors.length, 0);
    const content = extractFile(result.files, "interfaces/nested_type.go");
    assert.ok(content, "should produce output for nested types");
  });
});

describe("Type inference — edge cases", () => {
  it("returns 'unknown' for completely opaque names", () => {
    assert.equal(inferType("x", "typescript"), "unknown");
    assert.equal(inferType("qwerty123", "python"), "unknown");
    assert.equal(inferType("customBlob", "go"), "unknown");
  });

  it("maps _id fields to string across all languages", () => {
    const names = ["user_id", "order_id", "payment_id", "id"];
    for (const name of names) {
      assert.equal(inferType(name, "python"), "str", `${name} → str`);
      assert.equal(inferType(name, "go"), "string", `${name} → string`);
      assert.equal(inferType(name, "typescript"), "string", `${name} → string`);
    }
  });

  it("maps _at fields to datetime/Time", () => {
    assert.equal(inferType("created_at", "python"), "str");
    assert.equal(inferType("updated_at", "go"), "time.Time");
    assert.equal(inferType("deleted_at", "typescript"), "Timestamp");
  });

  it("maps boolean-prefixed fields correctly", () => {
    assert.equal(inferType("is_active", "python"), "bool");
    assert.equal(inferType("isActive", "python"), "unknown", "camelCase not matched by _ pattern");
    assert.equal(inferType("has_children", "go"), "bool");
    assert.equal(inferType("is_deleted", "typescript"), "boolean");
  });

  it("maps amount/price to numeric types", () => {
    assert.equal(inferType("amount", "python"), "float");
    assert.equal(inferType("total_amount", "go"), "float64");
    assert.equal(inferType("unit_price", "typescript"), "number");
  });

  it("handles edge input like empty string and special chars", () => {
    assert.equal(inferType("", "typescript"), "unknown");
    assert.equal(inferType("_", "python"), "unknown");
    assert.equal(inferType("__", "go"), "unknown");
  });
});

describe("mapType — edge cases", () => {
  it("returns unmodified type when no mapping exists", () => {
    assert.equal(mapType("CustomType", "typescript"), "CustomType");
    assert.equal(mapType("MyRecord", "python"), "MyRecord");
  });

  it("handles array types for all languages", () => {
    assert.equal(mapType("string[]", "typescript"), "string[]");
    assert.equal(mapType("string[]", "python"), "list[str]");
    assert.equal(mapType("string[]", "go"), "[]string");
  });

  it("handles nullable types for all languages", () => {
    assert.equal(mapType("string?", "typescript"), "string | undefined");
    assert.equal(mapType("string?", "python"), "Optional[str]");
    assert.equal(mapType("string?", "go"), "*string");
  });

  it("handles chained nullable array types", () => {
    assert.equal(mapType("string?[]", "typescript"), "(string | undefined)[]");
    assert.equal(mapType("string?[]", "go"), "[]*string");
  });
});

describe("TypeScript generator — edge cases", () => {
  const gen: LanguageGenerator = new TypeScriptGenerator();

  it("handles module with duplicate-like function names gracefully", () => {
    const fn1: ContractFunction = {
      name: "getData",
      params: [{ name: "id", type: "string", optional: false }],
      returns: "Data",
      signature: "getData(id) → Data",
      raw: "getData(id) → Data",
      source: { file: "test.md", startLine: 1, endLine: 1 },
    };
    const fn2: ContractFunction = {
      name: "getData",
      params: [{ name: "id", type: "string", optional: false }, { name: "format", type: "string", optional: true }],
      returns: "Data",
      signature: "getData(id, format?) → Data",
      raw: "getData(id, format?) → Data",
      source: { file: "test.md", startLine: 2, endLine: 2 },
    };
    const mod = makeContract({ name: "overloaded", functions: [fn1, fn2] });
    const ctx = makeContext({ catalog: { modules: [mod], core: [] } });
    const result = gen.generateInterfaces(ctx);
    assert.equal(result.errors.length, 0);
  });

  it("handles module with null return type", () => {
    const fn: ContractFunction = {
      name: "findOptional",
      params: [{ name: "query", type: "string", optional: false }],
      returns: "null",
      signature: "findOptional(query) → null",
      raw: "findOptional(query) → null",
      source: { file: "test.md", startLine: 1, endLine: 1 },
    };
    const mod = makeContract({ name: "nullable_return", functions: [fn] });
    const ctx = makeContext({ catalog: { modules: [mod], core: [] } });
    const result = gen.generateInterfaces(ctx);
    assert.equal(result.errors.length, 0);
  });
});

describe("Language-filtered adapter generation", () => {
  const languages: Array<{ name: string; gen: LanguageGenerator }> = [
    { name: "TypeScript", gen: new TypeScriptGenerator() },
    { name: "Python", gen: new PythonGenerator() },
    { name: "Go", gen: new GoGenerator() },
  ];

  for (const { name, gen } of languages) {
    it(`${name}: skips adapters that do not declare language support`, () => {
      const adapterWithLanguages = {
        name: "ts_only_adapter",
        module: "test_module",
        version: "1.0",
        implements: ["getData"],
        config: { required: [], optional: [] },
        languages: ["typescript"],
      };
      const adapterAllLanguages = {
        name: "universal_adapter",
        module: "test_module",
        version: "1.0",
        implements: ["getData"],
        config: { required: [], optional: [] },
      };

      const ctx = makeContext({
        catalog: { modules: [makeContract({ name: "test_module", functions: [{ name: "getData", params: [], returns: "string", signature: "getData() -> string", raw: "getData() -> string", source: { file: "test.md", startLine: 1, endLine: 1 } }] })], core: [] },
        adapters: [adapterWithLanguages, adapterAllLanguages],
        module: undefined,
        provider: undefined,
      });

      const result = gen.generateAdapter(ctx);
      const adapterFiles = result.files.map((f) => f.path);

      if (gen.language === "typescript") {
        assert.ok(adapterFiles.some((f) => f.includes("ts_only_adapter")), `${name}: should include ts_only_adapter`);
        assert.ok(adapterFiles.some((f) => f.includes("universal_adapter")), `${name}: should include universal_adapter`);
      } else {
        assert.ok(!adapterFiles.some((f) => f.includes("ts_only_adapter")), `${name}: should skip ts_only_adapter`);
        assert.ok(adapterFiles.some((f) => f.includes("universal_adapter")), `${name}: should include universal_adapter`);
      }
    });
  }
});

describe("Generator — recovery from bad context", () => {
  const generators: Array<{ name: string; gen: LanguageGenerator }> = [
    { name: "TypeScript", gen: new TypeScriptGenerator() },
    { name: "Python", gen: new PythonGenerator() },
    { name: "Go", gen: new GoGenerator() },
  ];

  for (const { name, gen } of generators) {
    it(`${name}: returns empty result for empty catalog`, () => {
      const ctx = makeContext({ catalog: { modules: [], core: [] }, adapters: [] });
      const interfaces = gen.generateInterfaces(ctx);
      assert.equal(interfaces.errors.length, 0);
      const adapterResult = gen.generateAdapter(ctx);
      assert.equal(adapterResult.errors.length, 0);
      const testResult = gen.generateTests(ctx);
      assert.equal(testResult.errors.length, 0);
    });

    it(`${name}: reports error for non-existent adapter module`, () => {
      const ctx = makeContext({
        catalog: { modules: [makeContract()], core: [] },
        adapters: [{ name: "fake_provider", module: "non_existent_module", version: "1.0", implements: [], config: { required: [], optional: [] } }],
      });
      const result = gen.generateAdapter(ctx);
      assert.ok(result.errors.length > 0, `${name}: should report error for missing module`);
      assert.ok(result.errors[0]!.includes("non_existent_module"));
    });

    it(`${name}: handles filter to non-existent module`, () => {
      const ctx = makeContext({
        catalog: { modules: [], core: [] },
        module: "does_not_exist",
        provider: undefined,
      });
      const result = gen.generateInterfaces(ctx);
      assert.equal(result.errors.length, 0, `${name}: should have no errors for empty filter`);
      // Should still produce shared types file + possibly index
      assert.ok(result.files.length > 0, `${name}: should produce shared type files`);
    });
  }
});
