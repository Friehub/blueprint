#!/usr/bin/env node

/**
 * Auto-detect semver bumps for changed contracts.
 *
 * Usage: node scripts/bump-versions.cjs
 *   Compares working tree against origin/main.
 *   Updates **Version:** fields in changed contracts.
 *
 * Rules:
 *   - Function signature changes → MAJOR
 *   - New functions, types, events, sections → MINOR
 *   - Only formatting/clarifications → PATCH
 */

const { execSync } = require("child_process");
const { readFileSync, writeFileSync } = require("fs");
const { join } = require("path");

const ROOT = join(__dirname, "..");

function git(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

// Get changed contract files
const base = process.argv[2] || "origin/main";
const diffOutput = git(`git diff --name-only ${base} -- contracts/*.md`);
const changedFiles = diffOutput.split("\n").filter(Boolean).filter((f) => f.endsWith(".md") && !f.startsWith("contracts/core/"));

if (changedFiles.length === 0) {
  console.log("No contract changes detected.");
  process.exit(0);
}

console.log(`Checking ${changedFiles.length} changed contracts against ${base}...\n`);

const results = { major: [], minor: [], patch: [], error: [] };

for (const file of changedFiles) {
  const filePath = join(ROOT, file);
  const oldContent = git(`git show ${base}:${file}`);
  const newContent = readFileSync(filePath, "utf8");

  if (!oldContent) {
    // New file — set to 1.0.0
    bumpVersion(filePath, newContent, "1.0.0", results, "new file");
    continue;
  }

  const currentVersion = extractVersion(newContent);
  if (!currentVersion) {
    results.error.push(`${file}: no version field found`);
    continue;
  }

  const bump = detectBump(oldContent, newContent);
  const newVersion = applyBump(currentVersion, bump);
  bumpVersion(filePath, newContent, newVersion, results, bump);
}

console.log("\n=== Results ===");
console.log(`MAJOR (${results.major.length}):`);
results.major.forEach((r) => console.log(`  ${r.file} → ${r.version} (${r.reason})`));
console.log(`\nMINOR (${results.minor.length}):`);
results.minor.forEach((r) => console.log(`  ${r.file} → ${r.version} (${r.reason})`));
console.log(`\nPATCH (${results.patch.length}):`);
results.patch.forEach((r) => console.log(`  ${r.file} → ${r.version} (${r.reason})`));
if (results.error.length) {
  console.log(`\nERRORS (${results.error.length}):`);
  results.error.forEach((r) => console.log(`  ${r}`));
}

// ─── Helpers ─────────────────────────────────────────────

function extractVersion(content) {
  const m = content.match(/^\*\*Version:\*\*\s+(\d+\.\d+\.\d+)/m);
  return m ? m[1] : null;
}

function detectBump(oldC, newC) {
  const oldFns = parseFunctions(oldC);
  const newFns = parseFunctions(newC);
  const oldTypes = parseTypes(oldC);
  const newTypes = parseTypes(newC);

  // Check for breaking changes: function signature changes
  for (const [name, sig] of Object.entries(oldFns)) {
    if (newFns[name] && newFns[name] !== sig) {
      return "major"; // signature changed
    }
    if (!(name in newFns)) {
      return "major"; // function removed
    }
  }

  // Check for new required params in existing functions
  for (const [name, sig] of Object.entries(newFns)) {
    const oldSig = oldFns[name];
    if (oldSig) {
      const oldParams = extractParams(oldSig);
      const newParams = extractParams(newSig);
      for (const p of newParams) {
        if (!p.endsWith("?") && !oldParams.includes(p)) {
          return "major"; // new required param
        }
      }
    }
  }

  // New functions or types → minor
  const newFnCount = Object.keys(newFns).length - Object.keys(oldFns).length;
  const newTypeCount = Object.keys(newTypes).length - Object.keys(oldTypes).length;
  if (newFnCount > 0 || newTypeCount > 0) return "minor";

  // Check for new event sections
  if (hasNewSection(oldC, newC, "event")) return "minor";
  if (hasNewSection(oldC, newC, "database schema")) return "minor";
  if (hasNewSection(oldC, newC, "observability")) return "minor";

  return "patch";
}

function parseFunctions(content) {
  const result = {};
  const block = content.match(/`{3,}\s*\n([\s\S]*?)`{3,}/);
  if (block) {
    const lines = block[1].split("\n");
    let inFns = false;
    for (const line of lines) {
      if (line.startsWith("**Functions**")) { inFns = true; continue; }
      if (line.startsWith("**Types**")) { inFns = false; continue; }
      if (inFns) {
        const m = line.match(/^(\w+)\(([^)]*)\)/);
        if (m) result[m[1]] = m[0];
      }
    }
  }
  return result;
}

function parseTypes(content) {
  const result = {};
  const block = content.match(/`{3,}\s*\n([\s\S]*?)`{3,}/);
  if (block) {
    const lines = block[1].split("\n");
    let inTypes = false;
    for (const line of lines) {
      if (line.startsWith("**Types**")) { inTypes = true; continue; }
      if (line.startsWith("**Invariants**") || line.startsWith("**Functions**")) { inTypes = false; continue; }
      if (inTypes) {
        const m = line.match(/^(\w+)\s*(=|{)/);
        if (m) result[m[1]] = line;
      }
    }
  }
  return result;
}

function extractParams(sig) {
  const m = sig.match(/\(([^)]*)\)/);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim()).filter(Boolean);
}

function hasNewSection(oldC, newC, name) {
  const hasOld = oldC.toLowerCase().includes(`## ${name}`) || oldC.toLowerCase().includes(`### ${name}`);
  const hasNew = newC.toLowerCase().includes(`## ${name}`) || newC.toLowerCase().includes(`### ${name}`);
  return !hasOld && hasNew;
}

function applyBump(version, bump) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function bumpVersion(filePath, content, newVersion, results, reason) {
  const updated = content.replace(/^(\*\*Version:\*\*\s+)\d+\.\d+\.\d+/m, `$1${newVersion}`);
  if (updated !== content) {
    writeFileSync(filePath, updated);
    const file = filePath.replace(ROOT + "/", "");
    const bumpType = reason === "major" || reason === "minor" || reason === "patch" ? reason : "minor";
    results[bumpType === "major" ? "major" : bumpType === "minor" ? "minor" : "patch"].push({
      file,
      version: newVersion,
      reason: reason !== "major" && reason !== "minor" && reason !== "patch" ? reason : `auto-detected ${bumpType}`,
    });
  }
}
