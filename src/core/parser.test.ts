import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadCatalogFromRoot, parseDocument } from "./index.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("parser accuracy", () => {
  it("parses all contracts without errors", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");

    assert.ok(result.value!.modules.length >= 108, `Expected at least 108 modules, got ${result.value!.modules.length}`);
    assert.equal(result.issues.filter((i) => i.severity === "error").length, 0);
  });

  it("parses all 3 core contracts", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);
    assert.equal(result.value!.core.length, 3);
  });

  it("extracts functions from every module", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    for (const mod of result.value!.modules) {
      assert.ok(mod.functions.length > 0, `${mod.name} has no functions`);
    }
  });

  it("extracts hardDeps from every module that has them", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const modulesWithDeps = ["billing", "orders", "auth", "cart", "subscriptions"];
    for (const name of modulesWithDeps) {
      const mod = result.value!.modules.find((m) => m.name === name);
      assert.ok(mod, `${name} exists`);
      assert.ok(mod!.hardDeps.length > 0, `${name} has hardDeps`);
    }
  });

  it("extracts softDeps from every module that has them", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const modulesWithSoftDeps = ["billing", "orders", "auth", "users"];
    for (const name of modulesWithSoftDeps) {
      const mod = result.value!.modules.find((m) => m.name === name);
      assert.ok(mod, `${name} exists`);
      assert.ok(mod!.softDeps.length > 0, `${name} has softDeps`);
    }
  });

  it("extracts coreInherits from modules that reference runtime_standards", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const modulesWithInherits = result.value!.modules.filter((m) => m.coreInherits.length > 0);
    assert.ok(modulesWithInherits.length > 10, "multiple modules inherit core");
  });

  it("parses multi-line type definitions", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const ab_testing = result.value!.modules.find((m) => m.name === "ab_testing");
    assert.ok(ab_testing, "ab_testing exists");

    const variant = ab_testing!.types.find((t) => t.name === "Variant");
    assert.ok(variant, "Variant type exists");
    assert.ok(variant!.raw.length > 50, "Variant type has full definition");
  });

  it("parses shorthand type definitions", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const billing = result.value!.modules.find((m) => m.name === "billing");
    assert.ok(billing, "billing exists");

    const subscription = billing!.types.find((t) => t.name === "Subscription");
    assert.ok(subscription, "Subscription type exists");
    assert.ok(subscription!.raw.includes("id"), "Subscription has id field");
  });
});

describe("parser consistency", () => {
  it("produces same output on multiple runs", async () => {
    const result1 = await loadCatalogFromRoot(ROOT, "loose");
    const result2 = await loadCatalogFromRoot(ROOT, "loose");

    assert.equal(result1.value!.modules.length, result2.value!.modules.length);
    assert.equal(result1.value!.core.length, result2.value!.core.length);

    for (let i = 0; i < result1.value!.modules.length; i++) {
      const mod1 = result1.value!.modules[i]!;
      const mod2 = result2.value!.modules[i]!;
      assert.equal(mod1.name, mod2.name);
      assert.equal(mod1.functions.length, mod2.functions.length);
      assert.equal(mod1.hardDeps.length, mod2.hardDeps.length);
    }
  });

  it("preserves line numbers for all extracted items", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    for (const mod of result.value!.modules) {
      for (const fn of mod.functions) {
        assert.ok(fn.source.startLine > 0, `${mod.name}.${fn.name} has valid startLine`);
        assert.ok(fn.source.endLine >= fn.source.startLine, `${mod.name}.${fn.name} has valid endLine`);
      }
    }
  });
});

describe("specific contract accuracy", () => {
  it("billing has correct functions", async () => {
    const file = join(ROOT, "contracts", "billing.md");
    const text = await readFile(file, "utf8");
    const result = parseDocument(file, text, "strict");

    assert.equal(result.issues.length, 0);
    const mod = result.value as { functions: Array<{ name: string }> };
    const fnNames = mod.functions.map((f) => f.name);

    assert.ok(fnNames.includes("createSubscription"));
    assert.ok(fnNames.includes("getSubscription"));
    assert.ok(fnNames.includes("cancelSubscription"));
    assert.ok(fnNames.includes("getInvoices"));
  });

  it("orders has correct functions", async () => {
    const file = join(ROOT, "contracts", "orders.md");
    const text = await readFile(file, "utf8");
    const result = parseDocument(file, text, "strict");

    assert.equal(result.issues.length, 0);
    const mod = result.value as { functions: Array<{ name: string }> };
    const fnNames = mod.functions.map((f) => f.name);

    assert.ok(fnNames.includes("createOrder"));
    assert.ok(fnNames.includes("getOrder"));
    assert.ok(fnNames.includes("transitionOrderStatus"));
    assert.ok(fnNames.includes("cancelOrder"));
  });

  it("auth has correct functions", async () => {
    const file = join(ROOT, "contracts", "auth.md");
    const text = await readFile(file, "utf8");
    const result = parseDocument(file, text, "strict");

    assert.equal(result.issues.length, 0);
    const mod = result.value as { functions: Array<{ name: string }> };
    const fnNames = mod.functions.map((f) => f.name);

    assert.ok(fnNames.includes("signUp"));
    assert.ok(fnNames.includes("signIn"));
    assert.ok(fnNames.includes("signOut"));
    assert.ok(fnNames.includes("verifyToken"));
  });
});
