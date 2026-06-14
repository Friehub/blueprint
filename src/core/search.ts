import type { Catalog, ModuleContract } from "./catalog.js";

export type SearchResult = {
  module: ModuleContract;
  score: number;
  matchType: "name" | "summary" | "function";
};

export function searchModules(catalog: Catalog, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const q = query.toLowerCase();

  for (const mod of catalog.modules) {
    let score = 0;
    let matchType: SearchResult["matchType"] = "summary";

    if (mod.name.toLowerCase() === q) {
      score = 100;
      matchType = "name";
    } else if (mod.name.toLowerCase().includes(q)) {
      score = 80;
      matchType = "name";
    } else if (mod.summary?.toLowerCase().includes(q)) {
      score = 60;
      matchType = "summary";
    } else {
      for (const fn of mod.functions) {
        if (fn.name.toLowerCase().includes(q)) {
          score = 40;
          matchType = "function";
          break;
        }
      }
    }

    if (score > 0) {
      results.push({ module: mod, score, matchType });
    }
  }

  results.sort((a, b) => b.score - a.score || a.module.name.localeCompare(b.module.name));

  return results;
}
