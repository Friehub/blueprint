import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadCatalogFromRoot, parseDocument } from "./index.js";
import { implicitCores } from "./catalog.js";

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

  it("marks global_standards and runtime_standards as implicit", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const implicit = implicitCores(result.value!);
    const implicitNames = implicit.map((c) => c.name);

    assert.ok(implicitNames.includes("global_standards"), "global_standards should be implicit");
    assert.ok(implicitNames.includes("runtime_standards"), "runtime_standards should be implicit");
    assert.ok(!implicitNames.includes("sagas"), "sagas should not be implicit");
    assert.equal(implicit.length, 2, "exactly 2 implicit cores");
  });

  it("extracts hardDeps and softDeps from billing", async () => {
    const file = join(ROOT, "contracts", "billing.md");
    const text = await readFile(file, "utf8");
    const result = parseDocument(file, text, "strict");

    assert.notEqual(result.value, null);
    assert.equal(result.value?.profile, "module-v1");
    const mod = result.value as { hardDeps: string[]; softDeps: string[] };
    assert.deepEqual(mod.hardDeps, ["payments", "users"]);
    assert.deepEqual(mod.softDeps, ["notifications", "audit_log", "usage_metering"]);
  });

  it("returns empty hardDeps for users (none)", async () => {
    const file = join(ROOT, "contracts", "users.md");
    const text = await readFile(file, "utf8");
    const result = parseDocument(file, text, "strict");

    assert.notEqual(result.value, null);
    const mod = result.value as { hardDeps: string[]; softDeps: string[] };
    assert.deepEqual(mod.hardDeps, []);
    assert.deepEqual(mod.softDeps, ["audit_log", "notifications", "permissions"]);
  });

  it("strips parenthetical notes from deps in cart", async () => {
    const file = join(ROOT, "contracts", "cart.md");
    const text = await readFile(file, "utf8");
    const result = parseDocument(file, text, "strict");

    assert.notEqual(result.value, null);
    const mod = result.value as { hardDeps: string[]; softDeps: string[] };
    assert.deepEqual(mod.hardDeps, ["catalog", "inventory", "promotions"]);
    assert.deepEqual(mod.softDeps, ["caching"]);
  });

  it("extracts coreInherits from assignments", async () => {
    const file = join(ROOT, "contracts", "assignments.md");
    const text = await readFile(file, "utf8");
    const result = parseDocument(file, text, "strict");

    assert.notEqual(result.value, null);
    const mod = result.value as { coreInherits: string[] };
    assert.ok(mod.coreInherits.includes("runtime_standards"), "assignments should inherit runtime_standards");
  });

  it("parses all modules and extracts coreInherits", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const withInherits = result.value!.modules.filter((m) => m.coreInherits.length > 0);
    assert.ok(withInherits.length > 0, "some modules should have coreInherits");

    for (const mod of withInherits) {
      for (const name of mod.coreInherits) {
        assert.ok(
          ["runtime_standards", "global_standards"].includes(name),
          `coreInherits should be a known core contract: ${name}`,
        );
      }
    }
  });
});
