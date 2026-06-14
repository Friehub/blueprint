import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadCatalogFromRoot } from "../index.js";
import { loadAdapters, loadAdapter } from "./load.js";
import { validateAdapter } from "./validate.js";
import { loadSelection, addAdapter, removeAdapter } from "./select.js";
import { resolveAdapters, listAdaptersByModule } from "./resolve.js";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ADAPTERS_DIR = join(ROOT, "adapters");

describe("adapter system", () => {
  it("loads adapters from directory", async () => {
    const { adapters, errors } = await loadAdapters(ADAPTERS_DIR);

    assert.equal(errors.length, 0);
    assert.ok(adapters.length > 0);
    assert.ok(adapters.some((a) => a.name === "stripe"));
    assert.ok(adapters.some((a) => a.name === "redis"));
    assert.ok(adapters.some((a) => a.name === "bullmq"));
  });

  it("loads a single adapter", async () => {
    const { adapter, error } = await loadAdapter(ADAPTERS_DIR, "payments", "stripe");

    assert.equal(error, null);
    assert.notEqual(adapter, null);
    assert.equal(adapter?.name, "stripe");
    assert.equal(adapter?.module, "payments");
  });

  it("returns error for missing adapter", async () => {
    const { adapter, error } = await loadAdapter(ADAPTERS_DIR, "payments", "nonexistent");

    assert.equal(adapter, null);
    assert.ok(error?.includes("not found"));
  });

  it("validates adapter against contract", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const { adapter } = await loadAdapter(ADAPTERS_DIR, "payments", "stripe");
    assert.notEqual(adapter, null);

    const validation = validateAdapter(adapter!, result.value!);
    assert.ok(validation.issues.length >= 0);
    assert.ok(typeof validation.valid === "boolean");
  });

  it("lists adapters by module", async () => {
    const { adapters } = await loadAdapters(ADAPTERS_DIR);
    const byModule = listAdaptersByModule(adapters);

    assert.ok(byModule.payments);
    assert.ok(byModule.caching);
    assert.ok(byModule.queues);
    assert.ok(byModule.payments.includes("stripe"));
  });

  it("adds and removes adapter selection", async () => {
    const { selection: afterAdd, error: addError } = await addAdapter(ROOT, "payments", "stripe");
    assert.equal(addError, null);
    assert.equal(afterAdd.adapters.payments, "stripe");

    const { selection: afterRemove, error: removeError } = await removeAdapter(ROOT, "payments");
    assert.equal(removeError, null);
    assert.equal(afterRemove.adapters.payments, undefined);
  });

  it("resolves adapters with validation", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const { adapters } = await loadAdapters(ADAPTERS_DIR);
    const { selection } = await loadSelection(ROOT);

    const resolution = resolveAdapters(selection, adapters, result.value!);
    assert.ok(resolution.selected);
  });
});
