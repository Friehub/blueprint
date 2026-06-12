import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, copyFileSync } from "fs";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";

const rootDir = resolve(__dirname, "..");
const adaptersDir = resolve(rootDir, "adapters");
const distDir = resolve(rootDir, "dist");
const publicDir = resolve(__dirname, "public");
const sagasDir = resolve(rootDir, "sagas");

function buildAdapterJson() {
  const adapters = [];
  if (!existsSync(adaptersDir)) return adapters;
  const modules = readdirSync(adaptersDir, { withFileTypes: true });
  for (const entry of modules) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const files = readdirSync(resolve(adaptersDir, entry.name));
    for (const file of files) {
      if (!file.endsWith(".yaml")) continue;
      try {
        const content = readFileSync(resolve(adaptersDir, entry.name, file), "utf8");
        const parsed = parseYaml(content);
        adapters.push({ name: parsed.name, module: parsed.module, implements: parsed.implements || [], languages: parsed.languages || null });
      } catch {}
    }
  }
  return adapters;
}

function parseSaga(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const name = (content.match(/^# Saga: `(.+?)`/) || [])[1] || "";
  const modulesLine = (content.match(/\*\*Modules:\*\* (.+)/) || [])[1] || "";
  const modules = modulesLine.split(/[→,]+/).map(s => s.trim()).filter(Boolean);
  const steps = [];
  let inSteps = false;
  let currentStep = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("## Steps")) { inSteps = true; continue; }
    if (line.startsWith("## ") && !line.startsWith("## Steps")) { inSteps = false; break; }
    if (!inSteps || !line) continue;
    const stepMatch = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*(.*)$/);
    if (stepMatch) {
      if (currentStep) steps.push(currentStep);
      currentStep = { action: (stepMatch[2] + stepMatch[3]).trim(), compensation: null };
      continue;
    }
    const compMatch = line.match(/^\*\*Compensation:\*\*\s+(.+)/);
    if (compMatch && currentStep) { currentStep.compensation = compMatch[1].trim(); }
  }
  if (currentStep) steps.push(currentStep);
  const invariants = [];
  let inInv = false;
  for (const line of lines) {
    if (line.startsWith("## Invariants")) { inInv = true; continue; }
    if (line.startsWith("## ")) { inInv = false; continue; }
    if (!inInv) continue;
    const m = line.match(/^-\s+(.+)/);
    if (m) invariants.push(m[1].trim());
  }
  return { name, modules, steps, invariants };
}

// Prepare public directory assets
mkdirSync(publicDir, { recursive: true });
writeFileSync(resolve(publicDir, "adapters.json"), JSON.stringify(buildAdapterJson()));
if (existsSync(resolve(distDir, "catalog.json"))) {
  copyFileSync(resolve(distDir, "catalog.json"), resolve(publicDir, "catalog.json"));
}
if (existsSync(resolve(distDir, "entities.json"))) {
  copyFileSync(resolve(distDir, "entities.json"), resolve(publicDir, "entities.json"));
}
// Extract sagas
const sagas = existsSync(sagasDir)
  ? readdirSync(sagasDir).filter(f => f.endsWith(".md")).map(f => parseSaga(resolve(sagasDir, f)))
  : [];
writeFileSync(resolve(publicDir, "sagas.json"), JSON.stringify(sagas));

export default defineConfig({
  plugins: [vue()],
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
});
