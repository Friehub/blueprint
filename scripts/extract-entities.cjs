#!/usr/bin/env node
/**
 * Extracts abstract entity models from catalog.json.
 * Each type with { } is treated as an entity candidate.
 * Storage types are inferred from field naming conventions.
 * Output: dist/entities.json
 *
 * This is the abstract model — independent of any database.
 * Renderers convert it to PostgreSQL, MongoDB, DynamoDB, etc.
 */
const { readFileSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");

const ROOT = join(__dirname, "..");
const catalogPath = join(ROOT, "dist", "catalog.json");
const overridesPath = join(ROOT, "blueprint.storage.json");

if (!existsSync(catalogPath)) {
  console.error("dist/catalog.json not found. Run 'npm run build' first.");
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));

// Load optional storage overrides from blueprint.storage.json
let overrides = {};
if (existsSync(overridesPath)) {
  try {
    overrides = JSON.parse(readFileSync(overridesPath, "utf8"));
    console.log("Loaded storage overrides from blueprint.storage.json");
  } catch (e) {
    console.warn("Warning: blueprint.storage.json is malformed, ignoring.");
  }
}

// Storage type inference rules
// Maps field naming patterns to storage types per database family
const TYPE_RULES = [
  { pattern: /_id$/i, infer: "uuid", label: "UUID" },
  { pattern: /^id$/i, infer: "uuid", label: "UUID" },
  { pattern: /_at$/i, infer: "timestamp", label: "Timestamp" },
  { pattern: /_date$/i, infer: "date", label: "Date" },
  { pattern: /_count$/i, infer: "integer", label: "Integer" },
  { pattern: /_amount$/i, infer: "i64_decicents", label: "BigInt (cents)", defaultStorage: "BIGINT" },
  { pattern: /_price$/i, infer: "i64_decicents", label: "BigInt (cents)", defaultStorage: "BIGINT" },
  { pattern: /_total$/i, infer: "i64_decicents", label: "BigInt (cents)", defaultStorage: "BIGINT" },
  { pattern: /_pct$/i, infer: "decimal", label: "Decimal" },
  { pattern: /_score$/i, infer: "float", label: "Float" },
  { pattern: /_rate$/i, infer: "float", label: "Float" },
  { pattern: /is_/i, infer: "boolean", label: "Boolean" },
  { pattern: /has_/i, infer: "boolean", label: "Boolean" },
  { pattern: /_url$/i, infer: "string", label: "String" },
  { pattern: /_email$/i, infer: "string", label: "String" },
  { pattern: /_name$/i, infer: "string", label: "String" },
  { pattern: /_key$/i, infer: "string", label: "String" },
  { pattern: /_token$/i, infer: "string", label: "String" },
  { pattern: /balance/i, infer: "i64_decicents", label: "BigInt (cents)", defaultStorage: "BIGINT" },
  { pattern: /^amount$/i, infer: "i64_decicents", label: "BigInt (cents)", defaultStorage: "BIGINT" },
];

function inferFieldType(name) {
  for (const rule of TYPE_RULES) {
    if (rule.pattern.test(name)) return rule;
  }
  // Estimate from contract type
  if (name.endsWith("?")) return { infer: "string_optional", label: "String (optional)" };
  return { infer: "string", label: "String" };
}

function extractEntity(name, raw, moduleName) {
  const match = raw.match(/\{([^}]+)\}/s);
  if (!match) return null;

  const fieldStrs = match[1].split(",").map(s => s.trim()).filter(Boolean);
  const fields = fieldStrs.map(f => {
    const optional = f.endsWith("?");
    const clean = f.replace(/\?$/, "");
    const rule = inferFieldType(clean);
    const overrideKey = `${moduleName}.${name}.${clean}`;
    const override = overrides[overrideKey];

    return {
      name: clean,
      type: override || rule.infer,
      storageType: rule.defaultStorage || rule.label,
      optional,
      pii: false,
      primaryKey: clean === "id",
      foreignKey: /_id$/i.test(clean) && clean !== "id" ? clean.replace(/_id$/i, "") : null,
    };
  });

  const entity = {
    module: moduleName,
    entity: name,
    fields,
    primaryKeys: fields.filter(f => f.primaryKey).map(f => f.name),
    foreignKeys: fields.filter(f => f.foreignKey).map(f => ({
      field: f.name,
      refEntity: pascalCase(f.foreignKey),
    })),
    accessPatterns: [],
  };

  return entity;
}

function pascalCase(str) {
  return str.replace(/(^\w|_\w)/g, m => m.replace("_", "").toUpperCase());
}

const entities = [];

for (const mod of catalog.modules) {
  for (const type of mod.types || []) {
    // Skip enums (no {})
    if (!type.raw.includes("{")) continue;

    const entity = extractEntity(type.name, type.raw, mod.name);
    if (entity) entities.push(entity);
  }
}

const outPath = join(ROOT, "dist", "entities.json");
writeFileSync(outPath, JSON.stringify(entities, null, 2));
console.log(`Extracted ${entities.length} entities from ${catalog.modules.length} modules to dist/entities.json`);
console.log(`  ${entities.filter(e => e.foreignKeys.length > 0).length} entities have relationships`);
