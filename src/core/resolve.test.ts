import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadCatalogFromRoot } from "./index.js";
import { resolve, detectCycles } from "./resolve.js";
import { fileURLToPath } from "node:url";
import type { Catalog } from "./catalog.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function renderList(catalog: Catalog): string {
  const lines: string[] = [];
  lines.push("Modules:");
  for (const mod of catalog.modules.sort((a, b) => a.name.localeCompare(b.name))) {
    const deps = mod.hardDeps.length > 0 ? mod.hardDeps.join(", ") : "(none)";
    const soft = mod.softDeps.length > 0 ? mod.softDeps.join(", ") : "(none)";
    const summary = mod.summary ? ` — ${mod.summary}` : "";
    lines.push(`  ${mod.name}${summary}`);
    lines.push(`    deps: ${deps}`);
    lines.push(`    recommends: ${soft}`);
  }
  lines.push("");
  lines.push("Core contracts:");
  for (const c of catalog.core.sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`  ${c.name}${c.implicit ? " (implicit)" : ""}`);
  }
  return lines.join("\n");
}

describe("resolver", () => {
  it("resolves a module with no deps", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const resolved = resolve(result.value!, ["users"]);

    assert.equal(resolved.warnings.length, 0);
    assert.ok(resolved.modules.some((m) => m.name === "users" && m.source === "explicit"));
    assert.ok(resolved.core.length > 0, "should include implicit cores");
    assert.ok(resolved.core.every((c) => c.implicit), "all cores should be implicit");
  });

  it("resolves hard deps transitively", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const resolved = resolve(result.value!, ["billing"]);

    const names = resolved.modules.map((m) => m.name);
    assert.ok(names.includes("billing"), "explicit module present");
    assert.ok(names.includes("payments"), "hard dep of billing");
    assert.ok(names.includes("users"), "hard dep of billing");
    assert.ok(resolved.modules.find((m) => m.name === "payments")?.source === "hard-dep");
    assert.ok(resolved.modules.find((m) => m.name === "users")?.source === "hard-dep");
  });

  it("includes soft deps of explicitly requested modules", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const resolved = resolve(result.value!, ["billing"]);

    const softDeps = resolved.modules.filter((m) => m.source === "soft-dep").map((m) => m.name);
    assert.ok(softDeps.includes("notifications"), "soft dep of billing");
    assert.ok(softDeps.includes("audit_log"), "soft dep of billing");
  });

  it("does not include soft deps of hard-dep modules", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const resolved = resolve(result.value!, ["billing"]);

    const names = resolved.modules.map((m) => m.name);
    assert.ok(!names.includes("fraud_detection"), "fraud_detection is a soft dep of payments (hard-dep), should not be pulled");
  });

  it("warns on unknown module names", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const resolved = resolve(result.value!, ["nonexistent"]);

    assert.ok(resolved.warnings.some((w) => w.includes("nonexistent")));
    assert.equal(resolved.modules.length, 0);
  });

  it("always includes implicit core contracts", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const resolved = resolve(result.value!, ["catalog"]);

    const coreNames = resolved.core.map((c) => c.name);
    assert.ok(coreNames.includes("global_standards"));
    assert.ok(coreNames.includes("runtime_standards"));
  });

  it("includes core contracts inherited by resolved modules", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const resolved = resolve(result.value!, ["assignments"]);

    const coreNames = resolved.core.map((c) => c.name);
    assert.ok(coreNames.includes("runtime_standards"), "assignments inherits runtime_standards");
  });

  it("sorts explicit before hard-dep before soft-dep", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const resolved = resolve(result.value!, ["billing"]);

    const sources = resolved.modules.map((m) => m.source);
    const explicitIdx = sources.indexOf("explicit");
    const hardIdx = sources.indexOf("hard-dep");
    const softIdx = sources.indexOf("soft-dep");

    assert.ok(explicitIdx < hardIdx, "explicit comes before hard-dep");
    assert.ok(hardIdx < softIdx, "hard-dep comes before soft-dep");
  });

  it("detects no cycles in the real corpus", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const cycles = detectCycles(result.value!);
    assert.equal(cycles.length, 0, "no cycles expected in the real corpus");
  });

  it("list command output contains module names", async () => {
    const result = await loadCatalogFromRoot(ROOT, "loose");
    assert.notEqual(result.value, null);

    const output = renderList(result.value!);
    assert.ok(output.includes("billing"), "should list billing");
    assert.ok(output.includes("users"), "should list users");
    assert.ok(output.includes("Core contracts:"), "should list core section");
  });
});
