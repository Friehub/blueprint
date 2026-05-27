import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadCatalogFromRoot, parseDocument } from "./index.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("contract parser against real corpus files", () => {
  it("parses a legacy module doc with runtime integrations", async () => {
    const file = join(ROOT, "contracts", "billing.md");
    const text = await readFile(file, "utf8");
    const result = parseDocument(file, text, "strict");

    assert.equal(result.issues.some((issue) => issue.severity === "error"), false);
    assert.notEqual(result.value, null);
    assert.equal(result.value?.profile, "module-v1");
    assert.ok((result.value && "functions" in result.value ? result.value.functions.length : 0) > 0);
    assert.ok((result.value && "providers" in result.value ? result.value.providers.length : 0) > 0);
    assert.ok((result.value && "rawSections" in result.value ? result.value.rawSections.length : 0) > 0);
  });

  it("parses a module doc with inline provider text", async () => {
    const file = join(ROOT, "contracts", "feature_flags.md");
    const text = await readFile(file, "utf8");
    const result = parseDocument(file, text, "strict");

    assert.equal(result.issues.some((issue) => issue.severity === "error"), false);
    assert.notEqual(result.value, null);
    assert.equal(result.value?.profile, "module-v1");
    assert.ok((result.value && "functions" in result.value ? result.value.functions.length : 0) > 0);
    assert.ok((result.value && "providers" in result.value ? result.value.providers.length : 0) > 0);
  });

  it("parses a core doc with H3 section structure", async () => {
    const file = join(ROOT, "contracts", "core", "sagas.md");
    const text = await readFile(file, "utf8");
    const result = parseDocument(file, text, "strict");

    assert.equal(result.issues.some((issue) => issue.severity === "error"), false);
    assert.notEqual(result.value, null);
    assert.equal(result.value?.profile, "core-v1");
    assert.ok((result.value && "rawSections" in result.value ? result.value.rawSections.length : 0) > 0);
  });

  it("loads the full catalog from the repository root", async () => {
    const result = await loadCatalogFromRoot(ROOT, "strict");

    assert.equal(result.issues.some((issue) => issue.severity === "error"), false);
    assert.notEqual(result.value, null);
    assert.ok((result.value?.modules.length ?? 0) > 0);
    assert.ok((result.value?.core.length ?? 0) > 0);
  });
});
