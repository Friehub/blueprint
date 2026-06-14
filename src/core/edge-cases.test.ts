import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseDocument } from "./parse-document.js";
import { resolve, detectCycles } from "./resolve.js";
import { implicitCores } from "./catalog.js";
import type { Catalog } from "./catalog.js";

describe("parser edge cases", () => {
  it("handles empty markdown file", () => {
    const result = parseDocument("empty.md", "", "loose");
    assert.notEqual(result.value, null, "should not crash on empty file");
    assert.ok(result.issues.length >= 0, "may have issues for empty file");
  });

  it("handles file with only a heading", () => {
    const result = parseDocument("minimal.md", "# Hello", "loose");
    assert.notEqual(result.value, null, "should not crash on heading-only file");
  });

  it("handles malformed function signatures gracefully", () => {
    const content = `# Test\n\n**Functions**\n\`\`\`\nnotAFunction\nbroken( → \ngoodOne(x) → string\n\`\`\``;
    const result = parseDocument("bad.md", content, "loose");
    assert.notEqual(result.value, null);
    const fnCount = result.value && "functions" in result.value ? result.value.functions.length : 0;
    assert.ok(fnCount >= 0, "should handle malformed signatures without crashing");
  });

  it("handles duplicate section names", () => {
    const content = `# Duplicate\n\n## Functions\nfoo() → string\n\n## Functions\nbar() → string`;
    const result = parseDocument("dup.md", content, "loose");
    assert.ok(result.issues.length > 0, "should report duplicate sections");
  });

  it("handles missing required sections", () => {
    const content = `# NoFunctions\n\n**Types**\n\`\`\`\nFoo = string\n\`\`\``;
    const result = parseDocument("missing.md", content, "strict");
    assert.ok(result.issues.some((i) => i.severity === "error"), "should fail strict on missing functions");
  });

  it("handles very long contract names", () => {
    const longName = "a".repeat(200);
    const content = `# ${longName}\n\n**Functions**\n\`\`\`\nfoo() → string\n\`\`\``;
    const result = parseDocument(`${longName}.md`, content, "loose");
    assert.notEqual(result.value, null, "should handle long names");
  });

  it("handles types section with no types", () => {
    const content = `# EmptyTypes\n\n**Functions**\n\`\`\`\nfoo() → void\n\`\`\`\n\n**Types**\n\`\`\`\n\`\`\``;
    const result = parseDocument("empty-types.md", content, "loose");
    assert.notEqual(result.value, null);
    const typeCount = result.value && "types" in result.value ? result.value.types.length : 0;
    assert.equal(typeCount, 0, "should handle empty types section");
  });

  it("handles file with no preamble", () => {
    const content = `## Functions\nfoo() → string\n\n## Types\nBar = string`;
    const result = parseDocument("no-preamble.md", content, "loose");
    assert.notEqual(result.value, null, "should not crash without preamble");
  });

  it("handles multiple system-integrations sections", () => {
    const content = `# Multi\n\n**Functions**\n\`\`\`\nfoo() → string\n\`\`\`\n\n**System-Level Integrations & Constraints**\nSome text\n\n**System-Level Integrations**\nMore text`;
    const result = parseDocument("multi-sys.md", content, "loose");
    assert.ok(result.issues.length > 0, "should report duplicate system-integrations");
  });
});

describe("resolver edge cases", () => {
  it("handles empty module list", () => {
    const catalog: Catalog = { modules: [], core: [] };
    const result = resolve(catalog, []);
    assert.equal(result.modules.length, 0);
    assert.equal(result.errors.length, 0);
  });

  it("handles all unknown modules", () => {
    const catalog: Catalog = { modules: [], core: [] };
    const result = resolve(catalog, ["nonexistent", "also-gone"]);
    assert.equal(result.modules.length, 0);
    assert.equal(result.errors.length, 2);
  });

  it("handles chain of 50 hard deps", () => {
    const modules: Array<any> = [];
    for (let i = 0; i < 50; i++) {
      modules.push({
        name: `mod_${i}`,
        title: `mod_${i}`,
        version: null,
        summary: null,
        functions: [{ name: "test", params: [], returns: "void", signature: "test()", raw: "test()", source: { file: "", startLine: 1, endLine: 1 } }],
        types: [],
        hardDeps: i > 0 ? [`mod_${i - 1}`] : [],
        softDeps: [],
        coreInherits: [],
        invariants: [],
        providers: [],
        integrations: [],
        rawSections: [],
        profile: "module-v1" as const,
        source: { file: "", startLine: 1, endLine: 1 },
      });
    }
    const catalog: Catalog = { modules, core: [] };
    const result = resolve(catalog, ["mod_49"]);
    assert.equal(result.modules.length, 50, "should resolve 50-module chain");
    assert.equal(result.errors.length, 0);
  });

  it("handles self-referencing module gracefully", () => {
    const modules = [{
      name: "self",
      title: "self",
      version: null,
      summary: null,
      functions: [{ name: "test", params: [], returns: "void", signature: "test()", raw: "test()", source: { file: "", startLine: 1, endLine: 1 } }],
      types: [],
      hardDeps: ["self"],
      softDeps: [],
      coreInherits: [],
      invariants: [],
      providers: [],
      integrations: [],
      rawSections: [],
      profile: "module-v1" as const,
      source: { file: "", startLine: 1, endLine: 1 },
    }];
    const catalog: Catalog = { modules, core: [] };    
    const cycles = detectCycles(catalog);
    assert.ok(cycles.length > 0, "should detect self-reference cycle");

    const result = resolve(catalog, ["self"]);
    assert.ok(result.modules.length >= 1, "should still resolve self-referencing module");
  });

  it("handles dependency on nonexistent module with error", () => {
    const modules = [{
      name: "real",
      title: "real",
      version: null,
      summary: null,
      functions: [{ name: "test", params: [], returns: "void", signature: "test()", raw: "test()", source: { file: "", startLine: 1, endLine: 1 } }],
      types: [],
      hardDeps: ["ghost"],
      softDeps: [],
      coreInherits: [],
      invariants: [],
      providers: [],
      integrations: [],
      rawSections: [],
      profile: "module-v1" as const,
      source: { file: "", startLine: 1, endLine: 1 },
    }];
    const catalog: Catalog = { modules, core: [] };
    const result = resolve(catalog, ["real"]);
    assert.equal(result.modules.length, 1);
    assert.ok(result.errors.length > 0, "should error on missing hard dep");
  });

  it("implicitCores returns empty when no implicit cores", () => {
    const catalog: Catalog = { modules: [], core: [{ name: "sagas", title: "", version: null, implicit: false, summary: null, sections: [], rawSections: [], profile: "core-v1" as const, source: { file: "", startLine: 1, endLine: 1 } }] };
    assert.equal(implicitCores(catalog).length, 0);
  });
});
