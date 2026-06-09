import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadCatalogFromRoot } from "../core/index.js";
import { loadAdapters } from "../core/adapters/load.js";
import { registerGenerator, generate, getAvailableLanguages } from "./engine.js";
import { TypeScriptGenerator } from "./typescript/index.js";
import { PythonGenerator } from "./python/index.js";
import { GoGenerator } from "./go/index.js";
import { pascalCase, camelCase, snakeCase, mapType, inferType } from "./types.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ADAPTERS_DIR = join(ROOT, "adapters");

describe("generator engine", () => {
  it("registers TypeScript generator", () => {
    registerGenerator(new TypeScriptGenerator());
    const languages = getAvailableLanguages();
    assert.ok(languages.includes("typescript"));
  });

  it("registers Python generator", () => {
    registerGenerator(new PythonGenerator());
    const languages = getAvailableLanguages();
    assert.ok(languages.includes("python"));
  });

  it("registers Go generator", () => {
    registerGenerator(new GoGenerator());
    const languages = getAvailableLanguages();
    assert.ok(languages.includes("go"));
  });

  it("generates interfaces for all modules", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "typescript",
      type: "interfaces",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 100, `At least 100 interface files, got ${genResult.files.length}`);
  });

  it("generates adapters for all 82 adapters", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "typescript",
      type: "adapters",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 82, `At least 82 adapter files, got ${genResult.files.length}`);
  });

  it("generates tests for all 82 adapters", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "typescript",
      type: "tests",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 82, `At least 82 test files, got ${genResult.files.length}`);
  });

  it("generates for specific module", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "typescript",
      type: "all",
      module: "billing",
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.ok(genResult.files.some((f) => f.path.includes("billing")));
  });

  it("generates for specific adapter", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "typescript",
      type: "adapters",
      module: "payments",
      provider: "stripe",
      outputDir: "/tmp/test",
    });

    assert.ok(genResult.files.some((f) => f.path.includes("stripe")));
  });

  it("generates python interfaces for all modules", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "python",
      type: "interfaces",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 100);
    assert.ok(genResult.files.some((f) => f.path.endsWith(".py")));
  });

  it("generates python adapters", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "python",
      type: "adapters",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 82);
  });

  it("generates python tests for all adapters", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "python",
      type: "tests",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 82);
  });

  it("generates go interfaces for all modules", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "go",
      type: "interfaces",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 100);
    assert.ok(genResult.files.some((f) => f.path.endsWith(".go")));
  });

  it("generates go adapters", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "go",
      type: "adapters",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 82);
  });

  it("generates go tests for all adapters", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "go",
      type: "tests",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 82);
  });
});

describe("type utilities", () => {
  it("pascalCase converts correctly", () => {
    assert.equal(pascalCase("billing"), "Billing");
    assert.equal(pascalCase("user_management"), "UserManagement");
    assert.equal(pascalCase("api-keys"), "ApiKeys");
  });

  it("camelCase converts correctly", () => {
    assert.equal(camelCase("billing"), "billing");
    assert.equal(camelCase("user_management"), "userManagement");
    assert.equal(camelCase("api-keys"), "apiKeys");
  });

  it("snakeCase converts correctly", () => {
    assert.equal(snakeCase("billing"), "billing");
    assert.equal(snakeCase("userManagement"), "user_management");
    assert.equal(snakeCase("api-keys"), "api_keys");
  });

  it("mapType converts correctly", () => {
    assert.equal(mapType("string", "typescript"), "string");
    assert.equal(mapType("number", "rust"), "f64");
    assert.equal(mapType("boolean", "python"), "bool");
    assert.equal(mapType("string[]", "typescript"), "string[]");
    assert.equal(mapType("string?", "typescript"), "string | undefined");
  });

  it("inferType infers correctly", () => {
    assert.equal(inferType("id", "typescript"), "string");
    assert.equal(inferType("user_id", "typescript"), "string");
    assert.equal(inferType("created_at", "typescript"), "Timestamp");
    assert.equal(inferType("is_active", "typescript"), "boolean");
    assert.equal(inferType("amount", "typescript"), "number");
  });
});
