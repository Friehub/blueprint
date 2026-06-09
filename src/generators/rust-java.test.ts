import { strict as assert } from "node:assert";
import { describe, it, before } from "node:test";
import { loadCatalogFromRoot } from "../core/index.js";
import { loadAdapters } from "../core/adapters/load.js";
import { registerGenerator, generate, getAvailableLanguages } from "./engine.js";
import { RustGenerator } from "./rust/index.js";
import { JavaGenerator } from "./java/index.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ADAPTERS_DIR = join(ROOT, "adapters");

describe("Rust generator", () => {
  before(() => registerGenerator(new RustGenerator()));

  it("is registered", () => {
    assert.ok(getAvailableLanguages().includes("rust"));
  });

  it("generates interfaces for all modules", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "rust",
      type: "interfaces",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 100);
    assert.ok(genResult.files.some((f) => f.path.endsWith(".rs")));
  });

  it("generates adapters for all adapters", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "rust",
      type: "adapters",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 82);
  });

  it("generates tests for all adapters", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "rust",
      type: "tests",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 82);
  });

  it("generates for specific module", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "rust",
      type: "interfaces",
      module: "payments",
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.ok(genResult.files.some((f) => f.path.includes("payments")));
  });
});

describe("Java generator", () => {
  before(() => registerGenerator(new JavaGenerator()));

  it("is registered", () => {
    assert.ok(getAvailableLanguages().includes("java"));
  });

  it("generates interfaces for all modules", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "java",
      type: "interfaces",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 100);
    assert.ok(genResult.files.some((f) => f.path.endsWith(".java")));
  });

  it("generates adapters for all adapters", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "java",
      type: "adapters",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 82);
  });

  it("generates tests for all adapters", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "java",
      type: "tests",
      module: undefined,
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.equal(genResult.errors.length, 0, `No errors: ${genResult.errors.join(", ")}`);
    assert.ok(genResult.files.length >= 82);
  });

  it("generates for specific module", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    const { adapters } = await loadAdapters(ADAPTERS_DIR);

    const genResult = await generate(result.value!, adapters, {
      language: "java",
      type: "interfaces",
      module: "payments",
      provider: undefined,
      outputDir: "/tmp/test",
    });

    assert.ok(genResult.files.some((f) => f.path.includes("Payments")));
  });
});
