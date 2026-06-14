import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadCatalogFromRoot } from "./index.js";
import { searchModules } from "./search.js";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("search", () => {
  it("finds modules by exact name", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const results = searchModules(result.value!, "billing");
    assert.ok(results.length > 0);
    assert.equal(results[0]!.module.name, "billing");
    assert.equal(results[0]!.score, 100);
  });

  it("finds modules by partial name", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const results = searchModules(result.value!, "bill");
    assert.ok(results.length > 0);
    assert.ok(results.some((r) => r.module.name === "billing"));
  });

  it("finds modules by summary", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const results = searchModules(result.value!, "subscription");
    assert.ok(results.length > 0);
    assert.ok(results.some((r) => r.module.name === "billing"));
  });

  it("returns empty for no matches", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const results = searchModules(result.value!, "zzzznonexistent");
    assert.equal(results.length, 0);
  });

  it("sorts by score", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const results = searchModules(result.value!, "payment");
    assert.ok(results.length > 1);
    assert.equal(results[0]!.module.name, "payments");
  });
});
