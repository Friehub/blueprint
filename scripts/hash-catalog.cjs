#!/usr/bin/env node
/**
 * Computes SHA-256 hash of catalog.min.json and embeds it in package.json.
 * The CLI verifies this hash on startup to detect tampered catalogs.
 */
const { createHash } = require("crypto");
const { readFileSync, writeFileSync } = require("fs");
const { join } = require("path");

const ROOT = join(__dirname, "..");
const pkgPath = join(ROOT, "package.json");
const catalogPath = join(ROOT, "dist", "catalog.min.json");

const catalog = readFileSync(catalogPath, "utf8");
const hash = createHash("sha256").update(catalog).digest("hex");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
if (!pkg.blueprint) pkg.blueprint = {};
pkg.blueprint.catalogHash = hash;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`Catalog hash: ${hash}`);
