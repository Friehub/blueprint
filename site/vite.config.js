import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { copyFileSync, readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { parse as parseYaml } from "yaml";

const rootDir = resolve(__dirname, "..");
const adaptersDir = resolve(rootDir, "adapters");

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

// Write adapters.json into the public dir so it's served as a static file
const publicDir = resolve(__dirname, "public");
mkdirSync(publicDir, { recursive: true });
writeFileSync(resolve(publicDir, "adapters.json"), JSON.stringify(buildAdapterJson()));

export default defineConfig({
  plugins: [vue()],
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
});
