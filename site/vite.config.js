import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";

const rootDir = resolve(__dirname, "..");
const catalogPath = resolve(rootDir, "dist", "catalog.json");
const adaptersDir = resolve(rootDir, "adapters");

function loadAdapters() {
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
        adapters.push({
          name: parsed.name,
          module: parsed.module,
          implements: parsed.implements || [],
          languages: parsed.languages || null,
        });
      } catch {}
    }
  }
  return adapters;
}

export default defineConfig({
  plugins: [vue()],
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
  define: {
    __CATALOG__: (() => {
      try {
        return JSON.stringify(JSON.parse(readFileSync(catalogPath, "utf8")));
      } catch {
        return JSON.stringify({ modules: [], core: [] });
      }
    })(),
    __ADAPTERS__: JSON.stringify(loadAdapters()),
  },
});
