#!/usr/bin/env node
/**
 * Extracts saga data from markdown files in sagas/ into a JSON array.
 * Called at Vite build time to generate site/public/sagas.json.
 */
const { readFileSync, readdirSync, writeFileSync } = require("fs");
const { join } = require("path");

const SAGAS_DIR = join(__dirname, "..", "sagas");

function parseSaga(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  const name = (content.match(/^# Saga: `(.+?)`/) || [])[1] || "";
  const version = (content.match(/\*\*Version:\*\* (.+)/) || [])[1] || "";
  const modulesLine = (content.match(/\*\*Modules:\*\* (.+)/) || [])[1] || "";
  const modules = modulesLine.split(/[→,]+/).map(s => s.trim()).filter(Boolean);

  // Extract steps: each step starts with "number. **" and ends before next step or section
  const steps = [];
  let inSteps = false;
  let currentStep = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("## Steps")) { inSteps = true; continue; }
    if (line.startsWith("## ") && !line.startsWith("## Steps")) { inSteps = false; break; }
    if (!inSteps || !line) continue;

    // New step: "1. **action** → result" or "1. **action** — description"
    const stepMatch = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*(.*)$/);
    if (stepMatch) {
      if (currentStep) steps.push(currentStep);
      currentStep = {
        action: (stepMatch[2] + stepMatch[3]).trim(),
        compensation: null,
      };
      continue;
    }

    // Compensation line
    const compMatch = line.match(/^\*\*Compensation:\*\*\s+(.+)/);
    if (compMatch && currentStep) {
      currentStep.compensation = compMatch[1].trim();
      continue;
    }
  }
  if (currentStep) steps.push(currentStep);

  // Extract invariants
  const invariants = [];
  let inInv = false;
  for (const line of lines) {
    if (line.startsWith("## Invariants")) { inInv = true; continue; }
    if (line.startsWith("## ")) { inInv = false; continue; }
    if (!inInv) continue;
    const m = line.match(/^-\s+(.+)/);
    if (m) invariants.push(m[1].trim());
  }

  return { name, version, modules, steps, invariants };
}

const sagas = readdirSync(SAGAS_DIR)
  .filter(f => f.endsWith(".md"))
  .map(f => parseSaga(join(SAGAS_DIR, f)));

const outPath = join(__dirname, "..", "site", "public", "sagas.json");
writeFileSync(outPath, JSON.stringify(sagas, null, 2));
console.log(`Extracted ${sagas.length} sagas to site/public/sagas.json`);
