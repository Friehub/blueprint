#!/usr/bin/env node
/**
 * Produces catalog.min.json from catalog.json.
 * Strips function definitions, types, invariants, rawSections, integrations,
 * and source paths. Keeps only module names, versions, deps, and providers.
 *
 * The full catalog.json stays in the repo for development.
 * catalog.min.json ships in the npm package.
 */
const { readFileSync, writeFileSync, existsSync, unlinkSync } = require("fs");
const { join } = require("path");

const ROOT = join(__dirname, "..");
const full = JSON.parse(readFileSync(join(ROOT, "dist", "catalog.json"), "utf8"));

function stripModule(mod) {
  const stripSource = (obj) => {
    const { source, ...rest } = obj || {};
    return rest;
  };
  return {
    name: mod.name,
    title: mod.title,
    version: mod.version,
    summary: mod.summary,
    functions: (mod.functions || []).map(stripSource),
    types: (mod.types || []).map(stripSource),
    hardDeps: mod.hardDeps,
    softDeps: mod.softDeps,
    coreInherits: mod.coreInherits,
    providers: mod.providers,
    profile: mod.profile,
  };
}

function stripCore(core) {
  return {
    name: core.name,
    title: core.title,
    version: core.version,
    implicit: core.implicit,
    profile: core.profile,
  };
}

const minified = {
  modules: full.modules.map(stripModule),
  core: full.core.map(stripCore),
};

const outPath = join(ROOT, "dist", "catalog.min.json");
writeFileSync(outPath, JSON.stringify(minified, null, 2));

console.log(`Stripped ${full.modules.length} modules + ${full.core.length} core to dist/catalog.min.json`);
console.log(`  Full: ${JSON.stringify(full).length} bytes`);
console.log(`  Min:  ${JSON.stringify(minified).length} bytes`);
