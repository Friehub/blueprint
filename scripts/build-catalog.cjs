#!/usr/bin/env node
/**
 * Compiles markdown contracts into a single catalog.json for distribution.
 * Runs during `npm run build`. The output is included in the npm package
 * so `blueprint generate` works without shipping raw contracts.
 */
const { loadCatalogFromRoot } = require("../dist/core/load-catalog.js");
const { writeFileSync } = require("fs");
const { join } = require("path");

const ROOT = join(__dirname, "..");

async function main() {
  const result = await loadCatalogFromRoot(ROOT, "loose");
  if (!result.value) {
    console.error("Failed to load catalog");
    process.exit(1);
  }

  const errors = result.issues.filter((i) => i.severity === "error");
  if (errors.length > 0) {
    console.error("Catalog errors:");
    errors.forEach((e) => console.error("  -", e.message));
    process.exit(1);
  }

  const outPath = join(ROOT, "dist", "catalog.json");
  writeFileSync(outPath, JSON.stringify(result.value, null, 2));
  console.log(`Compiled ${result.value.modules.length} modules + ${result.value.core.length} core to dist/catalog.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
