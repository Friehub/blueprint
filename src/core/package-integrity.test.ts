import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("npm package integrity", () => {
  it("catalog.min.json has no local file paths", () => {
    const minPath = join(import.meta.dirname, "..", "..", "dist", "catalog.min.json");
    assert.ok(existsSync(minPath), "catalog.min.json exists");

    const content = readFileSync(minPath, "utf8");
    const homePaths = [
      "/home/", "/Users/", "/root/",
      process.env.HOME || "/nonexistent",
    ];
    for (const path of homePaths) {
      if (path === "/nonexistent") continue;
      assert.ok(!content.includes(path), `catalog.min.json must not contain '${path}'`);
    }
  });

  it("catalog.min.json has no source field on functions or types", () => {
    const minPath = join(import.meta.dirname, "..", "..", "dist", "catalog.min.json");
    const cat = JSON.parse(readFileSync(minPath, "utf8"));

    for (const mod of cat.modules) {
      for (const fn of mod.functions || []) {
        assert.ok(!("source" in fn), `Module ${mod.name} function ${fn.name} has source field`);
      }
      for (const type of mod.types || []) {
        assert.ok(!("source" in type), `Module ${mod.name} type ${type.name} has source field`);
      }
      assert.ok(!("source" in mod), `Module ${mod.name} has top-level source field`);
      assert.ok(!("invariants" in mod), `Module ${mod.name} has invariants`);
      assert.ok(!("rawSections" in mod), `Module ${mod.name} has rawSections`);
      assert.ok(!("integrations" in mod), `Module ${mod.name} has integrations`);
    }
  });

  it("npm pack does not include markdown files (except README and CHANGELOG)", () => {
    const output = execSync("npm pack --dry-run 2>&1", {
      cwd: join(import.meta.dirname, "..", ".."),
      encoding: "utf8",
    });

    const lines = output.split("\n");
    const packedFiles = lines
      .filter((l) => l.startsWith("npm notice ") && l.includes("B ") && !l.includes("Tarball Details") && !l.includes("package.json"))
      .map((l) => l.match(/[\w/.+-]+\.\w+$/)?.[0] || "")
      .filter((f) => f.length > 0);

    const mdFiles = packedFiles.filter((f): f is string => !!f && f.endsWith(".md"));
    const allowed = ["README.md", "CHANGELOG.md"];
    for (const f of mdFiles) {
      assert.ok(allowed.includes(f), `Unexpected markdown file in package: ${f}`);
    }
    assert.equal(mdFiles.length, allowed.length, `Expected exactly ${allowed.length} markdown files, got ${mdFiles.length}: ${mdFiles.join(", ")}`);
  });

  it("npm pack does not contain full catalog.json (only minified)", () => {
    const output = execSync("npm pack --dry-run 2>&1", {
      cwd: join(import.meta.dirname, "..", ".."),
      encoding: "utf8",
    });

    assert.ok(!output.includes("catalog.json"), "npm pack should not contain catalog.json (only catalog.min.json)");
    assert.ok(output.includes("catalog.min.json"), "npm pack should contain catalog.min.json");
  });
});
